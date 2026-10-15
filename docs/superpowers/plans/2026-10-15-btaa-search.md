# Big Ten (BTAA) Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An opt-in search of 9 Big Ten catalogs alongside UMD, with one entry per book, availability lines that say whether UMD holds it, and a region bonus in the ranking.

**Architecture:** `sru.py` gains the BTAA library list and parses BTAA records into the UMD record shape (no URL or holdings, plus a `btaa` list). `main.py` fans the full query and the first narrow query out to each BTAA catalog and merges records by OCLC number. `rank.py` replaces the single availability rule with the best of four region rules. The frontend adds a checkbox and new availability lines.

**Tech Stack:** FastAPI + httpx + pytest (Python 3.13, uv); Next.js + Vitest + Testing Library + axe-core.

**Spec:** `docs/superpowers/specs/2026-10-15-btaa-search-design.md`

## Global Constraints

- TDD: write each test, see it fail, then implement. Never rewrite a test to make it pass (AGENTS.md).
- WCAG 2.2 AA; every new UI is covered by an axe check.
- No links to other libraries' records; BTAA records have `url: None`.
- BTAA availability = AVA status `available` only; AVE (online) at a BTAA library never counts.
- Default points: `available_umd` 20, `available_east_coast` 15, `available_midwest` 10, `available_west_coast` 5. `frontend/app/relevance/rules.ts` mirrors `backend/app/rank.py` WEIGHTS.
- Counts are never summed across libraries; `total` stays UMD's.
- Run backend tests with `cd backend && uv run pytest`; frontend with `cd frontend && npx vitest run`.

## Review Focus

