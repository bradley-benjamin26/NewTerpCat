import type { CatalogRecord } from "./ResultsList";

export type Style = "apa" | "mla" | "chicago";
export const STYLES: Record<Style, string> = { apa: "APA", mla: "MLA", chicago: "Chicago" };
export type Citable = Pick<
  CatalogRecord,
  "title" | "authors" | "date" | "edition" | "publisher" | "place" | "isbns" | "url"
>;
// The title is the only italic part.
export type Cited = { before: string; title: string; after: string };

export const plain = (c: Cited) => c.before + c.title + c.after;

const end = (s: string) => (s.endsWith(".") ? s : `${s}.`);
const SMALL = new Set("a an the and but or for nor on at to by of in as".split(" "));
const upperFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Catalogers separate the subtitle with " : ".
const tidy = (title: string) => title.replace(/ : /g, ": ");
const sentenceCase = (title: string) => upperFirst(tidy(title)).replace(/: (\w)/g, (_, c) => `: ${c.toUpperCase()}`);
function titleCase(title: string) {
  const words = tidy(title).split(" ");
  return words
    .map((w, i) => (i > 0 && i < words.length - 1 && !words[i - 1].endsWith(":") && SMALL.has(w) ? w : upperFirst(w)))
    .join(" ");
}

// "Smith, John Q." is personal; a name without a comma (corporate, or "Plato") is used as is.
function split(name: string): [string, string] | null {
  const i = name.indexOf(",");
  return i < 0 ? null : [name.slice(0, i), name.slice(i + 1).trim()];
}
function direct(name: string) {
  const parts = split(name);
  return parts ? `${parts[1]} ${parts[0]}` : name;
}
function apaName(name: string) {
  const parts = split(name);
  if (!parts) return name;
  const initials = parts[1].split(/\s+/).filter(Boolean).map((w) => `${w[0]}.`);
  return `${parts[0]}, ${initials.join(" ")}`;
}

// Author list rules: APA 7 §9.8, MLA 9, Chicago 17 §14.76.
function apaAuthors(authors: string[]) {
  const names = authors.map(apaName);
  if (names.length === 1) return names[0];
  if (names.length >= 21) return `${names.slice(0, 19).join(", ")}, … ${names.at(-1)}`;
  return `${names.slice(0, -1).join(", ")}, & ${names.at(-1)}`;
}
function mlaAuthors([first, ...rest]: string[]) {
  if (!rest.length) return first;
  return rest.length === 1 ? `${first}, and ${direct(rest[0])}` : `${first}, et al.`;
}
function chicagoAuthors([first, ...rest]: string[]) {
  if (!rest.length) return first;
  if (rest.length >= 10) return `${[first, ...rest.slice(0, 6).map(direct)].join(", ")}, et al.`;
  return `${[first, ...rest.slice(0, -1).map(direct)].join(", ")}, and ${direct(rest.at(-1)!)}`;
}

export function cite(r: Citable, style: Style): Cited {
  const has = r.authors.length > 0;
  const stop = /[.?!]$/.test(r.title) ? "" : "."; // "Who moved my cheese?" takes no period
  if (style === "apa") {
    const year = `(${r.date ?? "n.d."}).`;
    const publisher = r.publisher ? ` ${end(r.publisher)}` : "";
    const edition = r.edition ? ` (${r.edition})` : "";
    return has
      ? { before: `${end(apaAuthors(r.authors))} ${year} `, title: sentenceCase(r.title), after: `${edition}${edition ? "." : stop}${publisher}` }
      : { before: "", title: sentenceCase(r.title), after: `${edition}${edition ? "." : stop} ${year}${publisher}` };
  }
  const before = has ? `${end(style === "mla" ? mlaAuthors(r.authors) : chicagoAuthors(r.authors))} ` : "";
  const imprint = r.place && r.publisher ? `${r.place}: ${r.publisher}` : r.place || r.publisher;
  const rest =
    style === "mla"
      ? [[r.edition, r.publisher, r.date].filter(Boolean).join(", ")]
      : [r.edition && end(r.edition), [imprint, r.date].filter(Boolean).join(", ")];
  const tail = rest.filter(Boolean).map((s) => ` ${end(s!)}`).join("");
  return { before, title: titleCase(r.title), after: `${stop}${tail}` };
}

// RIS, the import format of Zotero, EndNote and Mendeley: "TAG  - value" lines, CRLF, one block per record.
export function ris(records: Citable[]): string {
  return records
    .map((r) =>
      [
        ["TY", "BOOK"],
        ...r.authors.map((a) => ["AU", a]),
        ["TI", tidy(r.title)],
        ["ET", r.edition],
        ["PB", r.publisher],
        ["CY", r.place],
        ["PY", r.date],
        ...r.isbns.map((i) => ["SN", i]),
        ["UR", r.url],
        ["ER", ""],
      ]
        .filter(([tag, value]) => value || tag === "ER")
        .map(([tag, value]) => `${tag}  - ${value}\r\n`)
        .join(""),
    )
    .join("");
}
