import asyncio
import re

import httpx
from fastapi import FastAPI, HTTPException

from app.analyze import _nlp, analyze
from app.lcsh import subjects
from app.rank import score
from app.sru import parse_response, pool_queries
from app.sru import search as fetch
from app.worldcat import holding_counts

app = FastAPI(title="NewTerpCat")
MAX_QUERY = 300
SHOWN = 25
_nlp()  # load the spaCy model at startup, not on the first search


async def _searched(operator: str | None, text: str) -> dict:
    analysis = analyze(text)
    keywords = analysis["keywords"] or [text]
    if operator == "NOT":
        # Excluded by keyword only; the keyword index already covers subjects and authors.
        return {"operator": operator, "keywords": keywords, "subjects": [], "people": []}
    return {
        "operator": operator,
        "keywords": keywords,
        "subjects": await subjects(analysis["phrases"]),
        "people": analysis["people"],
    }


async def _optional(cql: str) -> bytes | None:
    try:
        return await fetch(cql)
    except httpx.HTTPError:
        return None  # a narrow query only adds candidates; the full query still answers


@app.get("/search")
async def search(q: str):
    q = q.strip()
    if not q:
        raise HTTPException(422, "Query must not be blank")
    if len(q) > MAX_QUERY:
        # Bounds the subject lookups (one per phrase) and the parts multiplied into the catalog query.
        raise HTTPException(422, f"Please use a shorter search (at most {MAX_QUERY} characters).")
    # Only uppercase AND/OR/NOT are Boolean; lowercase words are ordinary (stop) words.
    # An all-caps query (caps lock, "TO BE OR NOT TO BE") has no operators.
    tokens = [q] if q.isupper() else re.split(r"(?<!\S)(AND|OR|NOT)\s+", q)
    parts = list(zip([None, *tokens[1::2]], [t.strip() for t in tokens[::2]]))
    if not parts[0][1]:
        parts.pop(0)  # the query starts with an operator
    if not all(text for _, text in parts):
        raise HTTPException(422, "Put words between AND, OR and NOT, for example: jazz NOT blues")
    if parts[0][0] != "NOT":
        parts[0] = (None, parts[0][1])  # a leading AND/OR joins nothing
    searched = await asyncio.gather(*(_searched(op, text) for op, text in parts))
    try:
        *narrow, full = pool_queries(searched)
    except ValueError as e:
        raise HTTPException(422, str(e))
    try:
        *extra, xml = await asyncio.gather(*map(_optional, narrow), fetch(full))
    except httpx.HTTPError:
        raise HTTPException(502, "The library catalog is not responding. Try again shortly.")
    result = parse_response(xml)
    pool = {r["id"]: r for page in [result, *map(parse_response, filter(None, extra))] for r in page["records"]}
    ranked = sorted(pool.values(), key=lambda r: score(r, searched)["score"], reverse=True)[:SHOWN]
    # shortcut: WorldCat counts only for the shown records (one call each), so its bonus of at most
    # 10 points can't lift a record from below the cut; fetch counts for more if that matters.
    counts = await holding_counts([r["oclc"] for r in ranked if r["oclc"]])
    ranked = [{**r, **score(r, searched, counts.get(r["oclc"]))} for r in ranked]
    ranked.sort(key=lambda r: r["score"], reverse=True)
    return {"total": result["total"], "records": ranked, "searched": searched}
