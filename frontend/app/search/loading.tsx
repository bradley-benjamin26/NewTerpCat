import SearchForm from "../SearchForm";

// Streams while the page waits on the catalog; with cacheComponents, this is the Suspense boundary.
export default function Loading() {
  return (
    <main>
      <SearchForm />
      <p role="status">Searching the catalog…</p>
    </main>
  );
}
