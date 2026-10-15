from functools import cache

import spacy

# Words patrons use to ask for things; they describe the request, not the topic.
GENERIC = {"book", "books", "novel", "novels", "work", "works", "article", "articles", "resources", "material", "materials"}


@cache
def _nlp():
    return spacy.load("en_core_web_sm")


def _skip(token) -> bool:
    return token.is_stop or token.is_punct or token.is_space or token.lower_ in GENERIC


def analyze(q: str) -> dict:
    doc = _nlp()(q)
    people = [e.text for e in doc.ents if e.label_ == "PERSON"]
    phrases = [" ".join(t.text for t in chunk if not _skip(t)) for chunk in doc.noun_chunks]
    return {
        "keywords": [t.text for t in doc if not _skip(t)],
        "people": people,
        "phrases": list(dict.fromkeys(p for p in phrases if p and p not in people)),
    }
