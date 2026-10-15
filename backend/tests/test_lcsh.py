import asyncio

from app import lcsh

HITS = [
    {"aLabel": "Climate change adaptation", "more": {"variantLabels": ["Climate adaptation"]}},
    {"aLabel": "Climatic changes", "more": {"variantLabels": ["Changes in climate", "Climate change"]}},
]

# Trimmed from id.loc.gov suggest2 for "french revolution".
FRENCH_REVOLUTION = [
    {"aLabel": "French Revolution Bicentennial, 1989", "more": {"variantLabels": ["Bicentennial of the French Revolution, 1989"]}},
    {"aLabel": "Algeria--History--Revolution, 1954-1962--Personal narratives, French", "more": {"variantLabels": []}},
    {"aLabel": "Algeria--History--Revolution, 1954-1962", "more": {"variantLabels": ["French-Algerian War, 1954-1962"]}},
    {"aLabel": "Corsica (France)--History--1789-1794", "more": {"variantLabels": ["Corsica (France)--History--French Revolution, 1789-1793"]}},
    {"aLabel": "France--History--Revolution, 1789-1799", "more": {"variantLabels": ["French Revolution, France, 1789-1799"]}},
]


def test_match_accepts_variant_label_and_returns_authorized_heading():
    assert lcsh.match("climate change", HITS) == ["Climatic changes"]


def test_match_accepts_authorized_label_case_insensitively():
    assert lcsh.match("CLIMATE CHANGE ADAPTATION", HITS) == ["Climate change adaptation"]


def test_match_rejects_single_word_inside_a_longer_heading():
    assert lcsh.match("climate", HITS) == []


def test_match_finds_inverted_subdivided_heading():
    assert lcsh.match("history french revolution", FRENCH_REVOLUTION) == ["France--History--Revolution, 1789-1799"]


def test_match_keeps_equally_close_headings():
    assert lcsh.match("french revolution", FRENCH_REVOLUTION) == [
        "French Revolution Bicentennial, 1989",
        "France--History--Revolution, 1789-1799",
    ]


def test_match_drops_duplicate_headings():
    assert lcsh.match("climate change", HITS + HITS) == ["Climatic changes"]


def test_subjects_reports_matches_per_phrase_and_skips_failures(monkeypatch):
    async def fake_lookup(client, phrase):
        if phrase == "down":
            raise lcsh.httpx.ConnectError("unreachable")
        return HITS

    monkeypatch.setattr(lcsh, "_lookup", fake_lookup)
    found = asyncio.run(lcsh.subjects([["climate change"], ["down"], ["nothing"]]))
    assert found == [{"phrase": "climate change", "headings": ["Climatic changes"]}]


def test_subjects_falls_back_to_narrower_phrase(monkeypatch):
    async def fake_lookup(client, phrase):
        return HITS if phrase == "climate change" else []

    monkeypatch.setattr(lcsh, "_lookup", fake_lookup)
    found = asyncio.run(lcsh.subjects([["history climate change", "climate change"]]))
    assert found == [{"phrase": "climate change", "headings": ["Climatic changes"]}]
