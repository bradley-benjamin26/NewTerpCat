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
  return (
    <main>
      <SearchForm defaultValue={query} />
      {res?.ok ? (
        <ResultsList query={query} result={(await res.json()) as SearchResult} />
      ) : (
        <p role="alert">The library catalog is not responding. Try again shortly.</p>
      )}
    </main>
  );
}
