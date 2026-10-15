import styles from "./search.module.css";

type Holding = { location: string | null; call_number: string | null; status: string | null };
type CatalogRecord = {
  id: string;
  title: string;
  author: string | null;
  date: string | null;
  url: string;
  online: boolean;
  holdings: Holding[];
};
export type SearchResult = { total: number; records: CatalogRecord[] };

const STATUS: Record<string, string> = {
  available: "Available",
  unavailable: "Unavailable",
  check_holdings: "Check holdings",
};

function availability(r: CatalogRecord): string[] {
  const lines = r.holdings.map(
    (h) =>
      `${STATUS[h.status ?? ""] ?? "Check holdings"} at UMD: ${[h.location, h.call_number].filter(Boolean).join(", ")}`,
  );
  if (r.online) lines.push("Available online");
  return lines.length ? lines : ["Availability unknown: see the full record"];
}

export default function ResultsList({ query, result }: { query: string; result: SearchResult }) {
  if (!result.total) return <h1>No results for “{query}”</h1>;
  return (
    <>
      <h1>
        {result.total.toLocaleString()} {result.total === 1 ? "result" : "results"} for “{query}”
      </h1>
      <ol className={styles.results}>
        {result.records.map((r) => (
          <li key={r.id}>
            <h2>
              <a href={r.url}>{r.title}</a>
            </h2>
            <p>{[r.author, r.date].filter(Boolean).join(" · ")}</p>
            {availability(r).map((line, i) => (
              <p key={i} className={styles.availability}>
                {line}
              </p>
            ))}
          </li>
        ))}
      </ol>
    </>
  );
}
