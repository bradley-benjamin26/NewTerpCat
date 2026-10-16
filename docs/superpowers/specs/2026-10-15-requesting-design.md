# Step 6b: Requesting

## Goal

Let a patron request a book from the item page and from the search results: a hold for pickup at UMD, delivery
from another USMAI campus, an interlibrary loan from a Big Ten library, or a scan of a chapter.

## Decisions

- **Every request is a link to a system that already handles login.** Holds and USMAI delivery go to the
  record's UMD Primo page, where Primo signs the patron in and offers its own request options. Loans and scans
  go to UMD's ILLiad OpenURL. No Alma API key or SSO in this app.
- **Frontend only.** The links are built from fields `/search` and `/record` already return (`umd`, `holdings`,
  `online`, `url`, `title`, `author`, `date`, `oclc`, and `isbns` on the item page). No backend change.
- **USMAI holders are not detected.** UMD's SRU returns only UMCP holdings (`AVA $a = 01USMAI_UMCP`). A UMD
  record with no print holding sends the patron to Primo, whose request screen offers USMAI delivery.
- **No lookup of other Big Ten holders by OCLC.** ILLiad doesn't need to know who holds the book.

## Rules

| Record                                   | Links (in this order)                                                   |
|------------------------------------------|-------------------------------------------------------------------------|
| UMD, at least one holding                | **Request for pickup** → `url`; **Request a chapter scan** → ILLiad `bookitem` |
| UMD, no holding, not online              | **Request from another library** → `url`                                |
| UMD, no holding, online                  | none ("Available online" already covers it)                             |
| Big Ten only (`umd` false)               | **Request through interlibrary loan** → ILLiad `book`; **Request a chapter scan** → ILLiad `bookitem` |

"Request for pickup" is shown whatever the copies' status: Primo places holds on checked-out copies too.

## ILLiad OpenURL

`https://docdel.umd.edu/illiad/illiad.dll/OpenURL?` + `URLSearchParams` of:

| Param     | Value                         |
|-----------|-------------------------------|
| `sid`     | `NewTerpCat`                  |
| `genre`   | `book` or `bookitem`          |
| `title`   | record title                  |
| `au`      | author                        |
| `date`    | year                          |
| `isbn`    | first ISBN, when known        |
| `rfe_dat` | OCLC number                   |

Empty values are left out. ILLiad's form asks the patron for the chapter details.

## Frontend

- `app/requests.ts`: `requestLinks(record)` returns `{ label, href }[]` following the rules above.
- Item page: the links appear at the end of "Where to find it" as a list.
- Search results: the same links under each result's availability. Each link's accessible name includes the
  title ("Request for pickup: *title*") so a screen reader's links list tells results apart (WCAG 2.4.4). The
  visible text stays short.
- Links open in the same tab, look like buttons, and have a visible focus style and a 24×24 px minimum target
  (WCAG 2.5.8). Styling follows the frontend-design skill.

## Testing (written first, seen failing)

- `requestLinks` unit tests: one per rules row, plus the OpenURL: correct params, encoding, empty fields dropped,
  first ISBN only.
- Item page and results render tests: the links are present with the right names and hrefs; axe passes.
