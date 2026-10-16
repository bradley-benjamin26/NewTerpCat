import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import axe from "axe-core";
import SearchForm from "../app/SearchForm";
import ResultsList, { type SearchResult } from "../app/ResultsList";
import Home from "../app/page";

afterEach(cleanup);

async function expectNoAxeViolations(container: HTMLElement) {
  const { violations } = await axe.run(container);
  expect(violations.map((v) => v.id)).toEqual([]);
}

const results: SearchResult = {
  total: 263,
  records: [
    {
      id: "1",
      title: "The adaptive challenge of climate change",
      author: null,
      authors: [],
      date: "2015",
      edition: null,
      publisher: null,
      place: null,
      url: "https://example.org/1",
      online: false,
      holdings: [{ location: "Stacks", call_number: "QC903 .A247 2015", status: "available" }],
      oclc: null,
      isbns: [],
      umd: true,
      btaa: [],
      score: 20,
      breakdown: [{ rule: "available_umd", label: "Available at UMD", points: 20 }],
    },
    {
      id: "2",
      title: "Adaptive Governance and Climate Change",
      author: "Brunner, Ronald D",
      authors: ["Brunner, Ronald D"],
      date: "2010",
      edition: null,
      publisher: "Columbia University Press",
      place: "New York",
      url: "https://example.org/2",
      online: true,
      holdings: [],
      oclc: null,
      isbns: [],
      umd: true,
      btaa: [],
      score: 20,
      breakdown: [{ rule: "available_umd", label: "Available at UMD", points: 20 }],
    },
    {
      id: "3",
      title: "Mystery item",
      author: null,
      authors: [],
      date: null,
      edition: null,
      publisher: null,
      place: null,
      url: "https://example.org/3",
      online: false,
      holdings: [],
      oclc: null,
      isbns: [],
      umd: true,
      btaa: [],
      score: 0,
      breakdown: [],
    },
  ],
};

test("search form has a labelled search box that submits q to /search", async () => {
  const { container } = render(<SearchForm defaultValue="oysters" />);
  const form = screen.getByRole("search");
  expect(form.getAttribute("action")).toBe("/search");
  const box = screen.getByRole("searchbox", { name: /search the catalog/i });
  expect(box.getAttribute("name")).toBe("q");
  expect((box as HTMLInputElement).value).toBe("oysters");
  expect((box as HTMLInputElement).required).toBe(true);
  screen.getByRole("button", { name: "Search" });
  await expectNoAxeViolations(container);
});

test("results list announces the count and shows each record", async () => {
  const { container } = render(<ResultsList query="climate change" result={results} />);
  screen.getByRole("heading", { level: 1, name: /263 results for “climate change”/i });

  const items = screen.getAllByRole("listitem");
  expect(items).toHaveLength(3);

  const first = within(items[0]);
  expect(
    first.getByRole("link", { name: "The adaptive challenge of climate change" }).getAttribute("href"),
  ).toBe("/item/1");
  first.getByText("2015");
  first.getByText(/Available at UMD.*Stacks.*QC903 \.A247 2015/);

  within(items[1]).getByText(/Brunner, Ronald D/);
  within(items[1]).getByText(/Available online/);
  within(items[2]).getByText(/Availability unknown/);

  await expectNoAxeViolations(container);
});

test("results list says so when nothing is found", () => {
  render(<ResultsList query="zzzz" result={{ total: 0, records: [] }} />);
  screen.getByRole("heading", { level: 1, name: /no results for “zzzz”/i });
  expect(screen.queryByRole("list")).toBeNull();
});

test("results heading uses singular for one result", () => {
  render(<ResultsList query="oysters" result={{ total: 1, records: [results.records[1]] }} />);
  screen.getByRole("heading", { level: 1, name: "1 result for “oysters”" });
});

test("availability distinguishes Alma statuses and skips missing call numbers", () => {
  const rec = {
    ...results.records[0],
    holdings: [
      { location: "Stacks", call_number: null, status: "available" },
      { location: "Annex", call_number: "QH1 .A1", status: "unavailable" },
      { location: "McKeldin", call_number: "QH2 .B2", status: "check_holdings" },
    ],
  };
  render(<ResultsList query="x" result={{ total: 1, records: [rec] }} />);
  screen.getByText("Available at UMD: Stacks");
  screen.getByText("Unavailable at UMD: Annex, QH1 .A1");
  screen.getByText("Check holdings at UMD: McKeldin, QH2 .B2");
  expect(screen.queryByText(/null/)).toBeNull();
});

