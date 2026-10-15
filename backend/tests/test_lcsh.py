import asyncio

from app import lcsh

HITS = [
    {"aLabel": "Climate change adaptation", "more": {"variantLabels": ["Climate adaptation"]}},
    {"aLabel": "Climatic changes", "more": {"variantLabels": ["Changes in climate", "Climate change"]}},
]


def test_match_accepts_variant_label_and_returns_authorized_heading():
    assert lcsh.match("climate change", HITS) == "Climatic changes"


def test_match_accepts_authorized_label_case_insensitively():
    assert lcsh.match("CLIMATE CHANGE ADAPTATION", HITS) == "Climate change adaptation"


def test_match_rejects_partial_matches():
    assert lcsh.match("climate", HITS) is None


def test_subjects_skips_failed_lookups_and_dedupes(monkeypatch):
    async def fake_lookup(client, phrase):
        if phrase == "down":
            raise lcsh.httpx.ConnectError("unreachable")
        return HITS

    monkeypatch.setattr(lcsh, "_lookup", fake_lookup)
    found = asyncio.run(lcsh.subjects(["climate change", "down", "Climate change", "nothing"]))
    assert found == ["Climatic changes"]
