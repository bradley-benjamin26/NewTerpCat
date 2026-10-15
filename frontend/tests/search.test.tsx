import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import axe from "axe-core";
import SearchForm from "../app/SearchForm";
import ResultsList, { type SearchResult } from "../app/ResultsList";

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
      date: "2015",
      url: "https://example.org/1",
      online: false,
      holdings: [{ location: "Stacks", call_number: "QC903 .A247 2015", status: "available" }],
    },
    {
      id: "2",
      title: "Adaptive Governance and Climate Change",
      author: "Brunner, Ronald D",
      date: "2010",
      url: "https://example.org/2",
      online: true,
      holdings: [],
    },
    {
      id: "3",
      title: "Mystery item",
      author: null,
      date: null,
      url: "https://example.org/3",
      online: false,
      holdings: [],
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
  ).toBe("https://example.org/1");
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
  await expectNoAxeViolations(container);
});
