import styles from "./search.module.css";

type Holding = { location: string | null; call_number: string | null; status: string | null };
type CatalogRecord = {
  id: string;
  title: string;
  author: string | null;
  date: string | null;
  url: string | null;
  online: boolean;
  holdings: Holding[];
  umd: boolean;
  btaa: { name: string; region: string; available: boolean }[];
  score: number;
  breakdown: { rule: string; label: string; points: number }[];
};
type Searched = {
  operator: "AND" | "OR" | "NOT" | null;
  keywords: string[];
  subjects: { phrase: string; headings: string[] }[];
  people: string[];
};
type Library = { name: string; total: number | null };
export type SearchResult = { total: number; records: CatalogRecord[]; searched?: Searched[]; libraries?: Library[] };

const JOINS = { AND: "AND: must also match", OR: "OR: or match this instead", NOT: "NOT: leave out records with" };

const STATUS: Record<string, string> = {
  available: "Available",
  unavailable: "Unavailable",
  check_holdings: "Check holdings",
};

function availability(r: CatalogRecord): string[] {
  const ill = r.btaa.filter((b) => b.available).map((b) => b.name).join(", ");
  if (!r.umd)
    return [
      ill
        ? `Not held at UMD. Available through interlibrary loan from: ${ill}`
        : "Not held at UMD. Held at Big Ten libraries, none currently available.",
    ];
  const lines = r.holdings.map(
    (h) =>
      `${STATUS[h.status ?? ""] ?? "Check holdings"} at UMD: ${[h.location, h.call_number].filter(Boolean).join(", ")}`,
  );
  if (r.online) lines.push("Available online");
  if (!lines.length) lines.push("Availability unknown: see the full record");
  if (ill) lines.push(`Also available through interlibrary loan from: ${ill}`);
  return lines;
}

const plural = (n: number, word: string, many = `${word}s`) => `${n.toLocaleString()} ${n === 1 ? word : many}`;
const points = (n: number) => plural(n, "point");

function Relevance({ r }: { r: CatalogRecord }) {
  return (
    <details className={styles.relevance}>
      {/* The title tells screen reader users which result each toggle belongs to. */}
      <summary aria-label={`Relevance: ${points(r.score)} for ${r.title}`}>Relevance: {points(r.score)}</summary>
      {r.breakdown.length ? (
        <dl>
          {r.breakdown.map((b) => (
            <div key={b.rule}>
              <dt>{b.label}</dt>
              <dd>{points(b.points)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p>No ranking rules matched.</p>
      )}
    </details>
  );
}

function Part({ part }: { part: Searched }) {
  return (
    <dl>
      <dt>Keywords</dt>
      <dd>{part.keywords.join(" ")}</dd>
      {part.operator !== "NOT" && (
        <>
          <dt>Subject headings (Library of Congress)</dt>
          <dd>
            {part.subjects.length ? (
              <ul>
                {part.subjects.map((s) => (
                  <li key={s.phrase}>
                    “{s.phrase}” matched {s.headings.join(" or ")}
                  </li>
                ))}
              </ul>
            ) : (
              "No matching subject headings"
            )}
          </dd>
        </>
      )}
      {part.people.length > 0 && (
        <>
          <dt>Possible authors</dt>
          <dd>{part.people.join("; ")}</dd>
        </>
      )}
    </dl>
  );
}

function BigTen({ libraries }: { libraries: Library[] }) {
  return (
    <>
      <h3>Big Ten libraries</h3>
      <ul>
        {libraries.map((l) => (
          <li key={l.name}>
            {l.name}: {l.total === null ? "didn't respond" : plural(l.total, "match", "matches")}
          </li>
        ))}
      </ul>
    </>
  );
}

function SearchedFor({ searched, libraries }: { searched: Searched[]; libraries?: Library[] }) {
  return (
    <section aria-labelledby="searched-heading" className={styles.searched}>
      <h2 id="searched-heading">What we searched</h2>
      {searched.length === 1 ? (
        <Part part={searched[0]} />
      ) : (
        <>
          <p>Your search has {searched.length} parts. AND and NOT apply before OR.</p>
          <ol>
            {searched.map((part, i) => (
              <li key={i}>
                {part.operator && <p className={styles.join}>{JOINS[part.operator]}</p>}
                <Part part={part} />
              </li>
            ))}
          </ol>
        </>
      )}
      {libraries && <BigTen libraries={libraries} />}
    </section>
  );
}

export default function ResultsList({ query, result }: { query: string; result: SearchResult }) {
  const searched = result.searched && <SearchedFor searched={result.searched} libraries={result.libraries} />;
  // Big Ten counts overlap with UMD's and each other's, so the heading counts UMD only.
  const count = plural(result.total, "result") + (result.libraries ? " at UMD" : "");
  if (!result.records.length)
    return (
      <>
        <h1>No results for “{query}”</h1>
        {searched}
      </>
    );
  return (
    <>
      <h1>
        {count} for “{query}”
      </h1>
      {searched}
      <p>
        Sorted by relevance score, best first, showing {result.records.length}. Open “Relevance” under a result
        to see how its points add up, or change the points in <a href="/relevance">relevance settings</a>.
      </p>
      <ol className={styles.results}>
        {result.records.map((r) => (
          <li key={r.id}>
            <h2>{r.url ? <a href={r.url}>{r.title}</a> : r.title}</h2>
            <p>{[r.author, r.date].filter(Boolean).join(" · ")}</p>
            {availability(r).map((line, i) => (
              <p key={i} className={styles.availability}>
                {line}
              </p>
            ))}
            <Relevance r={r} />
          </li>
        ))}
      </ol>
    </>
  );
}
