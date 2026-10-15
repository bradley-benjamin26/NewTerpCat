import re

from spacy.lang.en.stop_words import STOP_WORDS

# Default points from specDocuments/queryWorkflow.md.
WEIGHTS = {
    "exact_title": 100,
    "exact_author": 90,
    "subjects_many": 40,
    "title_words": 30,
    "author_words": 25,
    "phrase": 25,
    "subjects_few": 10,
    "keywords_elsewhere": 5,
    "available_umd": 20,
    "holdings": 2,  # per other library, up to HOLDINGS_MAX
}
HOLDINGS_MAX = 10


def _words(s: str) -> list[str]:
    return [w for w in re.findall(r"[^\W_]+", s.casefold()) if w not in STOP_WORDS]


def _contains(words: list[str], phrase: list[str]) -> bool:
    n = len(phrase)
    return any(words[i : i + n] == phrase for i in range(len(words) - n + 1))


def score(record: dict, searched: list[dict], holdings: int | None = None) -> dict:
    """Points for each relevancy rule the record meets, from the parts of the query it should match."""
    parts = [p for p in searched if p["operator"] != "NOT"]
    queries = [_words(" ".join(p["keywords"])) for p in parts]
    keywords = set().union(*queries)
    # A typed author name says who wrote it, not what the title is: "Toni Morrison beloved".
    names = set(_words(" ".join(p for part in parts for p in part["people"])))
    queries = [[w for w in q if w not in names] or q for q in queries]
    title = _words(record["title"])
    author = _words(record["author"] or "")
    subjects = [s.casefold() for s in record["subjects"]]
    headings = {h for p in parts for s in p["subjects"] for h in s["headings"]}
    matched = [h for h in headings if any(s == h.casefold() or s.startswith(h.casefold() + "--") for s in subjects)]
    in_title = set().union(*queries) & set(title)
    breakdown = []

    def add(rule: str, label: str, points: int | None = None):
        breakdown.append({"rule": rule, "label": label, "points": WEIGHTS[rule] if points is None else points})

    if any(q in (title, _words(record["title"].split(":")[0])) for q in queries):
        add("exact_title", "Exact title match")
    else:
        if len(in_title) >= 2:
            add("title_words", f"{len(in_title)} search words in the title")
        if any(len(q) >= 2 and _contains(title, q) for q in queries):
            add("phrase", "Search words appear together in the title")
    if author and any(sorted(_words(p)) == sorted(author) for part in parts for p in part["people"]):
        add("exact_author", "Exact author match")
    elif keywords & set(author):
        add("author_words", "Search words in the author's name")
    if len(matched) >= 2:
        add("subjects_many", f"Subject headings match: {'; '.join(sorted(matched))}")
    elif matched:
        add("subjects_few", f"Subject heading matches: {matched[0]}")
    if keywords & set(_words(" ".join(subjects))):
        add("keywords_elsewhere", "Search words in the subjects")
    if record["online"] or any(h["status"] == "available" for h in record["holdings"]):
        add("available_umd", "Available at UMD")
    if holdings and holdings > 1:
        bonus = min(HOLDINGS_MAX, WEIGHTS["holdings"] * (holdings - 1))
        others = holdings - 1
        add("holdings", f"Held by {others:,} other {'library' if others == 1 else 'libraries'} (WorldCat)", bonus)
    return {"score": sum(b["points"] for b in breakdown), "breakdown": breakdown}
