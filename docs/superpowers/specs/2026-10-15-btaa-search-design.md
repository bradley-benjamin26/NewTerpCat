# Step 5: Big Ten (BTAA) search and region bonus

## Goal

Let users see whether a book they can't get at UMD is available at a Big Ten Academic Alliance library, so
they know they can request it through interlibrary loan (ILL). Results say *where* it is available; they do not
link to other libraries' catalogs. Requesting (ILLiad OpenURL) is step 6.

## Decisions

- **Opt-in.** A checkbox by the search box, "Include Big Ten libraries", is off by default. Its state travels
  in the URL as `btaa=1`, so results pages keep it.
- **Libraries.** UMD plus the 9 verified BTAA catalogs in `specDocuments/externalSystemUrls.md` (Rutgers,
  Nebraska, Washington, Minnesota, Oregon, Purdue, Northwestern, UCLA, USC). The 7 unverified ones have no
  URL and are left out.
- **Queries.** UMD keeps its current queries (up to 4 narrow + full). Each BTAA catalog gets the full query
  plus the first narrow query: at most 18 extra requests per search.
- **One entry per book.** Records are merged by OCLC number; a record without one stays separate. The UMD
  record is the base when there is one, and the entry lists every Big Ten library holding the book. A book not
  held at UMD looks like any other result; only its availability lines differ, and they say plainly whether
  UMD holds it.
- **Counts are never added across libraries.** The heading gives UMD's count; each Big Ten library's own count
  is shown in "What we searched".
- **Availability at a BTAA library** means an AVA field with status `available`. BTAA online copies (AVE)
  don't count: they are licensed to that university's users.

## Backend

### `app/sru.py`
- `BTAA`: list of `{key, name, base_url, region}` for the 9 verified libraries; regions `east_coast`,
  `midwest`, `west_coast`.
- `search(cql, base_url=UMD["base_url"])`: the SRU base URL is a parameter.
- `parse_response(xml, library=None)`: with no library, records parse as today plus `btaa: []`. With a
  BTAA library, each record has `url: None`, `online: False`, `holdings: []`, `umd: False`, and
  `btaa: [{"name", "region", "available"}]`. UMD records have `umd: True`.

### `app/main.py`
- `/search` takes `btaa: bool = False`.
- With `btaa`, every BTAA catalog gets `[narrow[0], full]` (or just `[full]` when there are no narrow
  queries), all in parallel with UMD and all optional: a failed BTAA call is skipped. UMD's full query
  failing is still a 502.
- Pool key: `oclc` when present, else `"{library}:{id}"`. Merging appends the other record's `btaa` list; a
  UMD record replaces a BTAA base (keeping the merged `btaa` list).
- `total` stays UMD's count.
- With `btaa`, the response adds `libraries: [{"name", "total"}]` for the BTAA catalogs; `total` is `None`
  when the catalog didn't respond.

### `app/rank.py`
- The availability rule becomes a region bonus; only the best one scores:
  - `available_umd` 20: "Available at UMD" (unchanged key, so saved cookies keep working)
  - `available_east_coast` 15, `available_midwest` 10, `available_west_coast` 5:
    "Available at {name} (Big Ten, {East Coast|Midwest|West Coast}) through interlibrary loan"
- A rule set to 0 does not block a lower one, matching the existing exact/partial rules.

## Frontend

- `SearchForm.tsx`: a labelled checkbox `name="btaa" value="1"`, `defaultChecked` from the URL. Used on the
  home and results pages.
- `search/page.tsx`: forwards `btaa=1` to the backend and to the form.
- `ResultsList.tsx`:
  - Title links only when `url` is set (BTAA-only records show plain text).
  - Availability lines:
    - Held at UMD: as today, plus "Also available through interlibrary loan from: Rutgers University, UCLA"
      when Big Ten copies are available.
    - Not held at UMD: "Not held at UMD. Available through interlibrary loan from: Rutgers University, UCLA",
      or "Not held at UMD. Held at Big Ten libraries, none currently available."
  - Heading: "N results at UMD" when `libraries` is present; unchanged otherwise.
  - "What we searched" lists each Big Ten library with its own match count, or "didn't respond".
- `relevance/rules.ts`: the "Available at UMD" row is joined by three Bonus rows for the regions; points
  mirror `rank.WEIGHTS`.

## Accessibility

The checkbox has a visible `<label>` and sits inside the search form so it is in tab order next to the search
box. Library lists are plain text. axe checks run in the Vitest tests.

## Testing (written first, must fail first)

- `test_sru.py`: BTAA parse (no URL/holdings, available vs not, AVE ignored); `search` uses the given URL.
- `test_rank.py`: best region wins; UMD beats BTAA; region rule set to 0 lets the next one score.
- `test_main.py`: no `btaa` → only UMD is called; `btaa` → every BTAA URL is called with 2 queries; a book
  at UMD and 2 BTAA libraries appears once, keeping the UMD record and both names; `total` is UMD's; a failing
  BTAA catalog is reported with `total: None` and the search still answers.
- Vitest: checkbox label and checked state from the URL; `btaa=1` is forwarded; "Also available…" line for a
  UMD book; "Not held at UMD…" lines (available / none available) with an unlinked title; per-library counts
  in "What we searched"; four availability rows on the relevance page; axe.

## Out of scope

ILL / OpenURL requesting, unverified libraries, links to other libraries' records.
