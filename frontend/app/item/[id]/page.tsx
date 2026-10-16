import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { type CatalogRecord, STATUS } from "../../ResultsList";
import { requestLinks } from "../../requests";
import SearchForm from "../../SearchForm";
import styles from "../item.module.css";

const API_URL = process.env.API_URL ?? "http://localhost:8000";
const CATALOG_DOWN = "The library catalog is not responding. Try again shortly.";

type Item = Omit<CatalogRecord, "score" | "breakdown"> & {
  subjects: string[];
  publication: string | null;
  edition: string | null;
  description: string | null;
  series: string | null;
  summary: string | null;
  isbns: string[];
  contributors: string[];
  contents: string[];
  notes: { label: string; texts: string[] }[];
};

// Shared by the page and its title, so a request asks the API once. null means the catalog failed.
const getItem = cache(async (raw: string): Promise<Item | null> => {
  let id: string;
  try {
    id = decodeURIComponent(raw); // params may arrive encoded or not; IDs never contain "%"
  } catch {
    notFound();
  }
  // One catalog call; 20 s is past the backend's 15 s catalog timeout.
  const res = await fetch(`${API_URL}/record/${encodeURIComponent(id)}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (res?.status === 404) notFound();
  return res?.ok ? res.json() : null;
});

export async function generateMetadata({ params }: PageProps<"/item/[id]">): Promise<Metadata> {
  const item = await getItem((await params).id);
  return { title: `${item?.title ?? "Item"} – NewTerpCat` };
}

function WhereToFind({ item }: { item: Item }) {
  const lines = item.umd
    ? item.holdings.map((h, i) => (
        <li key={i}>
          {STATUS[h.status ?? ""] ?? "Check holdings"} at UMD{h.location && `: ${h.location}`}
          {h.call_number && <span className={styles.callNumber}>{h.call_number}</span>}
        </li>
      ))
    : item.btaa.map((b) => (
        <li key={b.name}>
          Not held at UMD.{" "}
          {b.available
            ? `${b.name} has a copy: request it through interlibrary loan.`
            : `${b.name} has it, but no copy is available right now.`}
        </li>
      ));
  if (item.online) lines.push(<li key="online">Available online</li>);
  const requests = requestLinks(item);
  return (
    <section aria-labelledby="where-heading" className={styles.where}>
      <h2 id="where-heading">Where to find it</h2>
      {lines.length ? <ul>{lines}</ul> : <p>Availability unknown.</p>}
      {requests.length > 0 && (
        <ul className="requests">
          {requests.map((l) => (
            <li key={l.label}>
              <a href={l.href}>{l.label}</a>
            </li>
          ))}
        </ul>
      )}
      {item.url && <a href={item.url}>Open in the UMD catalog</a>}
    </section>
  );
}

function List({ heading, items }: { heading: string; items: string[] }) {
  return items.length ? (
    <>
      <h2>{heading}</h2>
      <ul>
        {items.map((text, i) => (
          <li key={i}>{text}</li>
        ))}
      </ul>
    </>
  ) : null;
}

export default async function ItemPage({ params }: PageProps<"/item/[id]">) {
  const item = await getItem((await params).id);
  if (!item)
    return (
      <main>
        <SearchForm />
        <p role="alert">{CATALOG_DOWN}</p>
      </main>
    );
  const details = [
    ["Published", item.publication],
    ["Edition", item.edition],
    ["Description", item.description],
    ["Series", item.series],
    ["ISBN", item.isbns.join(", ")],
    ["Other authors", item.contributors.join("; ")],
  ].filter(([, value]) => value);
  return (
    <main className={styles.item}>
      <SearchForm />
      <h1>{item.title}</h1>
      <p>{[item.author, item.date].filter(Boolean).join(", ")}</p>
      <WhereToFind item={item} />
      {item.summary && (
        <>
          <h2>Summary</h2>
          <p>{item.summary}</p>
        </>
      )}
      {details.length > 0 && (
        <>
          <h2>Details</h2>
          <dl className={styles.details}>
            {details.map(([term, value]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
      <List heading="Subjects" items={item.subjects} />
      <List heading="Contents" items={item.contents} />
      {item.notes.length > 0 && (
        <>
          <h2>Notes</h2>
          <dl className={styles.details}>
            {item.notes.map((n) => (
              <div key={n.label}>
                <dt>{n.label}</dt>
                {n.texts.map((text, i) => (
                  <dd key={i}>{text}</dd>
                ))}
              </div>
            ))}
          </dl>
        </>
      )}
    </main>
  );
}
