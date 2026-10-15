import asyncio
import re

import httpx
from spacy.lang.en.stop_words import STOP_WORDS

SUGGEST = "https://id.loc.gov/authorities/subjects/suggest2"


def _words(s: str) -> set[str]:
    return set(re.findall(r"[^\W\d_]+", s.casefold())) - STOP_WORDS


def match(phrase: str, hits: list[dict]) -> list[str]:
    """Closest headings that contain every word of the phrase, with fewer extra words than the phrase has."""
    want = _words(phrase)
    scored = []
    for hit in hits:
        variants = map(_words, hit.get("more", {}).get("variantLabels", []))
        # A variant must paraphrase the phrase, not share one stray word ("French-Algerian War").
        labels = [_words(hit["aLabel"]), *(v for v in variants if len(v & want) >= min(2, len(want)))]
        if want <= set().union(*labels):
            extra = min(len(label - want) for label in labels)
            if extra < len(want):
                scored.append((extra, hit["aLabel"]))
    best = min((extra for extra, _ in scored), default=None)
    return list(dict.fromkeys(heading for extra, heading in scored if extra == best))


async def _lookup(client: httpx.AsyncClient, phrase: str) -> list[dict]:
    res = await client.get(SUGGEST, params={"q": phrase, "searchtype": "keyword", "count": 10})
    res.raise_for_status()
    return res.json()["hits"]


async def _first_match(client: httpx.AsyncClient, alternatives: list[str]) -> dict | None:
    for phrase in alternatives:
        try:
            headings = match(phrase, await _lookup(client, phrase))
        except (httpx.HTTPError, ValueError, KeyError):
            continue  # a failed lookup only loses that subject; the search still runs
        if headings:
            return {"phrase": phrase, "headings": headings}
    return None


async def subjects(phrases: list[list[str]]) -> list[dict]:
    """phrases holds alternatives per noun phrase, broadest first; the first one with a heading wins."""
    async with httpx.AsyncClient(timeout=3) as client:
        found = await asyncio.gather(*(_first_match(client, alternatives) for alternatives in phrases))
    return [f for f in found if f]
