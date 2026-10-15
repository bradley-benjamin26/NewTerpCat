"use client";

import { useActionState } from "react";
import { saveWeights } from "./actions";
import { MAX_POINTS, RULES } from "./rules";
import styles from "./relevance.module.css";

const TIERS = [...new Set(RULES.map((r) => r.tier))];

export default function RelevanceForm({ initial }: { initial: Record<string, string> }) {
  const [state, action] = useActionState(saveWeights, null);
  const values = state?.values ?? initial;
  return (
    <form action={action} className={styles.form}>
      {TIERS.map((tier) => (
        <fieldset key={tier}>
          <legend>{tier}</legend>
          {RULES.filter((r) => r.tier === tier).map((r) => (
            <div key={r.key} className={styles.rule}>
              <label htmlFor={r.key}>
                <span className={styles.label}>{r.label}</span>
                <span className={styles.hint}>
                  {r.hint}. Default: {r.points}.
                </span>
              </label>
              <input
                id={r.key}
                name={r.key}
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX_POINTS}
                step={1}
                required
                defaultValue={values[r.key]}
                aria-invalid={state?.invalid === r.key || undefined}
                aria-describedby={state?.invalid === r.key ? "relevance-status" : undefined}
              />
            </div>
          ))}
        </fieldset>
      ))}
      <div className={styles.actions}>
        <button type="submit">Save points</button>
        <button type="submit" name="reset" value="1" formNoValidate className={styles.secondary}>
          Reset to defaults
        </button>
      </div>
      <p id="relevance-status" role="status" className={state?.invalid ? styles.error : undefined}>
        {state?.message}
      </p>
    </form>
  );
}
