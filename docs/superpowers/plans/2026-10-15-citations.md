# Citations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cite a book in APA, MLA or Chicago, or export it as RIS, from each search result and the item page, and
export the citations of several selected results at once.

**Architecture:** The backend adds `publisher`, `place`, `edition` and `authors` to every parsed record. A pure
module, `app/citations.ts`, formats citations and RIS. A client `Citation` component (style picker, Copy, Download
RIS) goes under each result and on the item page. A client `ExportBar` above the results exports the records whose
checkboxes (tied to its form with `form="export"`) are checked; `ResultsList` stays a server component.

**Tech Stack:** FastAPI + pytest (backend, `uv run pytest`), Next.js 16 + Vitest + Testing Library + axe (frontend,
`npm test`, types with `npx tsc --noEmit`).

**Spec:** `docs/superpowers/specs/2026-10-15-citations-design.md`

## Global Constraints

- Styles: APA 7, MLA 9, Chicago 17 (notes-bibliography, bibliography entry). Books only.
- Author lists per style exactly as the spec's table (APA: all to 20, 21+ = first 19, "…", last; MLA: 3+ = first,
  et al.; Chicago: all to 10, 11+ = first seven, et al.). RIS never shortens.
- 700 counts as an author when it has no $e/$4, or $e starts with "author" / $4 is `aut`.
- RIS lines: `TAG  - value` + `\r\n`; record ends `ER  - `.
- File names: `citation.ris` (one record), `citations.ris` (selected records).
- Copy-text: "Copied", "Select at least one result", "*n* selected".
- No new dependencies. WCAG 2.2 AA; every render test runs axe; 24×24 px targets; visible focus.
- Next.js 16 differs from training data: read `frontend/node_modules/next/dist/docs/` before writing a client component.
- Use the frontend-design skill for all styling.

## Review Focus

- Catalogers' placeholders "[publisher not identified]", "[Place of production not identified": must not appear in
  a citation. Task 1 returns `null` for any `publisher`/`place` containing "not identified" (test
  `test_placeholder_publisher_and_place_are_null`).
- Parts that already end in a period ("Kennedy, Victor S.", "2nd ed.") must not produce "..". Task 2 test
  `no double periods`.
- Personal name with no comma ("Plato", 100 ind1=0) is treated as corporate, i.e. used as is: correct. Task 2 test
  `name without comma is used as is`.
- Checkbox changes happen outside the export form's DOM subtree, so they don't bubble to it: the count must still
  update. Task 5 test `count follows checkbox clicks` (ExportBar listens for `change` on `document`).
- Two results with the same title get the same accessible names ("Select X"). Acceptable (identical books are
  merged by the backend); no test.

---

### Task 1: Citation fields on every record

**Files:**
- Modify: `backend/app/sru.py` (`_record` gains four fields; `_details` drops `edition`)
- Test: `backend/tests/test_sru.py`

**Interfaces:**
- Produces: every record from `parse_response` and `record` has `publisher: str | None`, `place: str | None`,
  `edition: str | None`, `authors: list[str]`.

- [ ] **Step 1: Write the failing tests**

```python
def test_record_has_citation_fields():
    r = record(FULL)
    assert (r["publisher"], r["place"], r["edition"]) == ("Johns Hopkins University Press", "Baltimore", "Second edition")
    assert r["authors"] == ["Kennedy, Victor S.", "Breitburg, Denise"]  # 710 Maryland Sea Grant is not an author

def test_search_records_carry_citation_fields():
    first = parse_response(FULL)["records"][0]
    assert first["publisher"] == "Johns Hopkins University Press" and first["authors"][0] == "Kennedy, Victor S."

def test_placeholder_publisher_and_place_are_null():
    records = parse_response((FIXTURES / "sru_umd.xml").read_bytes())["records"]
    senate = next(r for r in records if r["title"].startswith('"Removal of Oysters'))  # 264 $b "[publisher not identified],"
    assert senate["publisher"] is None and senate["place"] == "Washington, DC"
    livingston = next(r for r in records if r["title"].startswith("Account of Robert Livingston"))
    assert livingston["place"] is None  # "[Place of production not identified :"

def test_authors_skip_editors_and_translators():
    # FULL with two more 700s: one `$e editor.`, one `$4 trl`, and one `$e author.`
    assert record(xml)["authors"] == ["Kennedy, Victor S.", "Breitburg, Denise", "<the $e author. name>"]

def test_falls_back_to_260_and_has_no_authors_without_names():
    # FULL with 264 retagged 260 and the 100/700 removed
    assert (r["publisher"], r["place"], r["authors"]) == ("Johns Hopkins University Press", "Baltimore", [])
```

