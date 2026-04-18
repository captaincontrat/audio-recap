import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { SearchTrigger } from "@/components/workspace-shell/search-trigger";

import { renderInShell } from "./_helpers";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("SearchTrigger affordance (task 5.1 / 7.3)", () => {
  test("renders as a button (never an input) so typing has nowhere to go", () => {
    renderInShell(<SearchTrigger />);

    const trigger = screen.getByTestId("workspace-shell-search-trigger");
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger.getAttribute("type")).toBe("button");
    expect(screen.queryByRole("textbox", { name: /search/i })).toBeNull();
  });

  test("includes the keyboard shortcut in the accessible name and renders kbd hints", () => {
    renderInShell(<SearchTrigger />);

    const trigger = screen.getByTestId("workspace-shell-search-trigger");
    expect(trigger.getAttribute("aria-label")).toMatch(/Search this workspace \((⌘ K|Ctrl K)\)/);

    const kbds = trigger.querySelectorAll("[data-slot='kbd']");
    expect(kbds.length).toBeGreaterThanOrEqual(2);
    expect(Array.from(kbds).some((node) => node.textContent === "K")).toBe(true);
    const modifier = Array.from(kbds).find((node) => node.textContent !== "K");
    expect(["⌘", "Ctrl"]).toContain(modifier?.textContent);
  });

  test("clicking opens the command dialog", () => {
    renderInShell(<SearchTrigger />);

    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByTestId("workspace-shell-search-trigger"));
    expect(screen.getByRole("dialog")).not.toBeNull();
  });
});
