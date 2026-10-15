import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import SearchPage, { generateMetadata } from "../app/search/page";

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined) }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  jar.clear();
});

const props = { searchParams: Promise.resolve({ q: "oysters" }), params: Promise.resolve({}) };

test("page title names the search", async () => {
  expect((await generateMetadata(props)).title).toBe("Results for “oysters” – NewTerpCat");
});

test("shows an alert when the backend is unreachable", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
  render(await SearchPage(props));
  expect(screen.getByRole("alert").textContent).toMatch(/not responding/);
});

test("gives up on a hung backend instead of waiting forever", async () => {
  const fetchMock = vi.fn().mockRejectedValue(new DOMException("timed out", "TimeoutError"));
  vi.stubGlobal("fetch", fetchMock);
  render(await SearchPage(props));
  expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  expect(screen.getByRole("alert").textContent).toMatch(/not responding/);
});

test("shows the backend's hint when the query can't be searched", async () => {
  const detail = "NOT needs something to search for first, for example: jazz NOT blues";
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail }), { status: 422 })));
  render(await SearchPage(props));
  expect(screen.getByRole("alert").textContent).toBe(detail);
});

test("sends the relevance points saved in the browser to the backend", async () => {
  jar.set("weights", '{"exact_title":7}');
  const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
  vi.stubGlobal("fetch", fetchMock);
  await SearchPage(props);
  const url = new URL(fetchMock.mock.calls[0][0]);
  expect(url.searchParams.get("q")).toBe("oysters");
  expect(url.searchParams.get("weights")).toBe('{"exact_title":7}');
});

test("uses the default points when none are saved", async () => {
  const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
  vi.stubGlobal("fetch", fetchMock);
  await SearchPage(props);
  expect(new URL(fetchMock.mock.calls[0][0]).searchParams.has("weights")).toBe(false);
});

test("rejected saved points come with a link to fix them", async () => {
  jar.set("weights", '{"old_rule":5}');
  const detail = "Relevance points must be whole numbers from 0 to 200.";
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail }), { status: 422 })));
  render(await SearchPage(props));
  const alert = screen.getByRole("alert");
  expect(alert.textContent).toContain(detail);
  expect(within(alert).getByRole("link", { name: /relevance settings/i }).getAttribute("href")).toBe("/relevance");
});

test("forwards the Big Ten choice to the backend and keeps the box checked", async () => {
  const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
  vi.stubGlobal("fetch", fetchMock);
  render(await SearchPage({ ...props, searchParams: Promise.resolve({ q: "oysters", btaa: "1" }) }));
  expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get("btaa")).toBe("1");
  expect((screen.getByRole("checkbox", { name: "Include Big Ten libraries" }) as HTMLInputElement).checked).toBe(true);
});

test("searches UMD only unless the Big Ten box was checked", async () => {
  const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
  vi.stubGlobal("fetch", fetchMock);
  render(await SearchPage(props));
  expect(new URL(fetchMock.mock.calls[0][0]).searchParams.has("btaa")).toBe(false);
  expect((screen.getByRole("checkbox", { name: "Include Big Ten libraries" }) as HTMLInputElement).checked).toBe(false);
});
