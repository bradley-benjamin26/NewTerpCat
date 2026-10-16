# Step 6c: Covers

## Goal

Show the book's cover on each search result and on the item page, as `specDocuments/userInterface.md` asks.

## Decisions

- **Syndetics first, then Open Library.** On six recent scholarly ISBNs, Syndetics (through the Ex Libris proxy)
  had all six covers; Open Library had two and returned 502 on two. Open Library is the fallback.
- **The browser loads covers straight from the sources.** No proxy through our backend, as in UMD's Primo.
- **ISBN only.** No cover lookup by OCLC number.
- **Decorative image.** The title sits beside the cover and names the book, so `alt=""` (WCAG 1.1.1). A screen
  reader doesn't hear "cover of …" before every result.

## Sources

The first ISBN, without its qualifier (`"9780143127550 (paperback)"` → `9780143127550`), as in `requests.ts`.

| Order | URL                                                                                              | No cover                       |
|-------|--------------------------------------------------------------------------------------------------|--------------------------------|
| 1     | `https://proxy-na.hosted.exlibrisgroup.com/exl_rewrite/syndetics.com/index.php?client=primo&isbn={isbn}/SC.JPG` | 200 with a 100×100 placeholder |
| 2     | `https://covers.openlibrary.org/b/isbn/{isbn}-M.jpg?default=false`                               | 404                            |

A loaded image that is square (`naturalWidth === naturalHeight`) is the Syndetics placeholder; real covers are taller than wide.

## Backend

`sru.py`: `isbns` moves from `_details` to `_record`, so `/search` records carry it too. Merged copies keep the
kept record's ISBNs (`_merge` already keeps the UMD record's fields).

## Frontend

- `app/Cover.tsx` (client component): `<Cover isbns={…} />`. Renders nothing with no ISBN. Shows Syndetics; on
  error or a square image switches to Open Library; on a second failure renders nothing. `alt=""`,
  `loading="lazy"`, fixed width so the page doesn't jump.
- Search results: a small cover (about 60 px wide) left of each result; above it on narrow screens.
- Item page: a larger cover (about 120 px wide) beside the title block.
- `CatalogRecord` gains `isbns: string[]`. Styling follows the frontend-design skill.

## Testing (written first, seen failing)

- Backend: parsed search records include `isbns`.
- `Cover`: Syndetics URL first; an error or square load switches to Open Library; a second failure renders
  nothing; no ISBN renders nothing; the qualifier is stripped; axe passes.
- Results list and item page render a cover for a record with an ISBN.
