import { render, screen } from "@testing-library/react";
import Page from "app/page";
import { expect, test } from "vitest";

test("Page renders the ready heading", () => {
  render(<Page />);

  expect(screen.getByRole("heading", { level: 1, name: "Project ready!" })).toBeDefined();
});
