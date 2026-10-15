# The Query Workflow

## Workflow

1) User inputs natural language query
2) App inspects query and identifies query intent and the type of query (subject, title, author, more than one, etc). Handles stop words.
3) Identifies terms to send to thesauri and sends them to the different sources. Parses results to verify valid subject terms to include.
4) Runs searches against the SRU endpoint(s) using different searches such as title searches, using different subject terms, using booleans, etc.
5) Compiles results and applies a relevancy ranking.

## Subject Term Thesauri

* Library of Congress Subject Headings
* Homosaurus
* Getty
* MeSH
* UNESCO
* EUROVOC


## Relevancy criteria

Point values are defaults. Users can edit them on the relevancy configuration page.

### High Relevancy
1) Exact title match: 100 points
2) Exact author match: 90 points


### Medium Relevancy
1) Multiple subject term matches: 40 points
2) Multiple keywords match words in a title: 30 points
3) Part of a query matches an author: 25 points
4) Exact keyword phrase match: 25 points

### Low Relevancy
1) Keywords matching keywords elsewhere in a record: 5 points
2) Minimal subject matches: 10 points

### Bonus points
1) Points are assigned to resources based on availability: UMD 20, east coast BTAA 15, midwest BTAA 10, west coast BTAA 5. Only available items score.
2) Number of holdings: 2 points per other library holding, up to 10. Uses OCLC WorldCat Search API with credentials found in .env