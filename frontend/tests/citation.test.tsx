import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import axe from "axe-core";
import Citation from "../app/Citation";
import { cite, plain, ris, type Citable } from "../app/citations";

const book: Citable = {
  title: "The Chesapeake oyster : a history",
  authors: ["Kennedy, Victor S."],
  date: "2020",
  edition: "Second edition",
  publisher: "Johns Hopkins University Press",
  place: "Baltimore",
  isbns: ["9781421437576"],
  url: "https://example.org/1",
};

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

test("shows APA first and switches style", () => {
  const { container } = render(<Citation record={book} />);
  expect(container.textContent).toContain("Kennedy, V. S. (2020).");
  fireEvent.change(screen.getByRole("combobox", { name: "Citation style" }), { target: { value: "mla" } });
  expect(container.textContent).toContain("Kennedy, Victor S. The Chesapeake Oyster");
});

test("citation is a live region", () => {
  const { container } = render(<Citation record={book} />);
  expect(container.querySelector("[aria-live=polite]")?.textContent).toBe(plain(cite(book, "apa")));
});

test("title is italic", () => {
  const { container } = render(<Citation record={book} />);
  expect(container.querySelector("i")?.textContent).toBe("The Chesapeake oyster: A history");
});

test("copy writes plain text and says Copied", async () => {
  render(<Citation record={book} />);
  fireEvent.click(screen.getByRole("button", { name: "Copy" }));
  await screen.findByText("Copied");
  expect(writeText).toHaveBeenCalledWith(plain(cite(book, "apa")));
});

test("download RIS saves citation.ris", async () => {
  render(<Citation record={book} />);
  fireEvent.click(screen.getByRole("button", { name: "Download RIS" }));
  expect(downloaded).toEqual(["citation.ris"]);
  expect(await (createObjectURL.mock.calls[0][0] as Blob).text()).toBe(ris([book]));
});

test("citation has no axe violations", async () => {
  const { container } = render(<Citation record={book} />);
  const { violations } = await axe.run(container);
  expect(violations.map((v) => v.id)).toEqual([]);
});
