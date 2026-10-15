from app.rank import score


def rec(**fields):
    return {"title": "", "author": None, "subjects": [], "holdings": [], "online": False, **fields}


def part(keywords, people=(), headings=(), operator=None):
    subjects = [{"phrase": "x", "headings": list(headings)}] if headings else []
    return {"operator": operator, "keywords": list(keywords), "people": list(people), "subjects": subjects}


def points(record, searched, holdings=None, weights=None):
    result = score(record, searched, holdings, weights)
    rules = {b["rule"]: b["points"] for b in result["breakdown"]}
    assert result["score"] == sum(rules.values())
    assert all(b["label"] for b in result["breakdown"])
    return rules


def test_exact_title_match_ignores_case_stop_words_and_subtitle():
    assert points(rec(title="The great Gatsby"), [part(["great", "Gatsby"])]) == {"exact_title": 100}
    assert points(rec(title="The Great Gatsby : a novel"), [part(["great", "gatsby"])]) == {"exact_title": 100}


def test_several_keywords_in_title():
    found = points(rec(title="Climate change and adaptive governance"), [part(["adaptive", "governance", "climate"])])
    assert found == {"title_words": 30}


def test_exact_phrase_in_title():
    found = points(rec(title="A history of climate change in Maryland"), [part(["climate", "change"])])
    assert found == {"title_words": 30, "phrase": 25}


def test_exact_author_match_handles_inverted_name():
    found = points(rec(author="Morrison, Toni"), [part(["Toni", "Morrison", "Beloved"], people=["Toni Morrison"])])
    assert found == {"exact_author": 90}


def test_keyword_in_author_name():
    assert points(rec(author="Morrison, Toni"), [part(["Morrison", "novels"])]) == {"author_words": 25}


def test_several_subject_headings_match_including_subdivided_ones():
    record = rec(subjects=["Jazz--Maryland--Baltimore", "Jazz musicians"])
    found = points(record, [part(["x"], headings=["Jazz", "Jazz musicians", "Blues (Music)"])])
    assert found == {"subjects_many": 40}


def test_one_subject_heading_matches():
    record = rec(subjects=["Jazzercise", "Jazz"])
    assert points(record, [part(["x"], headings=["Jazz", "Blues (Music)"])]) == {"subjects_few": 10}


def test_keywords_found_in_subjects():
    record = rec(title="Chesapeake Bay survey", subjects=["Oysters"])
    assert points(record, [part(["oysters"])]) == {"keywords_elsewhere": 5}


def test_available_at_umd_in_print_or_online():
    available = [{"location": "Stacks", "call_number": "X", "status": "available"}]
    unavailable = [{"location": "Stacks", "call_number": "X", "status": "unavailable"}]
    assert points(rec(holdings=available), [part(["x"])]) == {"available_umd": 20}
    assert points(rec(online=True), [part(["x"])]) == {"available_umd": 20}
    assert points(rec(holdings=unavailable), [part(["x"])]) == {}


def test_worldcat_holdings_score_two_per_other_library_up_to_ten():
    assert points(rec(), [part(["x"])], holdings=4) == {"holdings": 6}
    assert points(rec(), [part(["x"])], holdings=900) == {"holdings": 10}
    assert points(rec(), [part(["x"])], holdings=1) == {}
    assert points(rec(), [part(["x"])], holdings=None) == {}


def test_excluded_parts_do_not_score():
    searched = [part(["jazz"]), part(["Gatsby"], operator="NOT")]
    assert points(rec(title="Gatsby"), searched) == {}


def test_author_name_words_do_not_count_as_title_words():
    searched = [part(["Toni", "Morrison", "Beloved"], people=["Toni Morrison"])]
    assert points(rec(title="Beloved", author="Morrison, Toni"), searched) == {"exact_title": 100, "exact_author": 90}
    assert points(rec(title="Conversations with Toni Morrison"), searched) == {}


def test_holdings_label_uses_singular_for_one_other_library():
    assert score(rec(), [part(["x"])], holdings=2)["breakdown"][0]["label"] == "Held by 1 other library (WorldCat)"


def test_custom_weights_replace_the_defaults():
    available = [{"location": "Stacks", "call_number": None, "status": "available"}]
    weights = {"exact_title": 7, "available_umd": 0}
    result = score(rec(title="Oysters", holdings=available), [part(["oysters"])], weights=weights)
    assert {b["rule"]: b["points"] for b in result["breakdown"]} == {"exact_title": 7, "available_umd": 0}
    assert result["score"] == 7


def test_holdings_bonus_counts_up_to_five_other_libraries_at_any_weight():
    assert score(rec(), [part(["x"])], holdings=900, weights={"holdings": 3})["score"] == 15


def test_an_exact_rule_set_to_zero_lets_the_partial_rules_score():
    off = {"exact_title": 0, "exact_author": 0, "subjects_many": 0}
    record = rec(title="Climate change", author="Smith, Ann", subjects=["Oysters", "Clams"])
    searched = [part(["climate", "change", "ann", "smith"], people=["Ann Smith"], headings=["Oysters", "Clams"])]
    assert points(record, searched, weights=off) == {"title_words": 30, "phrase": 25, "author_words": 25, "subjects_few": 10}
