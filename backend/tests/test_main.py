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


@pytest.fixture(autouse=True)
def offline_worldcat(monkeypatch):
    async def no_counts(oclc_numbers):
        return {}

    monkeypatch.setattr(main, "holding_counts", no_counts)


def test_search_returns_parsed_records(monkeypatch):
    seen = {}

    async def fake_fetch(q):
        seen["q"] = q
        return FIXTURE

    monkeypatch.setattr(main, "fetch", fake_fetch)
    res = TestClient(main.app).get("/search", params={"q": "oysters"})
    assert res.status_code == 200
    assert seen["q"] == 'alma.all_for_ui all "oysters"'
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
        return [{"phrase": "climate change", "headings": ["Climatic changes"]}]

    monkeypatch.setattr(main, "fetch", fake_fetch)
    monkeypatch.setattr(main, "subjects", fake_subjects)
    res = TestClient(main.app).get("/search", params={"q": "books about climate change by Toni Morrison"})
    assert res.status_code == 200
    assert ["climate change"] in seen["phrases"]
    assert res.json()["searched"] == [
        {
            "operator": None,
            "keywords": ["climate", "change", "Toni", "Morrison"],
            "subjects": [{"phrase": "climate change", "headings": ["Climatic changes"]}],
            "people": ["Toni Morrison"],
        }
    ]
    assert 'alma.subjects="Climatic changes"' in seen["cql"]


def test_search_falls_back_to_raw_query_when_only_stop_words(monkeypatch):
    seen = {}

    async def fake_fetch(cql):
        seen["cql"] = cql
        return FIXTURE

    monkeypatch.setattr(main, "fetch", fake_fetch)
    TestClient(main.app).get("/search", params={"q": "The Who"})
    assert seen["cql"] == 'alma.all_for_ui all "The Who"'


def test_uppercase_and_splits_the_query_into_required_parts(monkeypatch):
    seen = {}

    async def fake_fetch(cql):
        seen["cql"] = cql
        return FIXTURE

    monkeypatch.setattr(main, "fetch", fake_fetch)
    res = TestClient(main.app).get("/search", params={"q": "the french revolution AND the economy"})
    assert [p["keywords"] for p in res.json()["searched"]] == [["french", "revolution"], ["economy"]]
    assert seen["cql"] == 'alma.all_for_ui all "french revolution" AND alma.all_for_ui all "economy"'


def test_lowercase_and_is_an_ordinary_word(monkeypatch):
    async def fake_fetch(cql):
        return FIXTURE

    monkeypatch.setattr(main, "fetch", fake_fetch)
    res = TestClient(main.app).get("/search", params={"q": "salt and pepper"})
    assert [p["keywords"] for p in res.json()["searched"]] == [["salt", "pepper"]]


def test_or_and_not_are_boolean(monkeypatch):
    seen = {}

    async def fake_fetch(cql):
        seen["cql"] = cql
        return FIXTURE

    monkeypatch.setattr(main, "fetch", fake_fetch)
    res = TestClient(main.app).get("/search", params={"q": "jazz OR oysters NOT blues"})
    assert [(p["operator"], p["keywords"]) for p in res.json()["searched"]] == [
        (None, ["jazz"]),
        ("OR", ["oysters"]),
        ("NOT", ["blues"]),
    ]
    assert seen["cql"] == 'alma.all_for_ui all "jazz" OR alma.all_for_ui all "oysters" NOT alma.all_for_ui all "blues"'


def test_excluded_part_skips_subject_lookup(monkeypatch):
    looked_up = []

    async def fake_subjects(phrases):
        looked_up.extend(phrases)
        return []

    async def fake_fetch(cql):
        return FIXTURE

    monkeypatch.setattr(main, "subjects", fake_subjects)
    monkeypatch.setattr(main, "fetch", fake_fetch)
    TestClient(main.app).get("/search", params={"q": "jazz NOT blues"})
    assert ["blues"] not in looked_up


def test_only_exclusions_is_rejected_with_a_hint():
    res = TestClient(main.app).get("/search", params={"q": "NOT blues"})
    assert res.status_code == 422
    assert "jazz NOT blues" in res.json()["detail"]


