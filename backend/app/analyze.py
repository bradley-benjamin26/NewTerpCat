from functools import cache

import spacy

# Words patrons use to ask for things; they describe the request, not the topic.
GENERIC = {"book", "books", "novel", "novels", "work", "works", "article", "articles", "resources", "material", "materials"}


@cache
def _nlp():
    return spacy.load("en_core_web_sm")


def _skip(token) -> bool:
    return token.is_stop or token.is_punct or token.is_space or token.lower_ in GENERIC


def _text(span) -> str:
    return " ".join(t.text for t in span if not _skip(t))


def _phrases(doc) -> list[list[str]]:
    """Noun phrases to look up, each with fallbacks: "history of the French Revolution", then "French Revolution"."""
    chunks = {c.root.i: c for c in doc.noun_chunks}
    phrases = []
    for chunk in chunks.values():  # live view: sees chunks consumed below
        if chunk is None:
            continue
        spans = [chunk]
        for prep in chunk.root.children:
            if prep.dep_ == "prep" and prep.lower_ == "of":
                for obj in prep.children:
                    if obj.dep_ == "pobj" and chunks.get(obj.i):
                        spans.append(chunks[obj.i])
                        chunks[obj.i] = None  # consumed by this phrase
        texts = [_text(span) for span in spans]
        phrases.append(list(dict.fromkeys(t for t in [" ".join(filter(None, texts)), *texts[1:]] if t)))
    return phrases


def analyze(q: str) -> dict:
    doc = _nlp()(q)
    people = [e.text for e in doc.ents if e.label_ == "PERSON"]
    phrases = _phrases(doc)
    return {
        "keywords": [t.text for t in doc if not _skip(t)],
        "people": people,
        "phrases": [p for p in phrases if p and p[0] not in people],
    }
