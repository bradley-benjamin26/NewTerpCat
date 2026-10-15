import re
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


def _quoted(s: str) -> str:
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def cql_query(keywords: list[str], subjects: list[str] = (), people: list[str] = ()) -> str:
    clauses = [f"alma.all_for_ui={_quoted(' '.join(keywords))}"]
    if subjects:
        # AND keeps a broad heading like "History" from flooding the results.
        clauses.append("(" + " AND ".join(f"alma.subjects={_quoted(s)}" for s in subjects) + ")")
    clauses += [f"alma.creator={_quoted(p)}" for p in people]
    return " OR ".join(clauses)


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