def test_operators_need_words_between_them():
    res = TestClient(main.app).get("/search", params={"q": "jazz OR NOT rock"})
    assert res.status_code == 422
    assert "between AND, OR and NOT" in res.json()["detail"]


def test_leading_and_is_ignored(monkeypatch):
    seen = {}

    async def fake_fetch(cql):
        seen["cql"] = cql
        return FIXTURE

    monkeypatch.setattr(main, "fetch", fake_fetch)
    TestClient(main.app).get("/search", params={"q": "AND jazz"})
    assert seen["cql"] == 'alma.all_for_ui all "jazz"'


def test_all_caps_query_has_no_operators(monkeypatch):
    seen = {}

    async def fake_fetch(cql):
        seen["cql"] = cql
        return FIXTURE

    monkeypatch.setattr(main, "fetch", fake_fetch)
    res = TestClient(main.app).get("/search", params={"q": "TO BE OR NOT TO BE"})
    assert res.status_code == 200
    assert seen["cql"] == 'alma.all_for_ui all "TO BE OR NOT TO BE"'


def test_overlong_query_is_rejected_before_any_lookup(monkeypatch):
    async def must_not_run(*args):
        raise AssertionError("no lookups for a rejected query")

    monkeypatch.setattr(main, "subjects", must_not_run)
    monkeypatch.setattr(main, "fetch", must_not_run)
    res = TestClient(main.app).get("/search", params={"q": " AND ".join(["jazz"] * 100)})
    assert res.status_code == 422
    assert "shorter" in res.json()["detail"]


ELECTRONIC = (Path(__file__).parent / "fixtures" / "sru_umd.xml").read_bytes()


def test_results_are_pooled_ranked_and_explained(monkeypatch):
    sent = []

    async def fake_fetch(cql):
        sent.append(cql)
        return FIXTURE if cql.startswith("alma.title") else ELECTRONIC

    async def fake_counts(oclc_numbers):
        return {"29201900": 3}

    monkeypatch.setattr(main, "fetch", fake_fetch)
    monkeypatch.setattr(main, "holding_counts", fake_counts)
    body = TestClient(main.app).get("/search", params={"q": "oysters"}).json()
    assert sent == ['alma.title all "oysters"', 'alma.all_for_ui all "oysters"']
    assert body["total"] == 505  # from the full query
    assert len(body["records"]) == 4  # 3 + 1, no duplicates
    top = body["records"][0]
    assert top["id"] == "990020965100108238"  # in print, available, and held elsewhere
    assert {b["rule"]: b["points"] for b in top["breakdown"]} == {
        "keywords_elsewhere": 5,
        "available_umd": 20,
        "holdings": 4,
    }
    assert top["score"] == 29
    scores = [r["score"] for r in body["records"]]
    assert scores == sorted(scores, reverse=True)


def test_failed_narrow_query_keeps_the_full_results(monkeypatch):
    async def fake_fetch(cql):
        if cql.startswith("alma.title"):
            raise main.httpx.ConnectError("unreachable")
        return ELECTRONIC

    monkeypatch.setattr(main, "fetch", fake_fetch)
    res = TestClient(main.app).get("/search", params={"q": "oysters"})
    assert res.status_code == 200
    assert len(res.json()["records"]) == 3


def test_custom_weights_change_the_scores(monkeypatch):
    async def fake_fetch(cql):
        return ELECTRONIC

    monkeypatch.setattr(main, "fetch", fake_fetch)
    body = TestClient(main.app).get("/search", params={"q": "oysters", "weights": '{"keywords_elsewhere": 50}'}).json()
    rules = {b["rule"]: b["points"] for r in body["records"] for b in r["breakdown"]}
    assert rules["keywords_elsewhere"] == 50
    assert rules["available_umd"] == 20  # rules left out keep their default


@pytest.mark.parametrize("weights", ["not json", "[]", '{"bogus": 1}', '{"exact_title": -1}', '{"exact_title": 201}', '{"exact_title": 2.5}', '{"exact_title": true}'])
def test_invalid_weights_are_rejected(weights):
    res = TestClient(main.app).get("/search", params={"q": "oysters", "weights": weights})
    assert res.status_code == 422