1. UMD finds nothing but Big Ten libraries do: today ResultsList shows only "No results" when `total` is 0; the BTAA books must still be listed (Task 4 test).
2. The same BTAA library returns a book from both its narrow and full query: the library is listed once (Task 3 test).
3. Every BTAA catalog is down: the search still answers with UMD results and each library reports `total: None` (Task 3 test).
4. A query with no narrow queries: each BTAA catalog gets only the full query (Task 3 test).
5. An older saved weights cookie without the new region keys: the defaults fill in (already true through `{**WEIGHTS, **weights}`; covered by Task 2's default-points test).

---

### Task 1: BTAA libraries and record parsing (`sru.py`)

**Files:**
- Modify: `backend/app/sru.py`
- Test: `backend/tests/test_sru.py`

**Interfaces:**
- Produces:
  - `BTAA: list[dict]`: 9 dicts `{key, name, base_url, region}` copied from `specDocuments/externalSystemUrls.md` (verified entries only). The regions are `east_coast`, `midwest` and `west_coast`.
  - `async search(cql: str, base_url: str = UMD["base_url"], limit: int = 50) -> bytes`
  - `parse_response(xml: bytes, library: dict | None = None) -> {"total": int, "records": [...]}`: every record gets `umd: bool` and `btaa: list[{"name", "region", "available": bool}]`. UMD (no library): `umd: True, btaa: []`, otherwise unchanged. BTAA: `id: f"{key}:{mms_id}"`, `url: None`, `online: False`, `holdings: []`, `umd: False`, `btaa: [{"name", "region", "available"}]` where `available` = any AVA `e` subfield equal to `available`.

- [ ] **Step 1: Write the failing tests** in `test_sru.py` (reuse the existing fixtures `sru_umd_print.xml` / `sru_umd.xml` as BTAA responses: same MARCXML)
  - `test_umd_records_are_marked_umd`: `parse_response(PRINT)["records"][0]` has `umd is True` and `btaa == []`.
  - `test_btaa_record_lists_the_library_without_links_or_shelf_details`: parse the print fixture with `BTAA[0]` (Rutgers). The record has `url is None`, `holdings == []`, `online is False`, `umd is False`, `id.startswith("rutgers:")`, and `btaa == [{"name": "Rutgers University", "region": "east_coast", "available": True}]`. The fixture's first record has AVA `available`; check that before writing the assertion.
  - `test_btaa_online_copy_is_not_available`: parse the electronic fixture (AVE only) with a BTAA library. `btaa[0]["available"] is False`.
  - `test_btaa_lists_nine_verified_libraries`: `len(BTAA) == 9`, all `base_url` start with `https://`, and `{l["region"] for l in BTAA} == {"east_coast", "midwest", "west_coast"}`.
  - `test_search_uses_the_given_catalog`: monkeypatch `httpx.AsyncClient.get` to record the URL. `await search("x", "https://example.org/sru")` calls `https://example.org/sru`. Use `asyncio.run`, as other async tests in the repo do.

- [ ] **Step 2: Run them and see them fail.** Run `cd backend && uv run pytest tests/test_sru.py -q`. Expected: the 5 new tests fail (ImportError on `BTAA`, or KeyError on `umd`).

- [ ] **Step 3: Implement** `BTAA`, the `base_url` parameter, and `parse_response(xml, library=None)`. Pass `library` through to `_record`, and let `_record` build the BTAA variant.

- [ ] **Step 4: Run all backend tests.** Run `cd backend && uv run pytest -q`. Expected: all pass. Existing tests don't depend on the new fields.

- [ ] **Step 5: Commit.** `git add backend/app/sru.py backend/tests/test_sru.py && git commit -m "Parse Big Ten SRU records"`

### Task 2: Region bonus (`rank.py`)

**Files:**
- Modify: `backend/app/rank.py`
- Test: `backend/tests/test_rank.py`

**Interfaces:**
- Consumes: record fields `umd`, `online`, `holdings`, `btaa` from Task 1. The test helper `rec()` needs `btaa: []` added to its defaults.
- Produces: `WEIGHTS` gains `available_east_coast: 15`, `available_midwest: 10`, `available_west_coast: 5`. Only the highest-weighted rule with weight > 0 among the record's available places scores.
  - UMD (online, or a holding with status `available`): label "Available at UMD".
  - BTAA entries with `available: True`: rule `f"available_{region}"`, label `f"Available at {name} (Big Ten, {REGION[region]}) through interlibrary loan"`, where `REGION = {"east_coast": "East Coast", "midwest": "Midwest", "west_coast": "West Coast"}`.

- [ ] **Step 1: Write the failing tests**
  - `test_closest_available_big_ten_library_scores`: a record with `btaa` = [UCLA west available, Purdue midwest available, Rutgers east **not** available] scores `{"available_midwest": 10}`, and its label contains "Purdue University" and "interlibrary loan".
  - `test_umd_availability_beats_big_ten`: a UMD-available record with `btaa` = [Rutgers east available] scores `{"available_umd": 20}`.
  - `test_region_rule_set_to_zero_lets_the_next_region_score`: with `btaa` = [Rutgers east, UCLA west], both available, and `weights={"available_east_coast": 0}`, the score is `{"available_west_coast": 5}`.
  - `test_unavailable_everywhere_scores_no_availability_bonus`: a record with `btaa` = [Rutgers, not available] scores `{}`.

- [ ] **Step 2: Run and see them fail.** Run `cd backend && uv run pytest tests/test_rank.py -q`. Expected: the 4 new tests fail.

- [ ] **Step 3: Implement.** Replace the `available_umd` branch: build a list of `(rule, label)` candidates, then `add` the one with the highest `weights[rule]` if that weight is > 0.

- [ ] **Step 4: Run all backend tests.** Run `cd backend && uv run pytest -q`. Expected: all pass, including `test_available_at_umd_in_print_or_online`.

- [ ] **Step 5: Commit.** `git commit -am "Region bonus for Big Ten availability"`

### Task 3: Big Ten fan-out and merge (`main.py`)

**Files:**
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_main.py`

**Interfaces:**
- Consumes: `BTAA`, `search(cql, base_url)`, `parse_response(xml, library)` from Task 1.
- Produces: `GET /search?q=…&btaa=true|1`. Keep the UMD call as `fetch(cql)` so existing one-argument fakes keep working. Each BTAA call is `fetch(cql, lib["base_url"])` for `cql in narrow[:1] + [full]`, through `_optional`. The response adds `libraries: [{"name": str, "total": int | None}]` only when `btaa` is set. Each library's `total` is its full query's `total`, or `None` if that call failed.

Merge rule (the only non-obvious algorithm):
```python
key = r["oclc"] or r["id"]
if key in pool:
    old = pool[key]
    base = r if r["umd"] and not old["umd"] else old
    r = {**base, "btaa": list({b["name"]: b for b in old["btaa"] + r["btaa"]}.values())}
pool[key] = r
```

- [ ] **Step 1: Write the failing tests.** Use a fake `fetch(cql, base_url=None)` that returns `FIXTURE` for UMD (`base_url is None`) and a BTAA fixture for BTAA URLs. The BTAA fixture is the print fixture: same OCLC numbers, so the records merge.
  - `test_without_btaa_only_umd_is_searched`: no BTAA URL is called, and `"libraries" not in res.json()`.
  - `test_btaa_searches_every_big_ten_catalog_with_two_queries`: with `btaa=1`, each `lib["base_url"]` in `BTAA` is called exactly twice. Use a `q` that yields narrow queries, such as "oysters" (check `pool_queries` gives at least one narrow query).
  - `test_a_book_held_by_umd_and_big_ten_appears_once`: with `btaa=1`, the record ids are unique and the first fixture record keeps its UMD `url`. Its `btaa` names include all 9 libraries, each once, even though each library answered twice. `total` equals the UMD fixture's `numberOfRecords`.
  - `test_a_big_ten_outage_is_reported_and_the_search_still_answers`: the fake raises `httpx.ConnectError` for every BTAA URL. Status 200, UMD records are present, and every `libraries[i]["total"] is None`.
  - `test_big_ten_gets_only_the_full_query_when_there_are_no_narrow_ones`: monkeypatch `main.pool_queries` to return `["FULL"]`. Each BTAA URL is called once, with `"FULL"`.

- [ ] **Step 2: Run and see them fail.** Run `cd backend && uv run pytest tests/test_main.py -q`. Expected: the 5 new tests fail.

- [ ] **Step 3: Implement** the `btaa: bool = False` parameter, the BTAA calls in the same `asyncio.gather`, the merge above when building `pool`, and `libraries` in the response.

- [ ] **Step 4: Run all backend tests.** Run `cd backend && uv run pytest -q`. Expected: all pass.

- [ ] **Step 5: Live check.** Start `uv run uvicorn app.main:app --port 8000`. Then `curl -s 'localhost:8000/search?q=oyster%20culture&btaa=1' | python3 -m json.tool | head -60` shows `libraries` with 9 entries, and records with `btaa` lists.

- [ ] **Step 6: Commit.** `git commit -am "Search Big Ten catalogs on request and merge by OCLC number"`

### Task 4: Frontend checkbox, availability lines, and relevance rows

Invoke the `frontend-design:frontend-design` skill before the UI work (user preference).

**Files:**
- Modify: `frontend/app/SearchForm.tsx`, `frontend/app/search/page.tsx`, `frontend/app/ResultsList.tsx`, `frontend/app/relevance/rules.ts`, `frontend/app/search.module.css` (only if the checkbox needs layout)
- Test: `frontend/tests/search.test.tsx`, `frontend/tests/searchPage.test.tsx`, `frontend/tests/relevance.test.tsx`

**Interfaces:**
- Consumes: response fields `umd`, `btaa`, `url: string | null` on records, and `libraries?: {name: string; total: number | null}[]` (Task 3).
- Produces:
  - `SearchForm({ defaultValue, btaa }: { defaultValue?: string; btaa?: boolean })`: a checkbox `name="btaa" value="1"` labelled "Include Big Ten libraries".
  - `SearchPage` reads `searchParams.btaa === "1"`, sets `params.set("btaa", "1")`, and passes `btaa` to `SearchForm`.

Exact copy, from the spec:
- Held at UMD with available BTAA copies: "Also available through interlibrary loan from: {names joined ", "}"
- Not held at UMD, some BTAA copy available: "Not held at UMD. Available through interlibrary loan from: {names}"
- Not held at UMD, none available: "Not held at UMD. Held at Big Ten libraries, none currently available."
- Heading when `libraries` is present: "{total} results at UMD" ("result" when the total is 1)
- "What we searched": a "Big Ten libraries" list; each item is "{name}: {n} matches" ("match" for 1) or "{name}: didn't respond"

- [ ] **Step 1: Write the failing tests**
  - search.test.tsx:
    - `SearchForm` renders an unchecked checkbox by role `checkbox`, name "Include Big Ten libraries". With `btaa`, it is checked.
    - A UMD record with `btaa: [{name: "Rutgers University", region: "east_coast", available: true}]` shows the "Also available…" line.
    - A record with `umd: false, url: null` has a heading with no link (`queryByRole("link", {name: title})` is null) and the "Not held at UMD. Available…" line.
    - An unavailable-only record shows the "none currently available" line.
    - With `libraries`, the heading reads "263 results at UMD", and the panel lists "Rutgers University: 137 matches" and "UCLA: didn't respond".
    - With `total: 0` and one BTAA record, the record is still listed.
    - axe passes for all of these.
  - searchPage.test.tsx: with `searchParams` `{q: "oysters", btaa: "1"}`, the fetched URL contains `btaa=1` and the checkbox is checked. Without it, the URL has no `btaa`.
  - relevance.test.tsx: the form shows spin buttons for "Available at an East Coast Big Ten library", "…Midwest…" and "…West Coast…", with defaults 15/10/5. Match the existing relevance tests' query style.

- [ ] **Step 2: Run and see them fail.** Run `cd frontend && npx vitest run`. Expected: the new tests fail.

- [ ] **Step 3: Implement.** Type changes: `url: string | null`, `umd: boolean`, `btaa: {name; region; available}[]`, `libraries?`. Add the 3 rows to `RULES` (tier "Bonus", hint "Request through interlibrary loan"). Only render the "No results" branch when there are no records, rather than whenever `total` is 0.

- [ ] **Step 4: Run all frontend tests.** Run `cd frontend && npx vitest run && npx tsc --noEmit`. Expected: all pass, no type errors.

- [ ] **Step 5: Check in the browser.** With the backend on 8000 and `npm run dev -- -p 3100`, search with the box checked: one entry per book, the ILL lines are present, and the checkbox stays checked on the results page. Tab order goes search box → checkbox → button.

- [ ] **Step 6: Commit.** `git commit -am "Big Ten checkbox, interlibrary loan availability and region points"`

### Task 5: Review, docs, wrap-up

- [ ] **Step 1:** Run the ponytail agent review (`ponytail:ponytail-review`) on the branch diff. Fix the findings it confirms, and rerun both test suites.
- [ ] **Step 2:** In AGENTS.md "Directories", add `docs/superpowers/specs` and `docs/superpowers/plans`. Update the `app/sru.py` line (now covers Big Ten catalogs) and the `rules.ts` line if its meaning changed.
- [ ] **Step 3:** Update memory `newterpcat-feature-order.md`: step 5 done, with the commit hash.
- [ ] **Step 4: Commit.** `git commit -am "Step 5: Big Ten search with region bonus"`
