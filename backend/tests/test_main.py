from pathlib import Path

from fastapi.testclient import TestClient

from app import main

FIXTURE = (Path(__file__).parent / "fixtures" / "sru_umd_print.xml").read_bytes()


def test_search_returns_parsed_records(monkeypatch):
    seen = {}

    async def fake_fetch(q):
        seen["q"] = q
        return FIXTURE

    monkeypatch.setattr(main, "fetch", fake_fetch)
    res = TestClient(main.app).get("/search", params={"q": "oysters"})
    assert res.status_code == 200
    assert seen["q"] == "oysters"
    assert res.json()["records"][0]["title"].startswith("Monitoring")


def test_search_rejects_blank_query():
    assert TestClient(main.app).get("/search", params={"q": "  "}).status_code == 422


def test_search_reports_catalog_outage(monkeypatch):
    async def down(q):
        raise main.httpx.ConnectError("unreachable")

    monkeypatch.setattr(main, "fetch", down)
    res = TestClient(main.app).get("/search", params={"q": "oysters"})
    assert res.status_code == 502
