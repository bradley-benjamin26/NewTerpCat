import re
from itertools import islice, product
import xml.etree.ElementTree as ET

import httpx

UMD = {
    "key": "umd",
    "name": "University of Maryland",
    "base_url": "https://usmai-umcp.alma.exlibrisgroup.com/view/sru/01USMAI_UMCP",
    "record_url_template": "https://usmai-umcp.alma.exlibrisgroup.com/discovery/fulldisplay?docid=alma{mms_id}&vid=01USMAI_UMCP:UMCP",
}

NS = {"srw": "http://www.loc.gov/zing/srw/", "marc": "http://www.loc.gov/MARC21/slim"}
TRAILING = " /:;,."
# Combinations multiply with each AND part and matched heading (2**20 for 20 parts); keep the first few,
# which use the keywords and the best headings.
MAX_COMBOS = 20


def _quoted(s: str) -> str:
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def _keywords(keywords: list[str]) -> str:
    # "all" matches the words in any order; "=" on multiple words is an exact phrase in Alma.
    return f"alma.all_for_ui all {_quoted(' '.join(keywords))}"


def _alternatives(part: dict) -> list[list[str]]:
    """Ways one part of the query can match; each is a list of clauses that must all hold."""
    alternatives = [[_keywords(part["keywords"])]]
    alternatives += [[f"alma.creator all {_quoted(p)}"] for p in part["people"]]
    if part["subjects"]:
        # One heading from every phrase, so a broad heading like "History" can't flood the results.
        combos = islice(product(*(s["headings"] for s in part["subjects"])), MAX_COMBOS)
        alternatives += [[f"alma.subjects={_quoted(h)}" for h in combo] for combo in combos]
    return alternatives


def _group(parts: list[dict]) -> str:
    include = [p for p in parts if p.get("operator") != "NOT"]
    if not include:
        raise ValueError("NOT needs something to search for first, for example: jazz NOT blues")
    exclude = "".join(f" NOT {_keywords(p['keywords'])}" for p in parts if p.get("operator") == "NOT")
    combos = islice(product(*map(_alternatives, include)), MAX_COMBOS)
    return " OR ".join(" AND ".join(c for alt in combo for c in alt) + exclude for combo in combos)


def cql_query(parts: list[dict]) -> str:
    """Parts joined by the user's AND/OR/NOT, with AND and NOT binding tighter than OR. Alma mishandles
    parentheses but uses the same precedence, so the query is written out as an OR of ANDs."""
    groups = [[]]
    for part in parts:
        if part.get("operator") == "OR":
            groups.append([])
        groups[-1].append(part)
    return " OR ".join(map(_group, groups))


async def search(cql: str, limit: int = 10) -> bytes:
    params = {
        "version": "1.2",
        "operation": "searchRetrieve",
        "recordSchema": "marcxml",
        "maximumRecords": limit,
        "query": cql,
    }
    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.get(UMD["base_url"], params=params)
        res.raise_for_status()
        return res.content


def _subfields(rec, tag, codes):
    """Subfield values of the first `tag` field, in record order."""
    field = rec.find(f"marc:datafield[@tag='{tag}']", NS)
    if field is None:
        return []
    return [sf.text or "" for sf in field.findall("marc:subfield", NS) if sf.get("code") in codes]


def _record(rec) -> dict:
    mms_id = rec.findtext("marc:controlfield[@tag='001']", namespaces=NS)
    title = " ".join(_subfields(rec, "245", "ab")).rstrip(TRAILING)
    names = _subfields(rec, "100", "ab") or _subfields(rec, "110", "ab") or _subfields(rec, "111", "a")
    author = " ".join(names).rstrip(TRAILING) or None
    year = re.search(r"\d{4}", " ".join(_subfields(rec, "264", "c") or _subfields(rec, "260", "c")))
    holdings = []
    for ava in rec.findall("marc:datafield[@tag='AVA']", NS):
        sf = {s.get("code"): s.text for s in ava.findall("marc:subfield", NS)}
        holdings.append({"location": sf.get("c"), "call_number": sf.get("d"), "status": sf.get("e")})
    return {
        "id": mms_id,
        "title": title,
        "author": author,
        "date": year.group() if year else None,
        "url": UMD["record_url_template"].format(mms_id=mms_id),
        "online": rec.find("marc:datafield[@tag='AVE']", NS) is not None,
        "holdings": holdings,
    }


def parse_response(xml: bytes) -> dict:
    root = ET.fromstring(xml)
    return {
        "total": int(root.findtext("srw:numberOfRecords", "0", NS)),
        "records": [_record(r) for r in root.iterfind(".//marc:record", NS)],
    }
