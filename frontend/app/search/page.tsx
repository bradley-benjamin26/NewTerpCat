import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ResultsList, { type SearchResult } from "../ResultsList";
import SearchForm from "../SearchForm";

const API_URL = process.env.API_URL ?? "http://localhost:8000";

export async function generateMetadata({ searchParams }: PageProps<"/search">): Promise<Metadata> {
  const { q } = await searchParams;
  return { title: `Results for “${typeof q === "string" ? q.trim() : ""}” – NewTerpCat` };
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const q = (await searchParams).q;
  const query = typeof q === "string" ? q.trim() : "";
  if (!query) redirect("/");

  const res = await fetch(`${API_URL}/search?${new URLSearchParams({ q: query })}`, { cache: "no-store" }).catch(
    () => null,
  );
  const body = await res?.json().catch(() => null);
  // A 422 carries a hint about the query itself (e.g. "jazz OR NOT rock").
  const hint = res?.status === 422 && typeof body?.detail === "string" ? body.detail : null;
  return (
    <main>
      <SearchForm defaultValue={query} />
      {res?.ok ? (
        <ResultsList query={query} result={body as SearchResult} />
      ) : (
        <p role="alert">{hint ?? "The library catalog is not responding. Try again shortly."}</p>
      )}
    </main>
  );
}
