import type { CatalogRecord } from "./ResultsList";

export type RequestLink = { label: string; href: string };
type Requestable = Omit<CatalogRecord, "score" | "breakdown">;

function illiad(r: Requestable, genre: "book" | "bookitem"): string {
  const fields = { sid: "NewTerpCat", genre, title: r.title, au: r.author, date: r.date, isbn: r.isbns[0]?.split(" ")[0], rfe_dat: r.oclc };
  const params = new URLSearchParams(Object.entries(fields).filter((e): e is [string, string] => !!e[1]));
  return `https://docdel.umd.edu/illiad/illiad.dll/OpenURL?${params}`;
}

/** Where a patron can request this record: Primo for UMD holds and USMAI delivery, ILLiad for loans and scans. */
export function requestLinks(r: Requestable): RequestLink[] {
  const scan = { label: "Request a chapter scan", href: illiad(r, "bookitem") };
  if (!r.umd) return [{ label: "Request through interlibrary loan", href: illiad(r, "book") }, scan];
  if (r.holdings.length) return [...(r.url ? [{ label: "Request for pickup", href: r.url }] : []), scan];
  // Primo's own request screen offers USMAI delivery; our SRU can't see other campuses' copies.
  return !r.online && r.url ? [{ label: "Request from another library", href: r.url }] : [];
}
