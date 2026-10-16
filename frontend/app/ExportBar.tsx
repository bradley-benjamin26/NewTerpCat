"use client";
import { useEffect, useRef, useState } from "react";
import { cite, plain, ris, type Citable, type Style } from "./citations";
import { copy, download, StylePicker } from "./Citation";
import styles from "./citation.module.css";

/** Exports the citations of the results whose checkboxes (form="export") are checked. */
export default function ExportBar({ records }: { records: (Citable & { id: string })[] }) {
  const form = useRef<HTMLFormElement>(null);
  const all = useRef<HTMLInputElement>(null);
  const [style, setStyle] = useState<Style>("apa");
  const [status, setStatus] = useState("");

  const boxes = () =>
    Array.from(form.current!.elements).filter((e): e is HTMLInputElement => (e as HTMLInputElement).name === "id");
  const selected = () => {
    const ids = new Set(new FormData(form.current!).getAll("id"));
    return records.filter((r) => ids.has(r.id));
  };
  const count = () => {
    const n = boxes().filter((b) => b.checked).length;
    all.current!.checked = n === records.length;
    setStatus(`${n} selected`);
  };

  // The result checkboxes sit outside this form in the page, so their changes never bubble to it.
  useEffect(() => {
    const onChange = (e: Event) => (e.target as HTMLInputElement).form === form.current && count();
    document.addEventListener("change", onChange);
    return () => document.removeEventListener("change", onChange);
  });

  const exportWith = (run: (chosen: Citable[]) => void) => {
    const chosen = selected();
    if (chosen.length) run(chosen);
    else setStatus("Select at least one result");
  };

  return (
    <section aria-labelledby="export-heading" className={styles.export}>
      <h2 id="export-heading">Export citations</h2>
      <form id="export" ref={form} onSubmit={(e) => e.preventDefault()} className={styles.actions}>
        <label>
          <input
            type="checkbox"
            ref={all}
            onChange={(e) => {
              for (const b of boxes()) b.checked = e.target.checked;
              count();
            }}
          />{" "}
          Select all
        </label>
        <StylePicker value={style} onChange={setStyle} />
        <button type="button" onClick={() => exportWith((chosen) => download("citations.ris", ris(chosen)))}>
          Download RIS
        </button>
        <button
          type="button"
          onClick={() =>
            exportWith((chosen) => {
              const sorted = chosen.map((r) => cite(r, style)).sort((a, b) => plain(a).localeCompare(plain(b)));
              copy(sorted).then(() => setStatus("Copied"), () => setStatus("Copy failed"));
            })
          }
        >
          Copy citations
        </button>
        <span role="status">{status}</span>
      </form>
    </section>
  );
}
