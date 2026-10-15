# TerpCat Spec document
TerpCat is an experimental project to develop a library catalog system to promote discovery and access to library resources and other high quality resources
New TerpCat is developed to explore agentic software methodologies. TerpCat has been developed to explore more transparent search experiences as well as features such as implementing controlled vocabulary search.

Library systems employ controlled vocabulary to be used for resource discovery. Users often are unfamiliar with these vocabularies

## Stack
* Back end: FastAPI, spaCy. May replace or compare spaCy with Qwen model using Ollama later
* Front end: Next.js TypeScript

## Decisions
* Users are not logged in for now (browser-only). Favorites and ranking settings are stored in the browser.
* Ranking point values are defaults that users can edit (see [queryWorkflow.md](specDocuments/queryWorkflow.md)).
* The University System of Maryland and Affiliated Institutions (USMAI) use the same SRU endpoint as UMD.
* Subject vocabulary: Library of Congress Subject Headings first; other thesauri later.
* Citation styles: APA, MLA, Chicago.
* Testing: pytest (back end), Vitest with Testing Library (front end), axe-core (accessibility).
* Secrets such as the WorldCat API credentials live in `.env`, which is not committed.

## Directories
* externalSystemUrls.md (specDocuments/): endpoints for UMD, USMAI and BTAA SRU services, plus Illiad (interlibrary loan) and the geographic grouping of BTAA institutions.


## Architecture

User query -> spaCy(maybe a qwen model eventually) -> thesauri apis -> queries constructed -> SRU endpoint(s) -> Results ranked -> presented to user

## Key Features
* Users can search across the holdings of the UMD Libraries and the Big Ten Academic Alliance Libraries (as available)
* Users can find the location of materials available from the UMD Libraries
* Users can request material from the UMD Libraries
* Users can request material from the University System of Maryland and Affiliated Institutions. These are other institutions whose holdings can be found using the same SRU endpoint as UMD.
* Users can request materials from Big Ten Academic Alliance Libraries
* Users can view the mechanics of the relevance ranking algorithm
* Users can edit the mechanics of the relevance ranking algorithm
* The application reviews a user's natural language query, breaks it down to search, and tries to improve it by identifying controlled vocabulary subject terms to enhance the search.

### Search Transparency
The application is designed to give the user as much control over the experience. The application has default relevancy ranking which the user can alter. The user is presented with an explaination why each record was selected, including a score and score breakdown of different elements. The interface shows the user what is being searched.

### Supporting quality discovery
Use of controlled vocabularies improves discovery of library resources.

### Search Across Big Ten Libraries
The interface can search across the Big Ten Academic Alliance to faciliate the discovery of materials that are not available locally at the University of Maryland. The interface facilitates use of interlibrary loan services using OpenURL to request these materials.

### Design
A user inputs a query. spaCy/NLP and possibly openweight ai analyzes query, identifying possible author names, book titles, and words. Terms are searched against external Thesauri (ex. Library of Congress Subject Headings). If relevant search terms are found, the terms are added to the user's query to improve the quality. The application then sends a series of queries against either 1. UMD's catalog or 2. Catalogs of the Big Ten libraries. Various combinations of the query are searched to pull up a variety of records.



## Library-domain technologies documentation
* SRU: https://www.loc.gov/standards/sru/; https://developers.exlibrisgroup.com/alma/integrations/sru/

* OpenURL: https://knowledge.exlibrisgroup.com/Primo/Knowledge_Articles/Openurl_parameters_used_in_Primo_service_page; https://knowledge.exlibrisgroup.com/Alma/Product_Documentation/010Alma_Online_Help_(English)/030Fulfillment/080Configuring_Fulfillment/090Discovery_Interface_Display_Logic/010General_Electronic_Services#Commonly_Used_OpenURL_Attributes_for_the_URL_Template

* MARC standard: https://www.loc.gov/marc/bibliographic/

## Sources for cover images

COVERS_BASE_URL = "https://covers.openlibrary.org/b"

SYNDETICS_BASE_URL = (
    "https://proxy-na.hosted.exlibrisgroup.com/exl_rewrite/"
    "syndetics.com/index.php"
)





