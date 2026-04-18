import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import { Brand } from "@/components/workspace-shell/brand";

import { makeShellContext } from "./_helpers";
import { WorkspaceShellContextProvider } from "@/components/workspace-shell/workspace-context";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

function renderBrand({ open }: { open: boolean }) {
  return render(
    <WorkspaceShellContextProvider value={makeShellContext()}>
      <SidebarProvider defaultOpen={open}>
        <Brand />
      </SidebarProvider>
    </WorkspaceShellContextProvider>,
  );
}

describe("Brand collapse rule (task 3.1 / 7.1)", () => {
  test("shows the wordmark when the sidebar is expanded", () => {
    renderBrand({ open: true });

    const brand = screen.getByTestId("workspace-shell-brand");
    expect(brand.getAttribute("data-collapsed")).toBe("false");

    const wordmark = brand.querySelector("[data-slot='brand-wordmark']");
    expect(wordmark).not.toBeNull();
    expect(wordmark?.textContent).toBe("Summitdown");
    expect(wordmark?.className).toContain("inline");
    expect(wordmark?.className).not.toContain("hidden");
  });

  test("hides the wordmark and shows only the mark when the sidebar is icon-collapsed", () => {
    renderBrand({ open: false });

    const brand = screen.getByTestId("workspace-shell-brand");
    expect(brand.getAttribute("data-collapsed")).toBe("true");

    const wordmark = brand.querySelector("[data-slot='brand-wordmark']");
    expect(wordmark?.className).toContain("hidden");
    expect(wordmark?.className).not.toContain("inline");
  });

  test("links to the workspace overview, encoding the slug", () => {
    render(
      <WorkspaceShellContextProvider
        value={makeShellContext({ workspace: { id: "ws", slug: "team/with space", name: "Team", type: "team", archivedAt: null } })}
      >
        <SidebarProvider defaultOpen>
          <Brand />
        </SidebarProvider>
      </WorkspaceShellContextProvider>,
    );

    const brand = screen.getByTestId("workspace-shell-brand");
    expect(brand.getAttribute("href")).toBe("/w/team%2Fwith%20space");
    expect(brand.getAttribute("aria-label")).toBe("Summitdown — workspace overview");
  });
});
