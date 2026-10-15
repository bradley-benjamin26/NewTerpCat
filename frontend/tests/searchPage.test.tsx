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
