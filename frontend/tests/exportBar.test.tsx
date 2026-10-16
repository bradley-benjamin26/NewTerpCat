import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import axe from "axe-core";
import ResultsList, { type CatalogRecord, type SearchResult } from "../app/ResultsList";
import { cite, plain, ris } from "../app/citations";

const record = (id: string, title: string, author: string): CatalogRecord => ({
  id,
  title,
  author,
  authors: [author],
  date: "2020",
  edition: null,
  publisher: "Press",
  place: null,
  url: `https://example.org/${id}`,
  online: false,
  holdings: [],
  oclc: null,
  isbns: [],
  umd: true,
  btaa: [],
  score: 0,
  breakdown: [],
});
const [zeta, alpha, mid] = [
  record("1", "Zeta book", "Zimmer, Zoe"),
  record("2", "Alpha book", "Adams, Amy"),
  record("3", "Middle book", "Moore, Max"),
];
const result: SearchResult = { total: 3, records: [zeta, alpha, mid] };

let writeText: ReturnType<typeof vi.fn>;
let createObjectURL: ReturnType<typeof vi.fn>;
let downloaded: string[];

beforeEach(() => {
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  createObjectURL = vi.fn(() => "blob:test");
  URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn();
  downloaded = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    downloaded.push(this.download);
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const status = () => screen.getByRole("region", { name: "Export citations" }).querySelector("[role=status]")!;
const select = (title: string) => fireEvent.click(screen.getByRole("checkbox", { name: `Select ${title}` }));

test("count follows checkbox clicks", () => {
  render(<ResultsList query="book" result={result} />);
  select("Alpha book");
  expect(status().textContent).toBe("1 selected");
});

test("select all checks every result", () => {
  render(<ResultsList query="book" result={result} />);
  const all = screen.getByRole("checkbox", { name: "Select all" });
  fireEvent.click(all);
  for (const r of result.records)
    expect((screen.getByRole("checkbox", { name: `Select ${r.title}` }) as HTMLInputElement).checked).toBe(true);
  expect(status().textContent).toBe("3 selected");
  fireEvent.click(all);
  expect(status().textContent).toBe("0 selected");
});

test("download exports only checked records", async () => {
  render(<ResultsList query="book" result={result} />);
  select("Zeta book");
  select("Middle book");
  const region = within(screen.getByRole("region", { name: "Export citations" }));
  fireEvent.click(region.getByRole("button", { name: "Download RIS" }));
  expect(downloaded).toEqual(["citations.ris"]);
  expect(await (createObjectURL.mock.calls[0][0] as Blob).text()).toBe(ris([zeta, mid]));
});

test("copy sorts the checked citations", async () => {
  render(<ResultsList query="book" result={result} />);
  select("Zeta book");
  select("Alpha book");
  const region = screen.getByRole("region", { name: "Export citations" });
  fireEvent.change(region.querySelector("select")!, { target: { value: "mla" } });
  fireEvent.click(screen.getByRole("button", { name: "Copy citations" }));
  await vi.waitFor(() => expect(status().textContent).toBe("Copied"));
  expect(writeText).toHaveBeenCalledWith([alpha, zeta].map((r) => plain(cite(r, "mla"))).join("\n"));
});

test("nothing selected", () => {
  render(<ResultsList query="book" result={result} />);
  fireEvent.click(screen.getByRole("button", { name: "Copy citations" }));
  expect(status().textContent).toBe("Select at least one result");
  expect(writeText).not.toHaveBeenCalled();
});

test("export heading is reachable", () => {
  render(<ResultsList query="book" result={result} />);
  screen.getByRole("heading", { name: "Export citations" });
});

test("results with export have no axe violations", async () => {
  const { container } = render(<ResultsList query="book" result={result} />);
  const { violations } = await axe.run(container);
  expect(violations.map((v) => v.id)).toEqual([]);
});