Build the variant XML with `FULL.replace(...)`, as the existing tests do. Update `test_details_are_empty_when_the_record_has_none`
only by removing `"edition": None` from `_details`' expected dict (the field moved, the test's intent is unchanged).

- [ ] **Step 2: Run** `cd backend && uv run pytest tests/test_sru.py -q`. Expected: the new tests FAIL with `KeyError`.

- [ ] **Step 3: Implement in `_record`**

`publisher` = 264 $b else 260 $b, `place` = 264 $a else 260 $a, `edition` = 250 $a, each `.rstrip(TRAILING)` or
`None`, and `None` when it contains "not identified" (case-insensitive). `authors` = `[author]` if any, then each 700
$a $b joined and stripped like `author`, kept when it has no $e and no $4, or $e starts with "author", or $4 == "aut".

- [ ] **Step 4: Run** `uv run pytest -q`. Expected: all pass.

- [ ] **Step 5: Commit** `git commit -m "Return publisher, place, edition and authors with every record"`

---

### Task 2: `cite()`

**Files:**
- Create: `frontend/app/citations.ts`
- Modify: `frontend/app/ResultsList.tsx` (`CatalogRecord` gains `authors: string[]; edition, publisher, place: string | null`)
- Modify: `frontend/app/item/[id]/page.tsx` (drop `edition` from `Item`, it's on `CatalogRecord` now)
- Modify: `frontend/tests/search.test.tsx`, `frontend/tests/itemPage.test.tsx` (add the new fields to the record fixtures only)
- Test: `frontend/tests/citations.test.ts`

**Interfaces:**
- Produces:
  - `export type Style = "apa" | "mla" | "chicago"`
  - `export const STYLES: Record<Style, string>` = `{ apa: "APA", mla: "MLA", chicago: "Chicago" }`
  - `export type Citable = Pick<CatalogRecord, "title" | "authors" | "date" | "edition" | "publisher" | "place" | "isbns" | "url">`
  - `export type Cited = { before: string; title: string; after: string }` (title is the italic part)
  - `export function cite(r: Citable, style: Style): Cited`
  - `export const plain = (c: Cited) => c.before + c.title + c.after`

- [ ] **Step 1: Write the failing tests** (`book` = Kennedy fixture: authors `["Kennedy, Victor S."]`, title
  `"The Chesapeake oyster : a history"`, date `"2020"`, edition `"Second edition"`, publisher
  `"Johns Hopkins University Press"`, place `"Baltimore"`)

```ts
test("apa", () => expect(plain(cite(book, "apa"))).toBe(
  "Kennedy, V. S. (2020). The Chesapeake oyster: A history (Second edition). Johns Hopkins University Press."));
test("mla", () => expect(plain(cite(book, "mla"))).toBe(
  "Kennedy, Victor S. The Chesapeake Oyster: A History. Second edition, Johns Hopkins University Press, 2020."));
test("chicago", () => expect(plain(cite(book, "chicago"))).toBe(
  "Kennedy, Victor S. The Chesapeake Oyster: A History. Second edition. Baltimore: Johns Hopkins University Press, 2020."));
test("title is the italic part", () => expect(cite(book, "mla").title).toBe("The Chesapeake Oyster: A History"));
test("no double periods", ...)            // edition "2nd ed." → "…History. 2nd ed. Baltimore…" (chicago), "2nd ed., Johns…" (mla)
test("no author starts with the title", ...) // apa: "The Chesapeake oyster: A history (Second edition). (2020). Johns Hopkins University Press."
test("corporate author used as is", ...)  // "Maryland Sea Grant" in all three styles, apa too
test("name without comma is used as is", ...) // "Plato"
test("no year", ...)                      // apa "(n.d.)"; mla/chicago end "…University Press."
test("no edition, publisher or place", ...) // chicago: "Kennedy, Victor S. The Chesapeake Oyster: A History. 2020."
test("title case keeps small words and capitals", ...) // "a tale of the USA in the 1900s : on and of" → "A Tale of the USA in the 1900s: On and Of"
test.each([1, 2, 3, 11, 21])("%i authors", ...) // names "Last1, First1" …; assert each style's author part per the spec table
```

For the author-count cases assert exact strings for 1, 2 and 3 (from the spec table), and for 11 and 21 assert:
APA 11 lists all eleven with ", & Last11, F."; APA 21 has 19 names, then ", … Last21, F."; MLA 11 and 21 are
"Last1, First1, et al."; Chicago 11 and 21 list seven names then ", et al.".

- [ ] **Step 2: Run** `cd frontend && npx vitest run tests/citations.test.ts`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement `cite` and `plain`** in `app/citations.ts`. Build each style from a list of parts, joined so
  that a part already ending in "." isn't followed by another. APA initials: each word of the given names → first
  letter + "." ("Victor S." → "V. S.").

- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`. Expected: all pass, no type errors.

- [ ] **Step 5: Commit** `git commit -m "Format APA, MLA and Chicago citations"`

---

### Task 3: `ris()`

**Files:**
- Modify: `frontend/app/citations.ts`
- Test: `frontend/tests/citations.test.ts`

**Interfaces:**
- Produces: `export function ris(records: Citable[]): string`

- [ ] **Step 1: Write the failing tests**

```ts
test("ris maps every field", () => expect(ris([{ ...book, authors: ["Kennedy, Victor S.", "Breitburg, Denise"],
  isbns: ["9781421437576", "1421437570"], url: "https://example.org/1" }])).toBe(
  ["TY  - BOOK", "AU  - Kennedy, Victor S.", "AU  - Breitburg, Denise", "TI  - The Chesapeake oyster: a history",
   "ET  - Second edition", "PB  - Johns Hopkins University Press", "CY  - Baltimore", "PY  - 2020",
   "SN  - 9781421437576", "SN  - 1421437570", "UR  - https://example.org/1", "ER  - ", ""].join("\r\n")));
test("ris leaves out empty fields and url null", ...) // no ET/PB/CY/PY/SN/UR lines
test("ris never shortens authors", ...)               // 21 AU lines
test("ris joins several records", ...)                // two TY…ER blocks back to back
```

(TI keeps the cataloged case; only `" : "` → `": "`.)

- [ ] **Step 2: Run** `npx vitest run tests/citations.test.ts`. Expected: the ris tests FAIL.
- [ ] **Step 3: Implement `ris`.**
- [ ] **Step 4: Run** `npx vitest run`. Expected: all pass.
- [ ] **Step 5: Commit** `git commit -m "Export records as RIS"`

---

### Task 4: `Citation` component on results and the item page

**Files:**
- Create: `frontend/app/Citation.tsx` (`"use client"`)
- Modify: `frontend/app/ResultsList.tsx` (Cite disclosure after the request links, before `Relevance`)
- Modify: `frontend/app/item/[id]/page.tsx` ("Cite this" section after "Where to find it")
- Modify: `frontend/app/search.module.css`, `frontend/app/item/item.module.css`
- Test: `frontend/tests/citation.test.tsx`, plus a case each in `search.test.tsx` and `itemPage.test.tsx`

**Interfaces:**
- Consumes: `cite`, `plain`, `ris`, `STYLES`, `Style`, `Citable`, `Cited` (Task 2, 3)
- Produces (for Task 5):
  - `export default function Citation({ record }: { record: Citable })`
  - `export function StylePicker({ value, onChange }: { value: Style; onChange: (s: Style) => void })` — labelled
    `<select>` "Citation style", `useId` for the label
  - `export async function copy(cited: Cited[]): Promise<void>` — `text/plain` = each `plain()`, `"\n"`-joined;
    `text/html` = same with titles in `<i>`, HTML-escaped; uses `navigator.clipboard.write([new ClipboardItem(…)])`
    when `ClipboardItem` exists, else `writeText(plain)`
  - `export function download(name: string, text: string): void` — Blob (`application/x-research-info-systems`) +
    temporary `<a download>`, then `URL.revokeObjectURL`

- [ ] **Step 1: Write the failing tests** (`citation.test.tsx`; stub `navigator.clipboard.writeText`, and
  `URL.createObjectURL` / `revokeObjectURL` with `vi.fn`)

```tsx
test("shows APA first and switches style", ...)  // text contains "Kennedy, V. S. (2020)."; select "MLA" → contains "Kennedy, Victor S."
test("citation is a live region", ...)           // the citation's container has aria-live="polite"
test("title is italic", ...)                     // container.querySelector("i").textContent === "The Chesapeake oyster: A history"
test("copy writes plain text and says Copied", ...) // writeText called with plain(cite(book,"apa")); screen.getByText("Copied")
test("download RIS saves citation.ris", ...)     // createObjectURL called with a Blob whose text === ris([book]); the <a> had download="citation.ris"
test("no axe violations", ...)
```

In `search.test.tsx`: `test("each result has a Cite toggle named with its title")` →
`screen.getByText("Cite", { selector: "summary" })` has `aria-label="Cite: The adaptive challenge of climate change"`.
In `itemPage.test.tsx`: `test("item page has a Cite this section")` → heading "Cite this" and a "Citation style" combobox.

- [ ] **Step 2: Run** `npx vitest run`. Expected: new tests FAIL.
- [ ] **Step 3: Implement `Citation.tsx`**, wire it in, then style it with the frontend-design skill (buttons match
  the request links' button look; 24×24 px; visible focus).
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`. Expected: all pass.
- [ ] **Step 5: Commit** `git commit -m "Cite a record from results and the item page"`

---

### Task 5: Select results and export them

**Files:**
- Create: `frontend/app/ExportBar.tsx` (`"use client"`)
- Modify: `frontend/app/ResultsList.tsx` (checkbox per result; `<ExportBar records={result.records} />` after the
  "Sorted by relevance…" paragraph, only when there are records)
- Modify: `frontend/app/search.module.css`
- Test: `frontend/tests/exportBar.test.tsx`

**Interfaces:**
- Consumes: `cite`, `plain`, `ris`, `Style`, `Citable` (Tasks 2–3); `StylePicker`, `copy`, `download` (Task 4)
- Produces: `export default function ExportBar({ records }: { records: (Citable & { id: string })[] })`

Checkbox in each result `li`, before the `h2`:
`<label><input type="checkbox" form="export" name="id" value={r.id} aria-label={`Select ${r.title}`} /> Select</label>`
(the accessible name contains the visible "Select", WCAG 2.5.3).

ExportBar renders `<section aria-labelledby>` with `<h2>Export citations</h2>`, `<form id="export">`, a "Select all"
checkbox (no `name`), `StylePicker`, **Download RIS**, **Copy citations**, and one `role="status"` paragraph. Selected
ids = `new FormData(form).getAll("id")`. A `document` `change` listener (added in `useEffect`) recomputes the count
and Select all's checked state. Copy sorts `cite()` results by `plain()` with `localeCompare`.

- [ ] **Step 1: Write the failing tests** (render `ResultsList` with three records so checkboxes and bar are both present)

```tsx
test("count follows checkbox clicks", ...)     // click "Select Adaptive Governance…" → status "1 selected"
test("select all checks every result", ...)    // click "Select all" → all three checked, status "3 selected"; click again → none
test("download exports only checked records", ...) // check 2 of 3, click "Download RIS" → Blob text === ris([those two]); download="citations.ris"
test("copy sorts the checked citations", ...)  // check two, choose MLA, "Copy citations" → writeText(sorted MLA lines joined "\n"); status "Copied"
test("nothing selected", ...)                  // click "Copy citations" → status "Select at least one result"; writeText not called
test("export heading is reachable", ...)       // getByRole("heading", { name: "Export citations" })
test("no axe violations", ...)
```

- [ ] **Step 2: Run** `npx vitest run tests/exportBar.test.tsx`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement `ExportBar.tsx`**, add the checkboxes, style with the frontend-design skill.
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`. Expected: all pass.
- [ ] **Step 5: Commit** `git commit -m "Select results and export their citations"`

---

### Task 6: Docs, check in the browser, review, PR

**Files:**
- Modify: `AGENTS.md` (Directories: `app/citations.ts`, `app/Citation.tsx`, `app/ExportBar.tsx`; `ResultsList.tsx`
  and item page lines mention citations and selection)

- [ ] **Step 1:** Update AGENTS.md Directories.
- [ ] **Step 2:** Run `cd backend && uv run pytest -q` and `cd frontend && npm test && npx tsc --noEmit && npm run lint`.
  Expected: all pass.
- [ ] **Step 3:** Run the app (API on 8000, frontend on 3100), search "chesapeake oyster": copy a citation into a
  document (italics paste), download RIS and import into Zotero, select two results and export; check keyboard-only
  and at 320 px width. Ask the user to check it too.
- [ ] **Step 4:** Ponytail review of the branch; fix what it confirms.
- [ ] **Step 5:** Commit, push `step6d-citations`, open PR "Step 6d: citations and RIS export".
