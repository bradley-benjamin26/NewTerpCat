import asyncio
import re

import httpx
from fastapi import FastAPI, HTTPException

from app.analyze import _nlp, analyze
from app.lcsh import subjects
from app.sru import cql_query, parse_response
from app.sru import search as fetch

app = FastAPI(title="NewTerpCat")
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


@app.get("/search")
async def search(q: str):
    q = q.strip()
    if not q:
        raise HTTPException(422, "Query must not be blank")
    # Only uppercase AND/OR/NOT are Boolean; lowercase words are ordinary (stop) words.
    tokens = re.split(r"(?<!\S)(AND|OR|NOT)\s+", q)
    parts = list(zip([None, *tokens[1::2]], [t.strip() for t in tokens[::2]]))
    if not parts[0][1]:
        parts.pop(0)  # the query starts with an operator
    if not all(text for _, text in parts):
        raise HTTPException(422, "Put words between AND, OR and NOT, for example: jazz NOT blues")
    if parts[0][0] != "NOT":
        parts[0] = (None, parts[0][1])  # a leading AND/OR joins nothing
    searched = await asyncio.gather(*(_searched(op, text) for op, text in parts))
    try:
        cql = cql_query(searched)
    except ValueError as e:
        raise HTTPException(422, str(e))
    try:
        xml = await fetch(cql)
    except httpx.HTTPError:
        raise HTTPException(502, "The library catalog is not responding. Try again shortly.")
    return {**parse_response(xml), "searched": searched}
