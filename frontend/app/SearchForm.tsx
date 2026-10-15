import styles from "./search.module.css";

export default function SearchForm({ defaultValue = "", btaa = false }: { defaultValue?: string; btaa?: boolean }) {
  return (
    <form role="search" action="/search" className={styles.form}>
      <label htmlFor="q">Search the catalog</label>
      <div className={styles.row}>
        <input id="q" name="q" type="search" required defaultValue={defaultValue} />
        <button type="submit">Search</button>
      </div>
      <label className={styles.check}>
        <input type="checkbox" name="btaa" value="1" defaultChecked={btaa} />
        Include Big Ten libraries
      </label>
    </form>
  );
}
