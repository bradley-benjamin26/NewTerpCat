import SearchForm from "./SearchForm";

export default function Home() {
  return (
    <main style={{ minHeight: "80vh", display: "grid", placeContent: "center", justifyItems: "center", gap: "1.5rem" }}>
      <h1>NewTerpCat</h1>
      <SearchForm />
    </main>
  );
}