test("results show what was searched, including LCSH headings and possible authors", async () => {
  const searched = [
    {
      operator: null,
      keywords: ["Toni", "Morrison", "slavery"],
      subjects: [
        { phrase: "french revolution", headings: ["French Revolution Bicentennial, 1989", "France--History--Revolution, 1789-1799"] },
      ],
      people: ["Toni Morrison"],
    },
  ];
  const { container } = render(<ResultsList query="novels by Toni Morrison about slavery" result={{ ...results, searched }} />);
  const section = screen.getByRole("region", { name: "What we searched" });
  within(section).getByText("Toni Morrison slavery");
  within(section).getByText(
    "“french revolution” matched French Revolution Bicentennial, 1989 or France--History--Revolution, 1789-1799",
  );
  within(section).getByText("Toni Morrison");
  await expectNoAxeViolations(container);
});

test("what was searched is shown even with no results, and says when no subject heading matched", () => {
  const searched = [{ operator: null, keywords: ["zzzz"], subjects: [], people: [] }];
  render(<ResultsList query="zzzz" result={{ total: 0, records: [], searched }} />);
  const section = screen.getByRole("region", { name: "What we searched" });
  within(section).getByText(/no matching subject headings/i);
  expect(within(section).queryByText(/possible authors/i)).toBeNull();
});

test("a Boolean query shows each part with the operator that joins it", async () => {
  const searched = [
    { operator: null, keywords: ["french", "revolution"], subjects: [], people: [] },
    { operator: "AND" as const, keywords: ["economy"], subjects: [], people: [] },
    { operator: "OR" as const, keywords: ["jazz"], subjects: [], people: [] },
    { operator: "NOT" as const, keywords: ["blues"], subjects: [], people: [] },
  ];
  const { container } = render(<ResultsList query="q" result={{ ...results, searched }} />);
  const section = screen.getByRole("region", { name: "What we searched" });
  within(section).getByText(/AND and NOT apply before OR/);
  const parts = within(within(section).getByRole("list")).getAllByRole("listitem");
  expect(parts).toHaveLength(4);
  within(parts[0]).getByText("french revolution");
  within(parts[1]).getByText(/^AND/);
  within(parts[2]).getByText(/^OR/);
  within(parts[3]).getByText(/^NOT/);
  within(parts[3]).getByText("blues");
  // Excluded parts are matched by keyword only, so no subject row that reads like a failed lookup.
  expect(within(parts[3]).queryByText(/subject headings/i)).toBeNull();
  await expectNoAxeViolations(container);
});

test("each result shows its relevance score and how the points add up", async () => {
  const rec = {
    ...results.records[0],
    score: 125,
    breakdown: [
      { rule: "exact_title", label: "Exact title match", points: 100 },
      { rule: "phrase", label: "Search words appear together in the title", points: 25 },
    ],
  };
  const { container } = render(
    <ResultsList query="x" result={{ total: 2, records: [rec, results.records[2]] }} />,
  );
  screen.getByText(/sorted by relevance score/i);
  const [first, second] = screen.getAllByRole("listitem");
  expect(within(first).getByText("Relevance: 125 points").getAttribute("aria-label")).toBe(
    "Relevance: 125 points for The adaptive challenge of climate change",
  );
  within(first).getByText("Exact title match");
  within(first).getByText("100 points");
  within(first).getByText("25 points");
  within(second).getByText("Relevance: 0 points");
  within(second).getByText(/no ranking rules matched/i);
  await expectNoAxeViolations(container);
});

test("home page and results link to the relevance settings", () => {
  render(<Home />);
  expect(screen.getByRole("link", { name: /relevance settings/i }).getAttribute("href")).toBe("/relevance");
  cleanup();
  render(<ResultsList query="climate" result={results} />);
  expect(screen.getByRole("link", { name: /relevance settings/i }).getAttribute("href")).toBe("/relevance");
});

test("shows a cover for a result with an ISBN", async () => {
  const withIsbn = { ...results.records[0], isbns: ["9781421437576"] };
  const { container } = render(<ResultsList query="oysters" result={{ ...results, records: [withIsbn, results.records[1]] }} />);
  const [first, second] = screen.getAllByRole("listitem");
  expect(first.querySelector("img")?.getAttribute("src")).toContain("isbn=9781421437576");
  expect(second.querySelector("img")).toBeNull();
  await expectNoAxeViolations(container);
});

