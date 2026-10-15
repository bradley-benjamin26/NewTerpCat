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

## Directories
* main
    * AGENTS.md
    * newTerpCatSpec.md -- specification file
    * .env
* specDocuments -- contains contextual information
    * catalogServices.md -- describes services patrons can use in the catalog
    * userInterface.md -- provides an overview of the user interface views
    * userPersonas.md -- provides an overview of the type of users who will use the interface and their unique needs and challenges
    * queryWorkflow.md -- describes how the application should handle user queries
    * externalSystemUrls.md -- lists data sources and urls to provide services