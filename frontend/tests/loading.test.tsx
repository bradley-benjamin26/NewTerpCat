import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import axe from "axe-core";
import SearchLoading from "../app/search/loading";
import ItemLoading from "../app/item/[id]/loading";

afterEach(cleanup);

test.each([
  ["search", SearchLoading, "Searching the catalog…"],
  ["item", ItemLoading, "Loading the record…"],
])("the %s page shows the search box and announces that it is loading", async (_, Loading, message) => {
  const { container } = render(<Loading />);
  screen.getByRole("searchbox", { name: "Search the catalog" });
  expect(screen.getByRole("status").textContent).toBe(message);
  const { violations } = await axe.run(container);
  expect(violations.map((v) => v.id)).toEqual([]);
});
