# Step 6a: Item page

## Goal

Give every search result its own page with the full details of the book: where to find it, its call number,
publication details, subjects, contents and notes. The page has a stable URL that survives a reload and can be
bookmarked or shared. It is the base that 6b (requesting), 6c (covers), 6d (citations) and 6e (favorites) build on.

## Decisions

- **Data comes from the catalog, not the search page.** A new endpoint looks the record up by ID, so the page
  works when opened directly.
- **Big Ten-only books get an item page too.** The page shows only the library the record came from. Other Big
  Ten holders are found during a search and are not shown on a directly opened page; 6b can look them up by OCLC
  number when it needs them.
- **Result titles link to the item page** (`/item/<id>`) instead of the Alma page. The Alma page is linked from
  the item page for UMD records.
- **No relevance score or WorldCat count** on the item page: both only mean something within a search.

## Backend

### `app/sru.py`
- `_details(rec)` reads the extra fields from a MARC record. Each is `None` or `[]` when missing; trailing
  punctuation is trimmed as in `_record`.

  | Field          | Type        | MARC                                            |
  |----------------|-------------|-------------------------------------------------|
  | `publication`  | str or None | 264 (or 260) $a $b $c, joined                   |
  | `edition`      | str or None | 250 $a                                          |
  | `description`  | str or None | 300 $a $b $c                                    |
  | `series`       | str or None | 490 $a $v                                       |
  | `isbns`        | list[str]   | every 020 $a                                    |
  | `contributors` | list[str]   | every 700 $a $b and 710 $a $b                   |
  | `summary`      | str or None | 520 $a                                          |
  | `contents`     | list[str]   | 505 $a split on ` -- `                          |
  | `notes`        | list[str]   | every 500 $a and 504 $a                         |

- `record(xml, library=None)` returns the first record in an SRU response as `_record(...) | _details(...)`,
  or `None` when the response has no records.

### `app/main.py`
- `GET /record/{id}`:
  - `id` is `<digits>` for UMD or `<key>:<digits>` for a Big Ten library, the same IDs `/search` returns.
  - The digits must be all digits and the key one of the `BTAA` keys; anything else is a 404. This is the check
    that keeps user input out of the CQL query.
  - One SRU call, `alma.mms_id=<digits>`, to UMD or that library's base URL.
  - No record: 404 `"We couldn't find that record."` Catalog error: 502 with the search page's message.
  - A Big Ten record keeps the `id` it was asked for (`rutgers:991234`), as `_record` already builds it.

## Frontend

### Route `app/item/[id]/page.tsx`
- Server component. Fetches `${API_URL}/record/<id>` (no cache, 20 s timeout).
- Page title: `<book title> – NewTerpCat`.
- 404 from the API: Next's `notFound()` with the message "We couldn't find that record. It may have been
  removed from the catalog. Search again above." Other failures: the search page's "The library catalog is not
  responding. Try again shortly." in a `role="alert"` paragraph.

### Layout (single column, left aligned, text at most ~42rem)

```
[ Search box, as on the results page ]

h1  Title
p   Author, year

h2  Where to find it     ← box: 4px UMD-red left rule, plain border elsewhere
    Available at UMD: McKeldin Library
      SH371 .K44 2020    ← call number ~1.4rem, semibold, tabular figures
    Available online
    Open in the UMD catalog   (UMD records only)

h2  Summary
h2  Details              ← <dl>, two columns, one column on phones:
                            Published, Edition, Description, Series, ISBN, Other authors
h2  Subjects             ← list of LCSH headings
h2  Contents             ← list
h2  Notes                ← list
```

- Availability wording reuses the results list's statuses. A Big Ten-only record reads "Not held at UMD.
  <Library> has a copy: request it through interlibrary loan." (or "… has it, but no copy is available right
  now."). The request button comes in 6b.
- A section with no data is left out, as is a `<dt>` with no value.
- Visual style: the app's existing tokens (system font, `--accent` UMD red, `--focus`, dark mode). The call
  number is the one typographic standout. No cards, eyebrow labels or extra colors.

### Results list
- Each result title links to `/item/<encoded id>`.

## Accessibility
- Heading order h1 → h2, so screen reader users can jump between sections; "Where to find it" comes right after
  the title in source order.
- Details in a `<dl>`; errors in `role="alert"`; existing focus ring and dark-mode contrast.
- axe check on the rendered page in tests.

## Out of scope
- "Back to results" link (browser back works; the URL does not carry the query).
- Subject headings as links to a new search.
- Language (needs a code-to-name table).
- Other Big Ten holders on a directly opened page (6b).

## Testing
- **pytest:** `_details` against a fixture record with every field and one with none; `/record` for a UMD ID
  and a Big Ten ID with the SRU call mocked; 404 for an unknown library key, a non-numeric ID and an empty
  response; 502 when the catalog fails.
- **Vitest + Testing Library + axe:** the page renders title, availability, call number and details from a
  mocked API; empty sections are left out; Big Ten-only wording; 404 and catalog-error states; result titles
  link to `/item/<id>`; no axe violations.
