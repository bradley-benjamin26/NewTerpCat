import re
from itertools import chain, islice, product, zip_longest
import xml.etree.ElementTree as ET

import httpx

UMD = {
    "key": "umd",
    "name": "University of Maryland",
    "base_url": "https://usmai-umcp.alma.exlibrisgroup.com/view/sru/01USMAI_UMCP",
    "record_url_template": "https://usmai-umcp.alma.exlibrisgroup.com/discovery/fulldisplay?docid=alma{mms_id}&vid=01USMAI_UMCP:UMCP",
}
# Big Ten catalogs with a verified SRU endpoint (specDocuments/externalSystemUrls.md). No record links:
# results only say where a book can be borrowed through interlibrary loan.
BTAA = [
    {"key": "rutgers", "name": "Rutgers University", "region": "east_coast",
     "base_url": "https://rutgers.primo.exlibrisgroup.com/view/sru/01RUT_INST"},
    {"key": "nebraska", "name": "University of Nebraska-Lincoln", "region": "midwest",
     "base_url": "https://unl.primo.exlibrisgroup.com/view/sru/01UON_LINC"},
    {"key": "washington", "name": "University of Washington", "region": "west_coast",
     "base_url": "https://orbiscascade-washington.primo.exlibrisgroup.com/view/sru/01ALLIANCE_UW"},
    {"key": "minnesota", "name": "University of Minnesota", "region": "midwest",
     "base_url": "https://primo.lib.umn.edu/view/sru/01UMN_INST"},
    {"key": "oregon", "name": "University of Oregon", "region": "west_coast",
     "base_url": "https://alliance-uoregon.primo.exlibrisgroup.com/view/sru/01ALLIANCE_UO"},
    {"key": "purdue", "name": "Purdue University", "region": "midwest",
     "base_url": "https://purdue.primo.exlibrisgroup.com/view/sru/01PURDUE_PUWL"},
    {"key": "northwestern", "name": "Northwestern University", "region": "midwest",
     "base_url": "https://search.library.northwestern.edu/view/sru/01NWU_INST"},
    {"key": "ucla", "name": "UCLA", "region": "west_coast",
     "base_url": "https://search.library.ucla.edu/view/sru/01UCS_LAL"},
    {"key": "usc", "name": "University of Southern California", "region": "west_coast",
     "base_url": "https://uosc.primo.exlibrisgroup.com/view/sru/01USC_INST"},
]

NS = {"srw": "http://www.loc.gov/zing/srw/", "marc": "http://www.loc.gov/MARC21/slim"}
TRAILING = " /:;,."
# Combinations multiply with each AND part and matched heading (2**20 for 20 parts); keep the first few,
# which use the keywords and the best headings.
MAX_COMBOS = 20
# Narrower queries surface matches that SRU's alphabetical order pushes past the first page.
MAX_NARROW = 4
SUBJECT_TAGS = ("600", "610", "611", "630", "650", "651")


def _quoted(s: str) -> str:
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def _keywords(keywords: list[str], index: str = "alma.all_for_ui") -> str:
    # "all" matches the words in any order; "=" on multiple words is an exact phrase in Alma.
    return f"{index} all {_quoted(' '.join(keywords))}"


def _alternatives(part: dict, narrow: bool) -> list[list[str]]:
    """Ways one part of the query can match; each is a list of clauses that must all hold."""
    people = [f"alma.creator all {_quoted(p)}" for p in part["people"]]
    if narrow:
        # The other words in the title, by the named author: "Toni Morrison beloved" finds Beloved.
        names = {w.casefold() for p in part["people"] for w in p.split()}
        title = [k for k in part["keywords"] if k.casefold() not in names] or part["keywords"]
        alternatives = [[_keywords(title, "alma.title"), *people]]
    else:
        alternatives = [[_keywords(part["keywords"])]]
    alternatives += [[p] for p in people]
    if part["subjects"]:
        # One heading from every phrase, so a broad heading like "History" can't flood the results.
        combos = islice(product(*(s["headings"] for s in part["subjects"])), MAX_COMBOS)
        alternatives += [[f"alma.subjects={_quoted(h)}" for h in combo] for combo in combos]
    return alternatives


def _group(parts: list[dict], narrow: bool) -> list[str]:
    include = [p for p in parts if p.get("operator") != "NOT"]
    if not include:
        raise ValueError("NOT needs something to search for first, for example: jazz NOT blues")
    exclude = "".join(f" NOT {_keywords(p['keywords'])}" for p in parts if p.get("operator") == "NOT")
    combos = islice(product(*(_alternatives(p, narrow) for p in include)), MAX_COMBOS)
    return [" AND ".join(c for alt in combo for c in alt) + exclude for combo in combos]


def _terms(parts: list[dict], narrow: bool = False) -> list[list[str]]:
    """The OR-of-ANDs terms for each OR branch of the query."""
    groups = [[]]
    for part in parts:
        if part.get("operator") == "OR":
            groups.append([])
        groups[-1].append(part)
    return [_group(group, narrow) for group in groups]


def cql_query(parts: list[dict]) -> str:
    """Parts joined by the user's AND/OR/NOT, with AND and NOT binding tighter than OR. Alma mishandles
    parentheses but uses the same precedence, so the query is written out as an OR of ANDs."""
    return " OR ".join(chain.from_iterable(_terms(parts)))