const rutgers = { name: "Rutgers University", region: "east_coast", available: true };
const ucla = { name: "UCLA", region: "west_coast", available: true };
const bigTenOnly = {
  ...results.records[2],
  id: "rutgers:9",
  title: "Oyster culture",
  url: null,
  umd: false,
  btaa: [rutgers, ucla],
};

test("search form offers to include the Big Ten libraries", async () => {
  render(<SearchForm />);
  const box = screen.getByRole("checkbox", { name: "Include Big Ten libraries" }) as HTMLInputElement;
  expect(box.name).toBe("btaa");
  expect(box.value).toBe("1");
  expect(box.checked).toBe(false);
  cleanup();
  const { container } = render(<SearchForm btaa />);
  expect((screen.getByRole("checkbox", { name: "Include Big Ten libraries" }) as HTMLInputElement).checked).toBe(true);
  await expectNoAxeViolations(container);
});

test("a UMD book also at Big Ten libraries says it can come through interlibrary loan", () => {
  const rec = { ...results.records[0], btaa: [rutgers, { ...ucla, available: false }] };
  render(<ResultsList query="x" result={{ total: 1, records: [rec] }} />);
  screen.getByText(/Available at UMD.*Stacks/);
  screen.getByText("Also available through interlibrary loan from: Rutgers University");
});

test("a book not held at UMD says so, without a link to another library", async () => {
  const { container } = render(<ResultsList query="x" result={{ total: 1, records: [bigTenOnly] }} />);
  screen.getByRole("heading", { level: 2, name: "Oyster culture" });
  expect(screen.getByRole("link", { name: "Oyster culture" }).getAttribute("href")).toMatch(/^\/item\//);
  screen.getByText("Not held at UMD. Available through interlibrary loan from: Rutgers University, UCLA");
  expect(screen.queryByText(/Availability unknown/)).toBeNull();
  await expectNoAxeViolations(container);
});

test("a book not held at UMD and checked out everywhere says none are available", () => {
  const rec = { ...bigTenOnly, btaa: [{ ...rutgers, available: false }] };
  render(<ResultsList query="x" result={{ total: 1, records: [rec] }} />);
  screen.getByText("Not held at UMD. Held at Big Ten libraries, none currently available.");
});

test("with Big Ten libraries the heading counts UMD and the panel counts each library", async () => {
  const searched = [{ operator: null, keywords: ["oysters"], subjects: [], people: [] }];
  const libraries = [
    { name: "Rutgers University", total: 137 },
    { name: "Purdue University", total: 1 },
    { name: "UCLA", total: null },
  ];
  const { container } = render(<ResultsList query="oysters" result={{ ...results, searched, libraries }} />);
  screen.getByRole("heading", { level: 1, name: "263 results at UMD for “oysters”" });
  const section = screen.getByRole("region", { name: "What we searched" });
  within(section).getByText("Rutgers University: 137 matches");
  within(section).getByText("Purdue University: 1 match");
  within(section).getByText("UCLA: didn't respond");
  await expectNoAxeViolations(container);
});

test("books found only at Big Ten libraries are listed when UMD finds nothing", () => {
  const libraries = [{ name: "Rutgers University", total: 1 }];
  render(<ResultsList query="x" result={{ total: 0, records: [bigTenOnly], libraries }} />);
  screen.getByRole("heading", { level: 1, name: "0 results at UMD for “x”" });
  screen.getByRole("heading", { level: 2, name: "Oyster culture" });
});

test("result titles open the item page", () => {
  const record = { ...results.records[0], id: "rutgers:991", url: null, umd: false };
  render(<ResultsList query="climate change" result={{ ...results, records: [record] }} />);
  expect(screen.getByRole("link", { name: record.title }).getAttribute("href")).toBe("/item/rutgers%3A991");
});

test("each result has request links named with its title", async () => {
  const [first] = results.records;
  const second = { ...first, id: "9", title: "Oysters and the bay" };
  const { container } = render(<ResultsList query="q" result={{ total: 2, records: [first, second] }} />);
  const pickups = screen.getAllByRole("link", { name: /^Request for pickup: / });
  expect(pickups.map((a) => a.getAttribute("aria-label"))).toEqual([
    `Request for pickup: ${first.title}`,
    `Request for pickup: ${second.title}`,
  ]);
  expect(pickups[0].textContent).toBe("Request for pickup");
  await expectNoAxeViolations(container);
});

test("online-only result has no request links", () => {
  render(<ResultsList query="q" result={{ total: 1, records: [results.records[1]] }} />);
  expect(screen.queryByRole("link", { name: /^Request/ })).toBeNull();
});
