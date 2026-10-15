from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import main

FIXTURE = (Path(__file__).parent / "fixtures" / "sru_umd_print.xml").read_bytes()


@pytest.fixture(autouse=True)
def offline_lcsh(monkeypatch):
    async def no_subjects(phrases):
        return []

    monkeypatch.setattr(main, "subjects", no_subjects)


def test_search_returns_parsed_records(monkeypatch):
    seen = {}

    async def fake_fetch(q):
        seen["q"] = q
        return FIXTURE

    monkeypatch.setattr(main, "fetch", fake_fetch)
    res = TestClient(main.app).get("/search", params={"q": "oysters"})
    assert res.status_code == 200
    assert seen["q"] == 'alma.all_for_ui="oysters"'
    assert res.json()["records"][0]["title"].startswith("Monitoring")


def test_search_rejects_blank_query():
    assert TestClient(main.app).get("/search", params={"q": "  "}).status_code == 422


def test_search_reports_catalog_outage(monkeypatch):
    async def down(q):
        raise main.httpx.ConnectError("unreachable")

    monkeypatch.setattr(main, "fetch", down)
    res = TestClient(main.app).get("/search", params={"q": "oysters"})
    assert res.status_code == 502


def test_search_reports_what_was_searched(monkeypatch):
    seen = {}

    async def fake_fetch(cql):
        seen["cql"] = cql
        return FIXTURE

    async def fake_subjects(phrases):
        seen["phrases"] = phrases
        return ["Climatic changes"]

    monkeypatch.setattr(main, "fetch", fake_fetch)
    monkeypatch.setattr(main, "subjects", fake_subjects)
    res = TestClient(main.app).get("/search", params={"q": "books about climate change by Toni Morrison"})
    assert res.status_code == 200
    assert "climate change" in seen["phrases"]
    assert res.json()["searched"] == {
        "keywords": ["climate", "change", "Toni", "Morrison"],
        "subjects": ["Climatic changes"],
        "people": ["Toni Morrison"],
    }
    assert 'alma.subjects="Climatic changes"' in seen["cql"]


def test_search_falls_back_to_raw_query_when_only_stop_words(monkeypatch):
    seen = {}

    async def fake_fetch(cql):
        seen["cql"] = cql
        return FIXTURE

    monkeypatch.setattr(main, "fetch", fake_fetch)
    TestClient(main.app).get("/search", params={"q": "The Who"})
    assert seen["cql"] == 'alma.all_for_ui="The Who"'
