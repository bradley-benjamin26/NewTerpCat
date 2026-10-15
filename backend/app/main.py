import httpx
from fastapi import FastAPI, HTTPException

from app.sru import parse_response
from app.sru import search as fetch

app = FastAPI(title="NewTerpCat")


@app.get("/search")
async def search(q: str):
    if not q.strip():
        raise HTTPException(422, "Query must not be blank")
    try:
        return parse_response(await fetch(q.strip()))
    except httpx.HTTPError:
        raise HTTPException(502, "The library catalog is not responding. Try again shortly.")
