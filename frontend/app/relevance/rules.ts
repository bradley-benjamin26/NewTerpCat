// Default points mirror WEIGHTS in backend/app/rank.py; keep them in sync.
export const RULES = [
  { key: "exact_title", tier: "High relevance", points: 100, label: "Exact title match", hint: "Your search is the title" },
  { key: "exact_author", tier: "High relevance", points: 90, label: "Exact author match", hint: "A name you typed is the author" },
  { key: "subjects_many", tier: "Medium relevance", points: 40, label: "Several subject headings match", hint: "Two or more matching Library of Congress headings" },
  { key: "title_words", tier: "Medium relevance", points: 30, label: "Several search words in the title", hint: "Two or more of your words appear in the title" },
  { key: "author_words", tier: "Medium relevance", points: 25, label: "Search words in the author's name", hint: "Part of your search matches the author" },
  { key: "phrase", tier: "Medium relevance", points: 25, label: "Search words together in the title", hint: "Your words appear side by side, in order" },
  { key: "subjects_few", tier: "Low relevance", points: 10, label: "One subject heading matches", hint: "A single matching Library of Congress heading" },
  { key: "keywords_elsewhere", tier: "Low relevance", points: 5, label: "Search words in the subjects", hint: "Your words appear in the record's subjects" },
  { key: "available_umd", tier: "Bonus", points: 20, label: "Available at UMD", hint: "On the shelf or online" },
  { key: "available_east_coast", tier: "Bonus", points: 15, label: "Available at an East Coast Big Ten library", hint: "Through interlibrary loan; a book earns only its highest availability bonus" },
  { key: "available_midwest", tier: "Bonus", points: 10, label: "Available at a Midwest Big Ten library", hint: "Through interlibrary loan; a book earns only its highest availability bonus" },
  { key: "available_west_coast", tier: "Bonus", points: 5, label: "Available at a West Coast Big Ten library", hint: "Through interlibrary loan; a book earns only its highest availability bonus" },
  { key: "holdings", tier: "Bonus", points: 2, label: "Each other library that owns it", hint: "From WorldCat, counting up to 5 libraries" },
];
export const MAX_POINTS = 200;
export const COOKIE = "weights";

export type Weights = Record<string, number>;
