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
    * app/main.py -- /search endpoint: parses AND/OR/NOT, runs analysis and lookups, queries the catalog
    * app/analyze.py -- spaCy query analysis: keywords, possible authors, noun phrases
    * app/lcsh.py -- Library of Congress Subject Headings lookup and matching
    * app/sru.py -- builds CQL queries for Alma SRU and parses MARCXML results
    * tests/ -- pytest tests; fixtures/ holds sample SRU responses
* frontend -- Next.js TypeScript web app
    * app/page.tsx -- home page with the search box
    * app/search/page.tsx -- results page; calls the backend
    * app/SearchForm.tsx -- search box
    * app/ResultsList.tsx -- results list and "What we searched" panel
    * tests/ -- Vitest + Testing Library tests, with axe accessibility checks
* specDocuments -- contains contextual information
    * catalogServices.md -- describes services patrons can use in the catalog
    * userInterface.md -- provides an overview of the user interface views
    * userPersonas.md -- provides an overview of the type of users who will use the interface and their unique needs and challenges
    * queryWorkflow.md -- describes how the application should handle user queries
    * externalSystemUrls.md -- lists data sources and urls to provide services