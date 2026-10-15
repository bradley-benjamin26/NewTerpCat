import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import RelevanceForm from "./RelevanceForm";
import { COOKIE, RULES, type Weights } from "./rules";
import styles from "./relevance.module.css";

export const metadata: Metadata = { title: "Relevance settings – NewTerpCat" };

export default async function RelevancePage() {
  let saved: Weights = {};
  try {
    saved = JSON.parse((await cookies()).get(COOKIE)?.value ?? "{}");
  } catch {} // an unreadable cookie means the defaults
  const values = Object.fromEntries(RULES.map((r) => [r.key, String(saved?.[r.key] ?? r.points)]));
  return (
    <main className={styles.page}>
      <p>
        <Link href="/">NewTerpCat home</Link>
      </p>
      <h1>Relevance settings</h1>
      <p>
        Each result scores points for every rule it meets, and the highest scores come first. Change the points to
        rank results your way. Use 0 to turn a rule off. Your points are saved in this browser only.
      </p>
      <RelevanceForm initial={values} />
    </main>
  );
}
