import SearchForm from "../../SearchForm";

export default function NotFound() {
  return (
    <main>
      <SearchForm />
      <h1>Record not found</h1>
      <p>We couldn&apos;t find that record. It may have been removed from the catalog. Search again above.</p>
    </main>
  );
}
