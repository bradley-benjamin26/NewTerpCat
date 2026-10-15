import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import SearchPage, { generateMetadata } from "../app/search/page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
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
