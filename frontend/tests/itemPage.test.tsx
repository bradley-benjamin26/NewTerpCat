import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import axe from "axe-core";
import ItemPage, { generateMetadata } from "../app/item/[id]/page";
import NotFound from "../app/item/[id]/not-found";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function expectNoAxeViolations(container: HTMLElement) {
  const { violations } = await axe.run(container);
  expect(violations.map((v) => v.id)).toEqual([]);
}

const full = {
  id: "990036740560108238",
  title: "The Chesapeake oyster : a history",
  author: "Kennedy, Victor S.",
  date: "2020",
  url: "https://example.org/umd",
  online: true,
  holdings: [{ location: "McKeldin Library", call_number: "SH371 .K44 2020", status: "available" }],
  subjects: ["Oyster culture--Chesapeake Bay (Md. and Va.)"],
  oclc: null,
  umd: true,
  btaa: [],
  publication: "Baltimore : Johns Hopkins University Press, 2020",
  edition: "Second edition",
  description: "xii, 320 pages : illustrations ; 24 cm",
  series: "Chesapeake books ; 12",
  summary: "A history of the oyster in the bay",
  isbns: ["9781421437576", "1421437570"],
  contributors: ["Breitburg, Denise", "Maryland Sea Grant"],
  contents: ["Origins", "The fishery", "Restoration"],
  notes: [
    { label: "Note", texts: ["Cover title", "Shipping list no.: 2007-0043-P"] },
    { label: "Bibliography", texts: ["Includes bibliographical references"] },
  ],
};
const bare = {
  ...full,
  subjects: [],
  publication: null,
  edition: null,
  description: null,
  series: null,
  summary: null,
  isbns: [],
  contributors: [],
  contents: [],
  notes: [],
};
const bigTenOnly = (available: boolean) => ({
  ...bare,
  id: "rutgers:991",
  url: null,
  online: false,
  holdings: [],
  umd: false,
  btaa: [{ name: "Rutgers University", region: "east_coast", available }],
});

const props = (id = full.id) => ({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) });

function api(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

test("renders where to find it first, then the details", async () => {
  api(full);
  const { container } = render(await ItemPage(props()));
  expect(screen.getAllByRole("heading").map((h) => [h.tagName, h.textContent])).toEqual([
    ["H1", full.title],
    ["H2", "Where to find it"],
    ["H2", "Summary"],
    ["H2", "Details"],
    ["H2", "Subjects"],
    ["H2", "Contents"],
    ["H2", "Notes"],
  ]);
  const where = within(screen.getByRole("region", { name: "Where to find it" }));
  where.getByText("SH371 .K44 2020");
  where.getByText("Available online");
  expect(where.getByRole("link", { name: "Open in the UMD catalog" }).getAttribute("href")).toBe(full.url);

  const details = screen.getByRole("heading", { name: "Details" }).nextElementSibling!;
  expect(within(details as HTMLElement).getByText("Published").nextElementSibling?.textContent).toBe(full.publication);
  expect(within(details as HTMLElement).getByText("ISBN").nextElementSibling?.textContent).toMatch(
    /9781421437576.*1421437570/,
  );
  await expectNoAxeViolations(container);
});

test("labels each note with its type", async () => {
  api(full);
  render(await ItemPage(props()));
  const notes = screen.getByRole("heading", { name: "Notes" }).nextElementSibling as HTMLElement;
  expect(notes.tagName).toBe("DL");
  expect([...notes.querySelectorAll("dt, dd")].map((e) => `${e.tagName}:${e.textContent}`)).toEqual([
    "DT:Note",
    "DD:Cover title",
    "DD:Shipping list no.: 2007-0043-P",
    "DT:Bibliography",
    "DD:Includes bibliographical references",
  ]);
});

test("leaves out sections and details the record does not have", async () => {
  api(bare);
  render(await ItemPage(props()));
  for (const name of ["Summary", "Subjects", "Contents", "Notes"])
    expect(screen.queryByRole("heading", { name })).toBeNull();
  expect(screen.queryByText("Edition")).toBeNull();
});

test("says a Big Ten-only book is not held at UMD", async () => {
  api(bigTenOnly(true));
  render(await ItemPage(props("rutgers:991")));
  screen.getByText("Not held at UMD. Rutgers University has a copy: request it through interlibrary loan.");
  expect(screen.queryByRole("link", { name: "Open in the UMD catalog" })).toBeNull();
  cleanup();

  api(bigTenOnly(false));
  render(await ItemPage(props("rutgers:991")));
  screen.getByText("Not held at UMD. Rutgers University has it, but no copy is available right now.");
});

test("skips the call number line when a holding has none", async () => {
  api({ ...full, holdings: [{ location: "McKeldin Library", call_number: null, status: "available" }] });
  render(await ItemPage(props()));
  const where = screen.getByRole("region", { name: "Where to find it" });
  within(where).getByText("Available at UMD: McKeldin Library");
  expect(where.querySelectorAll("p:empty, span:empty")).toHaveLength(0);
});

test.each(["rutgers:991", "rutgers%3A991"])("fetches the record by its encoded ID (%s)", async (id) => {
  const fetchMock = api(bigTenOnly(true));
  await ItemPage(props(id));
  expect(fetchMock.mock.calls[0][0]).toMatch(/\/record\/rutgers%3A991$/);
});

test("shows not found for a missing record", async () => {
  api({ detail: "We couldn't find that record." }, 404);
  await expect(ItemPage(props("123"))).rejects.toMatchObject({ digest: expect.stringMatching(/^NEXT_HTTP_ERROR_FALLBACK;404/) });
});

test("shows not found for a malformed ID without calling the API", async () => {
  const fetchMock = api(full);
  await expect(ItemPage(props("%E0%A4%A"))).rejects.toMatchObject({ digest: expect.stringMatching(/^NEXT_HTTP_ERROR_FALLBACK;404/) });
  expect(fetchMock).not.toHaveBeenCalled();
});

test("not-found page explains and offers the search box", async () => {
  const { container } = render(<NotFound />);
  screen.getByText("We couldn't find that record. It may have been removed from the catalog. Search again above.");
  screen.getByRole("searchbox", { name: "Search the catalog" });
  await expectNoAxeViolations(container);
});

test("shows an alert when the catalog fails", async () => {
  api({ detail: "The library catalog is not responding. Try again shortly." }, 502);
  render(await ItemPage(props()));
  expect(screen.getByRole("alert").textContent).toBe("The library catalog is not responding. Try again shortly.");
  cleanup();

  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
  render(await ItemPage(props()));
  expect(screen.getByRole("alert").textContent).toBe("The library catalog is not responding. Try again shortly.");
});

test("page title names the book", async () => {
  api(full);
  expect((await generateMetadata(props())).title).toBe("The Chesapeake oyster : a history – NewTerpCat");
});

test("UMD item links to pickup and a chapter scan", async () => {
  api(full);
  render(await ItemPage(props()));
  const where = within(screen.getByRole("region", { name: "Where to find it" }));
  expect(where.getByRole("link", { name: "Request for pickup" }).getAttribute("href")).toBe(full.url);
  expect(where.getByRole("link", { name: "Request a chapter scan" }).getAttribute("href")).toContain(
    "isbn=9781421437576",
  );
});

test("Big Ten item links to interlibrary loan", async () => {
  api(bigTenOnly(true));
  render(await ItemPage(props("rutgers:991")));
  const where = within(screen.getByRole("region", { name: "Where to find it" }));
  where.getByRole("link", { name: "Request through interlibrary loan" });
});
