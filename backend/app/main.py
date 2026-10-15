import asyncio
import json
import re

import httpx
from fastapi import FastAPI, HTTPException

from app.analyze import _nlp, analyze
from app.lcsh import subjects
from app.rank import WEIGHTS, score
from app.sru import BTAA, parse_response, pool_queries
from app.sru import search as fetch
from app.worldcat import holding_counts

app = FastAPI(title="NewTerpCat")
MAX_QUERY = 300
MAX_POINTS = 200
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


async def _optional(cql: str, *base_url: str) -> bytes | None:
    try:
        return await fetch(cql, *base_url)
    except httpx.HTTPError:
        return None  # a narrow query or a Big Ten catalog only adds candidates; UMD's full query still answers


def _merge(books: list[dict], index: dict, records: list[dict]) -> None:
    """One entry per book: the UMD record when there is one, listing every Big Ten holder. A book matches by
    OCLC number, or by title, author and year, since libraries often catalog the same book under different
    OCLC numbers (one per format or reprint) or none."""
    for r in records:
        keys = [r["id"], " ".join(re.findall(r"\w+", f"{r['title']} {r['author']} {r['date']}".casefold()))]
        keys += [r["oclc"]] if r["oclc"] else []
        i = next((index[k] for k in keys if k in index), None)
        if i is None:
            i = len(books)
            books.append(r)
        else:
            old = books[i]
            base = r if r["umd"] and not old["umd"] else old
            books[i] = {**base, "btaa": list({b["name"]: b for b in old["btaa"] + r["btaa"]}.values())}
        index |= dict.fromkeys(keys, i)


def _weights(raw: str) -> dict:
    """The user's points per rule, from the relevance settings page; rules left out keep their default."""
    try:
        weights = json.loads(raw)
    except ValueError:
        weights = None
    ok = isinstance(weights, dict) and all(
        k in WEIGHTS and type(v) is int and 0 <= v <= MAX_POINTS for k, v in weights.items()
    )
    if not ok:
        raise HTTPException(422, f"Relevance points must be whole numbers from 0 to {MAX_POINTS}.")
    return weights


@app.get("/search")
async def search(q: str, weights: str = "{}", btaa: bool = False):
    weights = _weights(weights)
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
    # Each Big Ten catalog gets the full query and the first narrow one: enough for the best matches, at
    # 2 requests per library rather than 5.
    libraries = BTAA if btaa else []
    try:
        extra, big_ten, xml = await asyncio.gather(
            asyncio.gather(*map(_optional, narrow)),
            asyncio.gather(*(
                asyncio.gather(*(_optional(cql, lib["base_url"]) for cql in [*narrow[:1], full]))
                for lib in libraries
            )),
            fetch(full),
        )
    except httpx.HTTPError:
        raise HTTPException(502, "The library catalog is not responding. Try again shortly.")
    result = parse_response(xml)
    books, index = [], {}
    for page in [result, *map(parse_response, filter(None, extra))]:
        _merge(books, index, page["records"])
    found = []
    for lib, pages in zip(libraries, big_ten):
        pages = [p and parse_response(p, lib) for p in pages]
        for page in filter(None, pages):
            _merge(books, index, page["records"])
        found.append({"name": lib["name"], "total": pages[-1] and pages[-1]["total"]})  # the full query's count
    ranked = sorted(books, key=lambda r: score(r, searched, weights=weights)["score"], reverse=True)[:SHOWN]
    # shortcut: WorldCat counts only for the shown records (one call each), so its bonus of at most
    # 10 points can't lift a record from below the cut; fetch counts for more if that matters.
    counts = await holding_counts([r["oclc"] for r in ranked if r["oclc"]])
    ranked = [{**r, **score(r, searched, counts.get(r["oclc"]), weights)} for r in ranked]
    ranked.sort(key=lambda r: r["score"], reverse=True)
    body = {"total": result["total"], "records": ranked, "searched": searched}
    return body | {"libraries": found} if btaa else body
