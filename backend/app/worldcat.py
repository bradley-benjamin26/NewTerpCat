import asyncio
import os
import time

import httpx

TOKEN_URL = "https://oauth.oclc.org/token"
# One OCLC number per call: the API reads "1,2" as the single number 12.
SUMMARY_URL = "https://americas.discovery.api.oclc.org/worldcat/search/v2/bibs-summary-holdings"
_token = {"value": "", "expires": 0.0}
# Holdings counts barely change within a day; cache them so repeat searches skip WorldCat.
CACHE_SECONDS = 24 * 3600
CACHE_MAX = 5000
_counts: dict[str, tuple[int, float]] = {}  # OCLC number -> (count, expires)


async def _access_token(client: httpx.AsyncClient) -> str:
    if time.monotonic() < _token["expires"]:
        return _token["value"]
    res = await client.post(
        TOKEN_URL,
        auth=(os.environ["OCLC_CLIENT_ID"], os.environ["OCLC_CLIENT_SECRET"]),
        data={"grant_type": "client_credentials", "scope": "wcapi:view_summary_holdings"},
    )
    res.raise_for_status()
    body = res.json()
    _token.update(value=body["access_token"], expires=time.monotonic() + body["expires_in"] - 60)
    return _token["value"]


async def _count(client: httpx.AsyncClient, oclc: str) -> int | None:
    res = await client.get(SUMMARY_URL, params={"oclcNumber": oclc})
    res.raise_for_status()
    records = res.json().get("briefRecords") or [{}]
    return records[0].get("institutionHolding", {}).get("totalHoldingCount")


async def holding_counts(oclc_numbers: list[str]) -> dict[str, int]:
    """Libraries worldwide holding each OCLC number. Empty without credentials; a failed lookup is left out."""
    if not os.environ.get("OCLC_CLIENT_ID"):
        return {}
    now = time.monotonic()
    found = {n: _counts[n][0] for n in oclc_numbers if n in _counts and _counts[n][1] > now}
    missing = [n for n in oclc_numbers if n not in found]
    if not missing:
        return found
    async with httpx.AsyncClient(timeout=2) as client:
        try:
            client.headers["Authorization"] = f"Bearer {await _access_token(client)}"
        except (httpx.HTTPError, KeyError, ValueError):
            return found
        counts = await asyncio.gather(*(_count(client, n) for n in missing), return_exceptions=True)
    if len(_counts) > CACHE_MAX:
        _counts.clear()  # shortcut: drops everything at the cap rather than the oldest; fine at this size
    for n, c in zip(missing, counts):
        if isinstance(c, int):
            found[n] = c
            _counts[n] = (c, now + CACHE_SECONDS)
    return found
