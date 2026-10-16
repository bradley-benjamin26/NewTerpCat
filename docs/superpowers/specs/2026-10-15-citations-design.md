# Step 6d: Citations

## Goal

Let a patron cite a book in APA, MLA or Chicago, or export it as RIS, from the item page and from each search
result. On the results page, a patron can select several results and export their citations together.

## Decisions

- **Formatting is ours, in the frontend.** A small `app/citations.ts` builds the three styles and RIS from record
  fields. No citation library (citation-js/CSL is ~1 MB for three book styles) and no external service (Primo's
  cite doesn't cover Big Ten records).
- **Books only.** The catalog returns books; no article or chapter types.
- **Authors are the main entry plus added personal authors.** A 700 counts as an author when it has no relator
  ($e, $4) or its relator is "author" / `aut`; editors, translators and illustrators are not cited. Each style
  then lists or shortens the authors by its own rule (see Citation rules).
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
| `authors`   | `author` (100/110/111 $a $b), then each author 700 $a $b, in record order |

Missing values are `null`; `authors` is `[]` when there is none. The frontend `CatalogRecord` type gains the same
four fields.

## Citation rules

`cite(record, style)` returns `{ before, title, after }`: the title is the only italic part, so the component renders
`{before}<i>{title}</i>{after}` without injecting HTML. Missing parts are left out along with their punctuation.

The title's `" : "` (from 245 $a $b) becomes `": "`. MLA and Chicago put the title in title case: capitalize each
word except a, an, the, and, but, or, for, nor, on, at, to, by, of, in, as, unless first, last or after a colon.
Existing capitals are never lowered.

Names come from `authors`. A personal name is "Smith, John Q." (it has a comma); a corporate name has no comma and
is used as is in every position. "Not inverted" means "John Q. Smith" (split at the first comma).

| Authors | APA                                   | MLA                              | Chicago                                     |
|---------|---------------------------------------|----------------------------------|---------------------------------------------|
| 1       | Smith, J. Q.                          | Smith, John Q.                   | Smith, John Q.                              |
| 2       | Smith, J. Q., & Jones, A.             | Smith, John Q., and Anna Jones   | Smith, John Q., and Anna Jones              |
| 3       | Smith, J. Q., Jones, A., & Lee, K.    | Smith, John Q., et al.           | Smith, John Q., Anna Jones, and Kim Lee     |
| 3–10    | all, last after "&"                   | first, et al.                    | all, last after "and"                       |
| 11–20   | all, last after "&"                   | first, et al.                    | first seven, then "et al."                  |
| 21+     | first 19, "…", last author            | first, et al.                    | first seven, then "et al."                  |

APA never uses "et al." in a reference list (APA 7 §9.8); MLA 9 shortens at three; Chicago 17 (§14.76) at eleven.
Only the first author is inverted in MLA and Chicago; every APA author is "Last, I."

| Style   | Pattern                                                               |
|---------|-----------------------------------------------------------------------|
| APA     | Smith, J. Q. (2010). *Oysters of the bay: A history* (2nd ed.). Penguin. |
| MLA     | Smith, John Q. *Oysters of the Bay: A History*. 2nd ed., Penguin, 2010. |
| Chicago | Smith, John Q. *Oysters of the Bay: A History*. 2nd ed. New York: Penguin, 2010. |

- No author: the citation starts with the title (APA: `*Title* (2nd ed.). (2010). Penguin.`).
- No year: APA `(n.d.)`; MLA and Chicago leave it out.

## RIS

`ris(records)` returns one block per record, lines `TAG  - value` ending in CRLF:

`TY  - BOOK`, `AU` (one line per author, never shortened), `TI` (title), `ET` (edition), `PB` (publisher), `CY` (place), `PY` (year),
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

- pytest: `publisher`, `place`, `edition` from 264 and from 260, and `null` when absent, in search and record results;
  `authors` keeps 700s with no relator or "author"/`aut`, drops editors and translators, `[]` with no author.
- `cite`: each style; no author; corporate author; no year; no edition; no publisher or place; title case rules;
  author lists at 1, 2, 3, 11 and 21 authors in each style.
- `ris`: field mapping, CRLF, several ISBNs, empty fields dropped, no `UR` for Big Ten records, several records.
- `Citation`: style change updates the live region; Copy calls the clipboard and announces "Copied"; axe passes.
- `ExportBar`: exports only the checked records; Select all; count announced; empty-selection message; copied text
  sorted; axe passes on the results page.
- Item page and results render tests: the Cite section and summary are present with the right names.
