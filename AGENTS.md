* Before developing a new feature, write unit-tests and ensure it fails. Then develop the feature until it passes.
* Do not rewrite tests so they pass.
* Employ the green-claude skill
* Before each new feature /clear
* Accessibility Prioritization: Meet at least WCAG 2.2 AA. A visually impared user must be able to use and find, as easily as any other user, the features of the interface.
* Do not generate wrapper classes, speculative features or heavy boiler plate unless instructed.
* Do not over over-engineer
* Code should be: brief, simple, and readable
* Use ponytail agent for review
* Develop a plan before implementing features
* Keep the Directories section below up to date when files are added, moved or removed

## Directories
* main
    * AGENTS.md
    * README.md -- how to run and test the app
    * newTerpCatSpec.md -- specification file
    * .env -- credentials (not committed)
* .claude -- project settings for Claude Code
    * settings.json -- registers the Green Claude hook
    * hooks/green-claude-changes.sh -- audits lines added by any Write, Edit or Bash call
    * hooks/test-green-claude-changes.sh -- self-check for that hook
    * hooks/green-claude-audit.sh -- original Write/Edit-only hook from the plugin installer; no longer used
* backend -- FastAPI API (Python 3.13, run with uv)
    * app/main.py -- /search endpoint: parses AND/OR/NOT, runs analysis and lookups, queries UMD (and the Big Ten catalogs when asked), merges copies of the same book; /record/{id} endpoint: one record with full details
    * app/analyze.py -- spaCy query analysis: keywords, possible authors, noun phrases
    * app/lcsh.py -- Library of Congress Subject Headings lookup and matching
    * app/sru.py -- Big Ten catalog list; builds CQL queries (full and narrow pool queries) for Alma SRU and parses MARCXML results (including citation fields: authors, publisher, place, edition), with full details for one record
    * app/rank.py -- relevancy scoring with a per-rule breakdown
    * app/worldcat.py -- WorldCat holdings counts for the ranking bonus
    * tests/ -- pytest tests; fixtures/ holds sample SRU responses
* frontend -- Next.js TypeScript web app
    * app/page.tsx -- home page with the search box
    * app/search/page.tsx -- results page; calls the backend
    * app/search/loading.tsx -- search box and "Searching the catalog…" while results load (the Suspense boundary cacheComponents needs)
    * app/SearchForm.tsx -- search box and "Include Big Ten libraries" checkbox
    * app/ResultsList.tsx -- results list with UMD and interlibrary loan availability, request links, a Cite toggle and a select checkbox per result, relevance breakdown per result, and "What we searched" panel; titles open the item page
    * app/citations.ts -- APA, MLA and Chicago citations and RIS export
    * app/Citation.tsx -- citation style picker with Copy and Download RIS (client component)
    * app/citation.module.css -- citation and export bar styles
    * app/ExportBar.tsx -- exports the citations of the selected results as RIS or copied text (client component)
    * app/requests.ts -- request links: Primo hold, ILLiad loan and chapter scan
    * app/Cover.tsx -- book cover: Syndetics, then Open Library, nothing when neither has one
    * app/item/ -- item page for one record
        * [id]/page.tsx -- the page: where to find it, request links, call number, citation, details, subjects, contents, notes
        * [id]/not-found.tsx -- shown when the record doesn't exist
        * [id]/loading.tsx -- search box and "Loading the record…" while the record loads
        * item.module.css -- item page styles
    * app/relevance/ -- relevance settings page: users change the points per ranking rule, saved in a "weights" cookie that the search page sends to the backend
        * page.tsx -- the page; reads the saved points
        * RelevanceForm.tsx -- the points form (client component)
        * actions.ts -- server action that checks and saves or resets the points
        * rules.ts -- rule labels and default points (mirror WEIGHTS in backend/app/rank.py)
    * tests/ -- Vitest + Testing Library tests, with axe accessibility checks
* docs/superpowers -- design work per feature
    * specs/ -- approved designs
    * plans/ -- implementation plans
* specDocuments -- contains contextual information
    * catalogServices.md -- describes services patrons can use in the catalog
    * userInterface.md -- provides an overview of the user interface views
    * userPersonas.md -- provides an overview of the type of users who will use the interface and their unique needs and challenges
    * queryWorkflow.md -- describes how the application should handle user queries
    * externalSystemUrls.md -- lists data sources and urls to provide services