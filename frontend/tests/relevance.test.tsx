import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import axe from "axe-core";
import RelevancePage from "../app/relevance/page";
import { saveWeights } from "../app/relevance/actions";
import { RULES } from "../app/relevance/rules";

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string) => jar.set(name, value),
    delete: (name: string) => jar.delete(name),
  }),
}));

afterEach(() => {
  cleanup();
  jar.clear();
});

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(entries)) data.set(k, v);
  return data;
}

test("every rule has a labelled points box showing its default, grouped by tier", async () => {
  const { container } = render(await RelevancePage());
  expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/relevance/i);
  for (const rule of RULES) {
    const box = screen.getByRole("spinbutton", { name: new RegExp(rule.label) }) as HTMLInputElement;
    expect(box.value).toBe(String(rule.points));
    expect(box.min).toBe("0");
    expect(box.max).toBe("200");
  }
  expect(screen.getByRole("group", { name: /high relevance/i })).toBeTruthy();
  expect(screen.getByRole("group", { name: /bonus/i })).toBeTruthy();
  const { violations } = await axe.run(container);
  expect(violations.map((v) => v.id)).toEqual([]);
});

test("shows the points saved in the browser", async () => {
  jar.set("weights", JSON.stringify({ exact_title: 7 }));
  render(await RelevancePage());
  expect((screen.getByRole("spinbutton", { name: /exact title/i }) as HTMLInputElement).value).toBe("7");
  expect((screen.getByRole("spinbutton", { name: /exact author/i }) as HTMLInputElement).value).toBe("90");
});

test("ignores an unreadable cookie", async () => {
  jar.set("weights", "{oops");
  render(await RelevancePage());
  expect((screen.getByRole("spinbutton", { name: /exact title/i }) as HTMLInputElement).value).toBe("100");
});

test("saving stores the points in a cookie", async () => {
  const values = Object.fromEntries(RULES.map((r) => [r.key, String(r.points)]));
  const state = await saveWeights(null, form({ ...values, exact_title: "7" }));
  expect(JSON.parse(jar.get("weights")!)).toMatchObject({ exact_title: 7, exact_author: 90 });
  expect(state.message).toMatch(/saved/i);
  expect(state.invalid).toBeUndefined();
});

test("saving rejects points that aren't whole numbers from 0 to 200", async () => {
  for (const bad of ["-1", "201", "2.5", "", "abc"]) {
    const state = await saveWeights(null, form({ exact_title: bad }));
    expect(state.invalid).toBe("exact_title");
    expect(state.message).toMatch(/Exact title match/);
  }
  expect(jar.has("weights")).toBe(false);
});

test("reset deletes the saved points", async () => {
  jar.set("weights", "{}");
  const state = await saveWeights(null, form({ reset: "1" }));
  expect(jar.has("weights")).toBe(false);
  expect(state.message).toMatch(/default/i);
});

test("an invalid field is marked and described by the message", async () => {
  render(await RelevancePage());
  const box = screen.getByRole("spinbutton", { name: /exact title/i }) as HTMLInputElement;
  fireEvent.change(box, { target: { value: "500" } });
  box.form!.noValidate = true; // let the server check what the browser normally blocks
  fireEvent.click(screen.getByRole("button", { name: /save/i }));
  const status = await screen.findByText(/Exact title match/, { selector: "[role=status]" });
  expect(box.getAttribute("aria-invalid")).toBe("true");
  expect(box.getAttribute("aria-describedby")).toContain(status.id);
});
