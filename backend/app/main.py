import httpx
from fastapi import FastAPI, HTTPException

from app.analyze import _nlp, analyze
from app.lcsh import subjects
from app.sru import cql_query, parse_response
from app.sru import search as fetch

app = FastAPI(title="NewTerpCat")
_nlp()  # load the spaCy model at startup, not on the first search


@app.get("/search")
async def search(q: str):
    q = q.strip()
    if not q:
        raise HTTPException(422, "Query must not be blank")
    analysis = analyze(q)
    searched = {
        "keywords": analysis["keywords"] or [q],
        "subjects": await subjects(analysis["phrases"]),
        "people": analysis["people"],
    }
    try:
        xml = await fetch(cql_query(**searched))
    except httpx.HTTPError:
        raise HTTPException(502, "The library catalog is not responding. Try again shortly.")
    return {**parse_response(xml), "searched": searched}
