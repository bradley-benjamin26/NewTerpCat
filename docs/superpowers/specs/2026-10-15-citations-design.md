# Step 6d: Citations

## Goal

Let a patron cite a book in APA, MLA or Chicago, or export it as RIS, from the item page and from each search
result. On the results page, a patron can select several results and export their citations together.

## Decisions

- **Formatting is ours, in the frontend.** A small `app/citations.ts` builds the three styles and RIS from record
  fields. No citation library (citation-js/CSL is ~1 MB for three book styles) and no external service (Primo's
  cite doesn't cover Big Ten records).
- **Books only.** The catalog returns books; no article or chapter types.
- **First author only.** `author` is MARC 100/110/111. Added authors (700) are not cited and there is no "et al."
- **Edition as cataloged.** MARC 250 $a ("2nd ed.", "Second edition") is used as written, not normalized.
- **No title case conversion for APA.** Cataloged titles are already in sentence case, which APA wants; only the
  first letter after a colon is capitalized.
- **Style picker, one citation shown.** APA is the default; the choice is not remembered.
- **Selection lasts for the current results page only.**

## Backend

`_record` in `app/sru.py` (so both `/search` and `/record`) adds, with trailing punctuation stripped:

| Field       | MARC                     |
|-------------|--------------------------|
| `publisher` | 264 $b, else 260 $b      |
| `place`     | 264 $a, else 260 $a      |
| `edition`   | 250 $a (moved from `_details`) |

Missing values are `null`. The frontend `CatalogRecord` type gains the same three fields.

## Citation rules

`cite(record, style)` returns `{ before, title, after }`: the title is the only italic part, so the component renders
`{before}<i>{title}</i>{after}` without injecting HTML. Missing parts are left out along with their punctuation.

The title's `" : "` (from 245 $a $b) becomes `": "`. MLA and Chicago put the title in title case: capitalize each
word except a, an, the, and, but, or, for, nor, on, at, to, by, of, in, as, unless first, last or after a colon.
Existing capitals are never lowered.

Author "Smith, John Q." (personal names have a comma); a corporate name has no comma and is used as is.

| Style   | Pattern                                                               |
|---------|-----------------------------------------------------------------------|
| APA     | Smith, J. Q. (2010). *Oysters of the bay: A history* (2nd ed.). Penguin. |
| MLA     | Smith, John Q. *Oysters of the Bay: A History*. 2nd ed., Penguin, 2010. |
| Chicago | Smith, John Q. *Oysters of the Bay: A History*. 2nd ed. New York: Penguin, 2010. |

- No author: the citation starts with the title (APA: `*Title* (2nd ed.). (2010). Penguin.`).
- No year: APA `(n.d.)`; MLA and Chicago leave it out.

## RIS

`ris(records)` returns one block per record, lines `TAG  - value` ending in CRLF:

`TY  - BOOK`, `AU` (author), `TI` (title), `ET` (edition), `PB` (publisher), `CY` (place), `PY` (year),
`SN` (one line per ISBN), `UR` (the record's `url`, UMD only), `ER  - `.

Empty fields are left out.

## Frontend

- **`app/Citation.tsx`** (client): a labelled `<select>` (APA, MLA, Chicago), the citation in an `aria-live="polite"`
  region so a style change is read out, a **Copy** button, and a **Download RIS** button (`citation.ris` through a
  Blob link). Copy writes `text/html` (title in `<i>`, escaped) and `text/plain` when `ClipboardItem` exists,
  otherwise plain text; then the live region announces "Copied".
- **Search results:** under each result's request links, a closed `<details>` with summary "Cite" and
  `aria-label="Cite: <title>"` (as the Relevance summary does), holding a `Citation`.
- **Item page:** a "Cite this" section with a heading, holding a `Citation`.
- **Selection:** each result gets a checkbox named "Select *title*", `name="id"`, `value` = record id,
  `form="export"`. `ResultsList` stays a server component.
- **`app/ExportBar.tsx`** (client), above the results list under an "Export citations" heading: the `<form
  id="export">`, a "Select all" checkbox, a live "*n* selected" count, a style picker, **Download RIS**
  (`citations.ris`, the checked records) and **Copy citations** (checked records in the chosen style, sorted by the
  citation text, one per line). It is passed the records and reads the checked ids from the form.
- With nothing selected the buttons stay enabled and the live region says "Select at least one result".
- All controls: visible focus, 24×24 px minimum target (WCAG 2.5.8). Styling follows the frontend-design skill.

## Testing (written first, seen failing)

- pytest: `publisher`, `place`, `edition` from 264 and from 260, and `null` when absent, in search and record results.
- `cite`: each style; no author; corporate author; no year; no edition; no publisher or place; title case rules.
- `ris`: field mapping, CRLF, several ISBNs, empty fields dropped, no `UR` for Big Ten records, several records.
- `Citation`: style change updates the live region; Copy calls the clipboard and announces "Copied"; axe passes.
- `ExportBar`: exports only the checked records; Select all; count announced; empty-selection message; copied text
  sorted; axe passes on the results page.
- Item page and results render tests: the Cite section and summary are present with the right names.
