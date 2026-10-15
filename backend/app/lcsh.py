import asyncio

import httpx

SUGGEST = "https://id.loc.gov/authorities/subjects/suggest2"


def match(phrase: str, hits: list[dict]) -> str | None:
    """Authorized heading whose label or variant equals the phrase, so only verified terms are added."""
    p = phrase.casefold()
    for hit in hits:
        labels = [hit["aLabel"], *hit.get("more", {}).get("variantLabels", [])]
        if p in (label.casefold() for label in labels):
            return hit["aLabel"]
    return None


async def _lookup(client: httpx.AsyncClient, phrase: str) -> list[dict]:
    res = await client.get(SUGGEST, params={"q": phrase, "searchtype": "keyword", "count": 10})
    res.raise_for_status()
    return res.json()["hits"]


async def subjects(phrases: list[str]) -> list[str]:
    async with httpx.AsyncClient(timeout=3) as client:
        results = await asyncio.gather(*(_lookup(client, p) for p in phrases), return_exceptions=True)
    # A failed lookup only loses that subject; the search still runs.
    found = [match(p, hits) for p, hits in zip(phrases, results) if isinstance(hits, list)]
    return list(dict.fromkeys(s for s in found if s))
