import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import ResultsList, { type SearchResult } from "../ResultsList";
import SearchForm from "../SearchForm";
import { COOKIE } from "../relevance/rules";

const API_URL = process.env.API_URL ?? "http://localhost:8000";

export async function generateMetadata({ searchParams }: PageProps<"/search">): Promise<Metadata> {
  const { q } = await searchParams;
  return { title: `Results for “${typeof q === "string" ? q.trim() : ""}” – NewTerpCat` };
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const { q, btaa: big } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  if (!query) redirect("/");
  const btaa = big === "1";
  const params = new URLSearchParams({ q: query });
  if (btaa) params.set("btaa", "1");
  const weights = (await cookies()).get(COOKIE)?.value;
  if (weights) params.set("weights", weights); // the backend checks it

  // 25 s covers the backend's own limits: two subject lookups at 3 s each, catalog 15 s, WorldCat token + counts at 2 s each.
  const res = await fetch(`${API_URL}/search?${params}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  }).catch(() => null);
  const body = await res?.json().catch(() => null);
  // A 422 carries a hint about the query (e.g. "jazz OR NOT rock") or about saved relevance points.
  const hint = res?.status === 422 && typeof body?.detail === "string" ? body.detail : null;
  return (
    <main>
      <SearchForm defaultValue={query} btaa={btaa} />
      {res?.ok ? (
        <ResultsList query={query} result={body as SearchResult} />
      ) : (
        <p role="alert">
          {hint ?? "The library catalog is not responding. Try again shortly."}
          {/* Saved points can go stale if a rule is renamed; saving the settings page again fixes them. */}
          {weights && hint?.startsWith("Relevance points") && (
            <>
              {" "}
              Save them again in <Link href="/relevance">relevance settings</Link>.
            </>
          )}
        </p>
      )}
    </main>
  );
}
