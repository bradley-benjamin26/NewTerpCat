import { afterEach, expect, test } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import axe from "axe-core";
import Cover from "../app/Cover";

afterEach(cleanup);

const SYNDETICS = "https://proxy-na.hosted.exlibrisgroup.com/exl_rewrite/syndetics.com/index.php?client=primo&isbn=9781421437576/SC.JPG";
const OPEN_LIBRARY = "https://covers.openlibrary.org/b/isbn/9781421437576-M.jpg?default=false";

function load(img: HTMLImageElement, width: number, height: number) {
  Object.defineProperty(img, "naturalWidth", { value: width, configurable: true });
  Object.defineProperty(img, "naturalHeight", { value: height, configurable: true });
  fireEvent.load(img);
}

const img = (c: HTMLElement) => c.querySelector("img")!;

test("shows the Syndetics cover first", () => {
  const { container } = render(<Cover isbns={["9781421437576", "1421437570"]} />);
  expect(img(container).getAttribute("src")).toBe(SYNDETICS);
  expect(img(container).getAttribute("alt")).toBe("");
  expect(img(container).getAttribute("loading")).toBe("lazy");
});

test("strips the qualifier", () => {
  const { container } = render(<Cover isbns={["9780143127550 (paperback)"]} />);
  expect(img(container).getAttribute("src")).toContain("isbn=9780143127550/SC.JPG");
});

test("keeps a tall Syndetics image", () => {
  const { container } = render(<Cover isbns={["9781421437576"]} />);
  load(img(container), 100, 150);
  expect(img(container).getAttribute("src")).toBe(SYNDETICS);
});

test("switches to Open Library on a square placeholder", () => {
  const { container } = render(<Cover isbns={["9781421437576"]} />);
  load(img(container), 100, 100);
  expect(img(container).getAttribute("src")).toBe(OPEN_LIBRARY);
});

test("switches to Open Library on an error", () => {
  const { container } = render(<Cover isbns={["9781421437576"]} />);
  fireEvent.error(img(container));
  expect(img(container).getAttribute("src")).toBe(OPEN_LIBRARY);
});

test("renders nothing when both fail", () => {
  const { container } = render(<Cover isbns={["9781421437576"]} />);
  fireEvent.error(img(container));
  fireEvent.error(img(container));
  expect(container.querySelector("img")).toBeNull();
});

test("renders nothing without an ISBN", () => {
  const { container } = render(<Cover isbns={[]} />);
  expect(container.innerHTML).toBe("");
});

test("restarts on new isbn", () => {
  const { container, rerender } = render(<Cover isbns={["9781421437576"]} />);
  fireEvent.error(img(container));
  rerender(<Cover isbns={["9780143127550"]} />);
  expect(img(container).getAttribute("src")).toContain("syndetics.com/index.php?client=primo&isbn=9780143127550/SC.JPG");
});

test("has no accessibility violations", async () => {
  const { container } = render(<Cover isbns={["9781421437576"]} />);
  const { violations } = await axe.run(container);
  expect(violations.map((v) => v.id)).toEqual([]);
});
