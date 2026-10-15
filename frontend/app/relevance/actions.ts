"use server";

import { cookies } from "next/headers";
import { COOKIE, MAX_POINTS, RULES } from "./rules";

type Saved = { message: string; invalid?: string; values: Record<string, string> };

export async function saveWeights(_prev: Saved | null, data: FormData): Promise<Saved> {
  const jar = await cookies();
  if (data.has("reset")) {
    jar.delete(COOKIE);
    return { message: "Reset to the default points.", values: Object.fromEntries(RULES.map((r) => [r.key, String(r.points)])) };
  }
  // Keep what was typed so React's form reset after the action doesn't wipe it.
  const values = Object.fromEntries(RULES.map((r) => [r.key, String(data.get(r.key) ?? "")]));
  const bad = RULES.find((r) => !/^\d+$/.test(values[r.key]) || Number(values[r.key]) > MAX_POINTS);
  if (bad) return { message: `${bad.label}: use a whole number from 0 to ${MAX_POINTS}.`, invalid: bad.key, values };
  const weights = Object.fromEntries(RULES.map((r) => [r.key, Number(values[r.key])]));
  jar.set(COOKIE, JSON.stringify(weights), { maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true });
  return { message: "Saved. Your next searches use these points.", values };
}
