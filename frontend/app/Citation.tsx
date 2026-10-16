"use client";
import { useId, useState } from "react";
import { cite, plain, ris, STYLES, type Citable, type Cited, type Style } from "./citations";
import styles from "./citation.module.css";

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Copies citations, one per line; with italic titles where the browser can copy rich text. */
export async function copy(cited: Cited[]) {
  const text = cited.map(plain).join("\n");
  if (typeof ClipboardItem === "undefined") return navigator.clipboard.writeText(text);
  const html = cited.map((c) => `${escape(c.before)}<i>${escape(c.title)}</i>${escape(c.after)}`).join("<br>");
  await navigator.clipboard.write([
    new ClipboardItem({
      "text/plain": new Blob([text], { type: "text/plain" }),
      "text/html": new Blob([html], { type: "text/html" }),
    }),
  ]);
}

export function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/x-research-info-systems" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000); // Safari reads the blob after click() returns
}

export function StylePicker({ value, onChange }: { value: Style; onChange: (s: Style) => void }) {
  const id = useId();
  return (
    <span className={styles.picker}>
      <label htmlFor={id}>Citation style</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as Style)}>
        {Object.entries(STYLES).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
    </span>
  );
}

export default function Citation({ record }: { record: Citable }) {
  const [style, setStyle] = useState<Style>("apa");
  const [status, setStatus] = useState("");
  const c = cite(record, style);
  const choose = (s: Style) => {
    setStyle(s);
    setStatus("");
  };
  return (
    <div className={styles.citation}>
      <StylePicker value={style} onChange={choose} />
      <p aria-live="polite" className={styles.text}>
        {c.before}
        <i>{c.title}</i>
        {c.after}
      </p>
      <div className={styles.actions}>
        <button type="button" onClick={() => copy([c]).then(() => setStatus("Copied"), () => setStatus("Copy failed"))}>
          Copy
        </button>
        <button type="button" onClick={() => download("citation.ris", ris([record]))}>
          Download RIS
        </button>
        <span role="status">{status}</span>
      </div>
    </div>
  );
}
