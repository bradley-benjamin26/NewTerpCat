import { expect, test } from "vitest";
import { cite, plain, type Citable, type Style } from "../app/citations";

const book: Citable = {
  title: "The Chesapeake oyster : a history",
  authors: ["Kennedy, Victor S."],
  date: "2020",
  edition: "Second edition",
  publisher: "Johns Hopkins University Press",
  place: "Baltimore",
  isbns: [],
  url: null,
};
const text = (r: Partial<Citable>, style: Style) => plain(cite({ ...book, ...r }, style));

test("apa", () =>
  expect(text({}, "apa")).toBe(
    "Kennedy, V. S. (2020). The Chesapeake oyster: A history (Second edition). Johns Hopkins University Press.",
  ));

test("mla", () =>
  expect(text({}, "mla")).toBe(
    "Kennedy, Victor S. The Chesapeake Oyster: A History. Second edition, Johns Hopkins University Press, 2020.",
  ));

test("chicago", () =>
  expect(text({}, "chicago")).toBe(
    "Kennedy, Victor S. The Chesapeake Oyster: A History. Second edition. Baltimore: Johns Hopkins University Press, 2020.",
  ));

test("title is the italic part", () => {
  expect(cite(book, "mla").title).toBe("The Chesapeake Oyster: A History");
  expect(cite(book, "apa").title).toBe("The Chesapeake oyster: A history");
});

test("no double periods", () => {
  expect(text({ edition: "2nd ed." }, "chicago")).toBe(
    "Kennedy, Victor S. The Chesapeake Oyster: A History. 2nd ed. Baltimore: Johns Hopkins University Press, 2020.",
  );
  expect(text({ edition: "2nd ed.", publisher: null, date: null }, "mla")).toBe(
    "Kennedy, Victor S. The Chesapeake Oyster: A History. 2nd ed.",
  );
});

test("no author starts with the title", () => {
  expect(text({ authors: [] }, "apa")).toBe(
    "The Chesapeake oyster: A history (Second edition). (2020). Johns Hopkins University Press.",
  );
  expect(text({ authors: [] }, "mla")).toBe(
    "The Chesapeake Oyster: A History. Second edition, Johns Hopkins University Press, 2020.",
  );
});

test("corporate author used as is", () => {
  for (const style of ["apa", "mla", "chicago"] as Style[])
    expect(text({ authors: ["Maryland Sea Grant"] }, style)).toMatch(/^Maryland Sea Grant\. /);
});

test("name without comma is used as is", () => expect(text({ authors: ["Plato"] }, "apa")).toMatch(/^Plato\. \(2020\)/));

test("no year", () => {
  expect(text({ date: null }, "apa")).toMatch(/^Kennedy, V\. S\. \(n\.d\.\)\. /);
  expect(text({ date: null }, "mla")).toMatch(/University Press\.$/);
  expect(text({ date: null }, "chicago")).toMatch(/Baltimore: Johns Hopkins University Press\.$/);
});

test("no edition, publisher or place", () =>
  expect(text({ edition: null, publisher: null, place: null }, "chicago")).toBe(
    "Kennedy, Victor S. The Chesapeake Oyster: A History. 2020.",
  ));

test("title case keeps small words and capitals", () =>
  expect(cite({ ...book, title: "a tale of the USA in the 1900s : on and of" }, "mla").title).toBe(
    "A Tale of the USA in the 1900s: On and Of",
  ));

const people = (n: number) => Array.from({ length: n }, (_, i) => `Last${i + 1}, First${i + 1}`);
const apa = (i: number) => `Last${i}, F.`;
const direct = (i: number) => `First${i} Last${i}`;
const range = (from: number, to: number, f: (i: number) => string) =>
  Array.from({ length: to - from + 1 }, (_, i) => f(from + i)).join(", ");

test.each([
  [1, "apa", "Last1, F. (2020)."],
  [2, "apa", "Last1, F., & Last2, F. (2020)."],
  [3, "apa", "Last1, F., Last2, F., & Last3, F. (2020)."],
  [11, "apa", `${range(1, 10, apa)}, & Last11, F. (2020).`],
  [21, "apa", `${range(1, 19, apa)}, … Last21, F. (2020).`],
  [1, "mla", "Last1, First1. The"],
  [2, "mla", "Last1, First1, and First2 Last2. The"],
  [3, "mla", "Last1, First1, et al. The"],
  [11, "mla", "Last1, First1, et al. The"],
  [21, "mla", "Last1, First1, et al. The"],
  [1, "chicago", "Last1, First1. The"],
  [2, "chicago", "Last1, First1, and First2 Last2. The"],
  [3, "chicago", "Last1, First1, First2 Last2, and First3 Last3. The"],
  [11, "chicago", `Last1, First1, ${range(2, 7, direct)}, et al. The`],
  [21, "chicago", `Last1, First1, ${range(2, 7, direct)}, et al. The`],
] as [number, Style, string][])("%i authors in %s", (n, style, start) => {
  const t = text({ authors: people(n) }, style);
  expect(t.slice(0, start.length)).toBe(start);
});
