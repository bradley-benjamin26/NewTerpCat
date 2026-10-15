from app.analyze import analyze


def test_drops_stop_words_and_generic_request_words():
    a = analyze("books about the history of slavery")
    assert a["keywords"] == ["history", "slavery"]


def test_finds_possible_authors():
    assert analyze("novels by Toni Morrison")["people"] == ["Toni Morrison"]


def test_noun_phrases_become_subject_candidates_without_people():
    a = analyze("climate change in coastal cities by Toni Morrison")
    assert "climate change" in a["phrases"]
    assert "coastal cities" in a["phrases"]
    assert "Toni Morrison" not in a["phrases"]
