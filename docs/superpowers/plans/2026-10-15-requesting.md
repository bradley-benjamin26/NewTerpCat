# Step 6b: Requesting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Request links (Primo hold, ILLiad loan, ILLiad chapter scan) on the item page and on every search result.

**Architecture:** One pure function, `requestLinks(record)`, in `frontend/app/requests.ts` turns a record into
`{ label, href }[]`. The item page and the results list render its output. No backend change.

**Tech Stack:** Next.js 16 / React / TypeScript, Vitest + Testing Library + axe-core.

**Spec:** `docs/superpowers/specs/2026-10-15-requesting-design.md`

## Global Constraints

- ILLiad base: `https://docdel.umd.edu/illiad/illiad.dll/OpenURL`; params `sid=NewTerpCat`, `genre`, `title`, `au`, `date`, `isbn` (first only), `rfe_dat` (OCLC); empty values left out.
- Labels, exact: `Request for pickup`, `Request a chapter scan`, `Request from another library`, `Request through interlibrary loan`.
- Links open in the same tab (no `target`).
- WCAG 2.2 AA: visible focus, 24×24 px minimum target; on the results list each link's accessible name is `<label>: <title>`.
- Use the frontend-design skill for the link styling.
- Run frontend tests with `npm test` in `frontend/`.

## Review Focus

- A Big Ten record with `author`, `date` and `oclc` all null → the OpenURL has only `sid`, `genre` and `title`, with no `au=` or `rfe_dat=` left empty. Test in Task 1.
- A title with `&`, `:` or `/` (e.g. `Oysters & bays: a history`) → it's encoded, and the URL still has exactly one `title` param. Test in Task 1.
- A UMD record with `url` null (shouldn't happen, but the type allows it) → no Primo link rather than `href="null"`. Test in Task 1.
- A results page where several results share a label → link names stay distinct because they include the title. Test in Task 3.
- An online-only UMD record → no request links, so the list isn't empty. Tests in Tasks 1 and 3.

---

### Task 1: `requestLinks`

**Files:**
- Create: `frontend/app/requests.ts`
- Modify: `frontend/app/ResultsList.tsx` (add `oclc: string | null` to `CatalogRecord`; the backend already sends it)
- Test: `frontend/tests/requests.test.ts`

**Interfaces:**
- Produces: `export type RequestLink = { label: string; href: string }` and
  `export function requestLinks(r: CatalogRecord & { isbns?: string[] }): RequestLink[]`

- [ ] **Step 1: Write the failing tests** in `tests/requests.test.ts`, with a base UMD record (`url: "https://primo.example/1"`, one holding, `title: "Oysters & bays: a history"`, `author: "Kennedy, Victor"`, `date: "2020"`, `oclc: "123"`):
  - `UMD with a holding offers pickup then a chapter scan`: labels `["Request for pickup", "Request a chapter scan"]`; the first href is `r.url`.
  - `UMD with no holding and not online offers another library`: `[{ label: "Request from another library", href: r.url }]`.
  - `UMD online only offers nothing`: `holdings: [], online: true` → `[]`.
  - `UMD with no url offers no Primo link`: `url: null`, one holding → labels `["Request a chapter scan"]`.
  - `Big Ten offers a loan then a chapter scan`: `umd: false, url: null` → labels `["Request through interlibrary loan", "Request a chapter scan"]`.
  - `OpenURL carries the record`: parse the scan href with `new URL()`. Its origin and path equal the ILLiad base. `searchParams` has `sid=NewTerpCat`, `genre=bookitem`, `title="Oysters & bays: a history"`, `au="Kennedy, Victor"`, `date="2020"`, `rfe_dat="123"`, and `getAll("title").length === 1`. The loan href has `genre=book`.
  - `OpenURL uses the first ISBN`: `isbns: ["111", "222"]` → `isbn=111`.
  - `OpenURL drops empty fields`: `author/date/oclc` null, no isbns → `[...searchParams.keys()]` equals `["sid", "genre", "title"]`.
- [ ] **Step 2: Run** `npm test -- requests` → FAIL (module not found).
- [ ] **Step 3: Implement** `requestLinks` in `app/requests.ts`. Build the OpenURL with `URLSearchParams` from the entries, filtering out null and undefined values.
- [ ] **Step 4: Run** `npm test` → all PASS.
- [ ] **Step 5: Commit** `Build request links for holds, loans and scans`.

### Task 2: Item page links

**Files:**
- Modify: `frontend/app/item/[id]/page.tsx` (`WhereToFind`), `frontend/app/item/item.module.css`
- Test: `frontend/tests/itemPage.test.tsx`

**Interfaces:**
- Consumes: `requestLinks` from Task 1. The item already has `isbns`.

- [ ] **Step 1: Write the failing tests**:
  - `UMD item links to pickup and a chapter scan`: render the `full` fixture. In the "Where to find it" region, `getByRole("link", { name: "Request for pickup" })` has `href === full.url`. `getByRole("link", { name: "Request a chapter scan" }).getAttribute("href")` contains `isbn=9781421437576`.
  - `Big Ten item links to interlibrary loan`: `{ ...full, id: "rutgers:991", umd: false, url: null, holdings: [], btaa: [{ name: "Rutgers University", region: "east_coast", available: true }] }` → link `Request through interlibrary loan` exists.
  - The existing axe test still passes with the links present.
- [ ] **Step 2: Run** `npm test -- itemPage` → the new tests FAIL.
- [ ] **Step 3: Implement**: at the end of the `WhereToFind` section, render `<ul className={styles.requests}>` with one `<li><a href>` per link, only when there are any. Style the links as buttons using the frontend-design skill: visible `:focus-visible` outline and `min-height`/`min-width` ≥ 24px.
- [ ] **Step 4: Run** `npm test` → all PASS.
- [ ] **Step 5: Commit** `Request links on the item page`.

### Task 3: Results list links + docs

**Files:**
- Modify: `frontend/app/ResultsList.tsx`, `frontend/app/search.module.css`, `AGENTS.md` (Directories: add `app/requests.ts -- request links: Primo hold, ILLiad loan and chapter scan`; note request links on the ResultsList and item page lines)
- Test: `frontend/tests/search.test.tsx` (add `oclc` to its record fixtures where TypeScript needs it)

**Interfaces:**
- Consumes: `requestLinks` from Task 1.

- [ ] **Step 1: Write the failing tests**:
  - `each result has request links named with its title`: render results with two UMD records, each with a holding. `getAllByRole("link", { name: /^Request for pickup: / })` has length 2. The names are `Request for pickup: <title1>` and `Request for pickup: <title2>`. The visible text is just `Request for pickup` (`toHaveTextContent` or `textContent`).
  - `online-only result has no request links`: `queryByRole("link", { name: /^Request/ })` is null.
  - The existing axe test on results still passes.
- [ ] **Step 2: Run** `npm test -- search` → the new tests FAIL.
- [ ] **Step 3: Implement**: after the availability lines in each `<li>`, render the links in a `<ul className={styles.requests}>` with `aria-label={`${label}: ${r.title}`}` on each `<a>`. Share the item page's button look, following the frontend-design skill.
- [ ] **Step 4: Run** `npm test` and `npm run lint` → all PASS / clean.
- [ ] **Step 5: Manual check**: with `npm run dev -- -p 3100` and the API on 8000, search "chesapeake oyster". Open one result's ILLiad link and confirm the ILLiad form pre-fills the title, and that `rfe_dat` lands in the OCLC field. If it doesn't, find the param UMD's form reads, update the spec, the constant and the test together, and tell the user.
- [ ] **Step 6: Commit** `Request links on search results`.
