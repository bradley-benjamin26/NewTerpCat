import asyncio

import httpx

from app import worldcat


def test_no_credentials_skips_worldcat(monkeypatch):
    monkeypatch.delenv("OCLC_CLIENT_ID", raising=False)

    async def must_not_run(*args):
        raise AssertionError("called WorldCat without credentials")

    monkeypatch.setattr(worldcat, "_access_token", must_not_run)
    assert asyncio.run(worldcat.holding_counts(["1"])) == {}


def test_counts_holdings_and_skips_failed_lookups(monkeypatch):
    monkeypatch.setattr(worldcat, "_counts", {})
    monkeypatch.setenv("OCLC_CLIENT_ID", "id")
    monkeypatch.setenv("OCLC_CLIENT_SECRET", "secret")

    async def fake_token(client):
        return "token"

    async def fake_count(client, oclc):
        if oclc == "2":
            raise httpx.ConnectError("down")
        return {"1": 82, "3": None}[oclc]

    monkeypatch.setattr(worldcat, "_access_token", fake_token)
    monkeypatch.setattr(worldcat, "_count", fake_count)
    assert asyncio.run(worldcat.holding_counts(["1", "2", "3"])) == {"1": 82}


def test_token_failure_skips_worldcat(monkeypatch):
    monkeypatch.setenv("OCLC_CLIENT_ID", "id")
    monkeypatch.setenv("OCLC_CLIENT_SECRET", "secret")

    async def no_token(client):
        raise httpx.ConnectError("down")

    monkeypatch.setattr(worldcat, "_access_token", no_token)
    assert asyncio.run(worldcat.holding_counts(["1"])) == {}


def test_counts_are_cached_so_repeat_searches_skip_worldcat(monkeypatch):
    monkeypatch.setenv("OCLC_CLIENT_ID", "id")
    monkeypatch.setenv("OCLC_CLIENT_SECRET", "secret")
    monkeypatch.setattr(worldcat, "_counts", {})
    looked_up = []

    async def fake_token(client):
        return "token"

    async def fake_count(client, oclc):
        looked_up.append(oclc)
        return 7

    monkeypatch.setattr(worldcat, "_access_token", fake_token)
    monkeypatch.setattr(worldcat, "_count", fake_count)
    assert asyncio.run(worldcat.holding_counts(["1"])) == {"1": 7}
    assert asyncio.run(worldcat.holding_counts(["1", "2"])) == {"1": 7, "2": 7}
    assert looked_up == ["1", "2"]
