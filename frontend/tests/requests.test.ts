import { expect, test } from "vitest";
import type { CatalogRecord } from "../app/ResultsList";
import { requestLinks } from "../app/requests";

const ILLIAD = "https://docdel.umd.edu/illiad/illiad.dll/OpenURL";

const umd: CatalogRecord = {
  id: "1",
  title: "Oysters & bays: a history",
  author: "Kennedy, Victor",
  authors: ["Kennedy, Victor"],
  date: "2020",
  edition: null,
  publisher: null,
  place: null,
  url: "https://primo.example/1",
  online: false,
  holdings: [{ location: "Stacks", call_number: "SH371", status: "available" }],
  oclc: "123",
  isbns: [],
  umd: true,
  btaa: [],
  score: 0,
  breakdown: [],
};
const bigTen = { ...umd, id: "rutgers:1", url: null, holdings: [], umd: false };

const labels = (r: Parameters<typeof requestLinks>[0]) => requestLinks(r).map((l) => l.label);
const params = (href: string) => new URL(href).searchParams;

test("UMD with a holding offers pickup then a chapter scan", () => {
  expect(labels(umd)).toEqual(["Request for pickup", "Request a chapter scan"]);
  expect(requestLinks(umd)[0].href).toBe(umd.url);
});

test("UMD with no holding and not online offers another library", () => {
  expect(requestLinks({ ...umd, holdings: [] })).toEqual([{ label: "Request from another library", href: umd.url }]);
});

test("UMD online only offers nothing", () => {
  expect(requestLinks({ ...umd, holdings: [], online: true })).toEqual([]);
});

test("UMD with no url offers no Primo link", () => {
  expect(labels({ ...umd, url: null })).toEqual(["Request a chapter scan"]);
});

test("Big Ten offers a loan then a chapter scan", () => {
  expect(labels(bigTen)).toEqual(["Request through interlibrary loan", "Request a chapter scan"]);
});

test("OpenURL carries the record", () => {
  const [loan, scan] = requestLinks(bigTen).map((l) => l.href);
  const url = new URL(scan);
  expect(url.origin + url.pathname).toBe(ILLIAD);
  expect(Object.fromEntries(url.searchParams)).toEqual({
    sid: "NewTerpCat",
    genre: "bookitem",
    title: "Oysters & bays: a history",
    au: "Kennedy, Victor",
    date: "2020",
    rfe_dat: "123",
  });
  expect(url.searchParams.getAll("title")).toHaveLength(1);
  expect(params(loan).get("genre")).toBe("book");
});

test("OpenURL uses the first ISBN", () => {
  expect(params(requestLinks({ ...bigTen, isbns: ["111", "222"] })[0].href).get("isbn")).toBe("111");
});

test("OpenURL drops empty fields", () => {
  const href = requestLinks({ ...bigTen, author: null, date: null, oclc: null })[0].href;
  expect([...params(href).keys()]).toEqual(["sid", "genre", "title"]);
});

test("OpenURL drops the ISBN's qualifier", () => {
  expect(params(requestLinks({ ...bigTen, isbns: ["0801812345 (alk. paper)"] })[0].href).get("isbn")).toBe("0801812345");
});