def pool_queries(parts: list[dict]) -> list[str]:
    """Narrow queries (keywords in the title, authors, subject headings), each one branch of the full query,
    then the full query last."""
    # Take turns across the OR branches, so every branch gets narrow queries.
    narrow = [t for row in zip_longest(*_terms(parts, narrow=True)) for t in row if t]
    return [*narrow[:MAX_NARROW], cql_query(parts)]


async def search(cql: str, base_url: str = UMD["base_url"], limit: int = 50) -> bytes:
    params = {
        "version": "1.2",
        "operation": "searchRetrieve",
        "recordSchema": "marcxml",
        "maximumRecords": limit,
        "query": cql,
    }
    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.get(base_url, params=params)
        res.raise_for_status()
        return res.content


def _subfields(rec, tag, codes):
    """Subfield values of the first `tag` field, in record order."""
    field = rec.find(f"marc:datafield[@tag='{tag}']", NS)
    if field is None:
        return []
    return [sf.text or "" for sf in field.findall("marc:subfield", NS) if sf.get("code") in codes]


def _heading(field) -> str:
    """A subject field written like an LCSH heading: "Oyster culture--Maryland"."""
    sf = [(s.get("code"), s.text or "") for s in field.findall("marc:subfield", NS)]
    name = " ".join(text for code, text in sf if code in {"a", "b", "c", "d", "q", "t"})
    return "--".join(t.rstrip(TRAILING) for t in [name, *(text for code, text in sf if code in {"v", "x", "y", "z"})])


def _record(rec, library: dict | None) -> dict:
    mms_id = rec.findtext("marc:controlfield[@tag='001']", namespaces=NS)
    title = " ".join(_subfields(rec, "245", "ab")).rstrip(TRAILING)
    names = _subfields(rec, "100", "ab") or _subfields(rec, "110", "ab") or _subfields(rec, "111", "a")
    author = " ".join(names).rstrip(TRAILING) or None
    subjects = [_heading(f) for f in rec.findall("marc:datafield", NS) if f.get("tag") in SUBJECT_TAGS]
    oclc = next((m.group(1).lstrip("0") for a in rec.iterfind("marc:datafield[@tag='035']/marc:subfield[@code='a']", NS)
                 if (m := re.match(r"\(OCoLC\)\D*(\d+)", a.text or ""))), None)
    year = re.search(r"\d{4}", " ".join(_subfields(rec, "264", "c") or _subfields(rec, "260", "c")))
    holdings = []
    for ava in rec.findall("marc:datafield[@tag='AVA']", NS):
        sf = {s.get("code"): s.text for s in ava.findall("marc:subfield", NS)}
        holdings.append({"location": sf.get("c"), "call_number": sf.get("d"), "status": sf.get("e")})
    record = {
        "id": mms_id,
        "title": title,
        "author": author,
        "date": year.group() if year else None,
        "url": UMD["record_url_template"].format(mms_id=mms_id),
        "online": rec.find("marc:datafield[@tag='AVE']", NS) is not None,
        "holdings": holdings,
        "subjects": subjects,
        "oclc": oclc,
        "umd": True,
        "btaa": [],
    }
    if library:
        # Only a copy on the shelf counts: online copies are licensed to that university's own users.
        available = any(h["status"] == "available" for h in holdings)
        place = {"name": library["name"], "region": library["region"], "available": available}
        record |= {"id": f"{library['key']}:{mms_id}", "url": None, "online": False, "holdings": [],
                   "umd": False, "btaa": [place]}
    return record


def _details(rec) -> dict:
    """The fields only the item page shows."""
    def one(tag, codes):
        return " ".join(_subfields(rec, tag, codes)).rstrip(TRAILING) or None

    def every(tags, codes="a"):
        fields = (f for f in rec.findall("marc:datafield", NS) if f.get("tag") in tags)
        texts = (" ".join(sf.text or "" for sf in f.findall("marc:subfield", NS) if sf.get("code") in codes) for f in fields)
        return [t.rstrip(TRAILING) for t in texts if t]

    contents = one("505", "a")
    return {
        "publication": one("264", "abc") or one("260", "abc"),
        "edition": one("250", "a"),
        "description": one("300", "abc"),
        "series": one("490", "av"),
        "summary": one("520", "a"),
        "isbns": every({"020"}),
        "contributors": every({"700", "710"}, "ab"),
        "contents": [c.strip(TRAILING) for c in contents.split(" -- ")] if contents else [],
        "notes": every({"500", "504"}),
    }


def record(xml: bytes, library: dict | None = None) -> dict | None:
    """The first record in an SRU response with its full details, or None when there is none."""
    rec = ET.fromstring(xml).find(".//marc:record", NS)
    return None if rec is None else _record(rec, library) | _details(rec)


def parse_response(xml: bytes, library: dict | None = None) -> dict:
    """Records from an SRU response; library is a BTAA entry, or None for UMD."""
    root = ET.fromstring(xml)
    return {
        "total": int(root.findtext("srw:numberOfRecords", "0", NS)),
        "records": [_record(r, library) for r in root.iterfind(".//marc:record", NS)],
    }
