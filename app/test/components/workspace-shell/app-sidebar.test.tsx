import { screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { AppSidebar } from "@/components/workspace-shell/app-sidebar";

import { makeShellContext, renderInShell } from "./_helpers";

const { mockUsePathname, mockUseRouter } = vi.hoisted(() => ({
  mockUsePathname: vi.fn<() => string | null>(),
  mockUseRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
}));

vi.mock("next/navigation", () => ({
  usePathname: mockUsePathname,
  useRouter: mockUseRouter,
}));

const SLUG = "riley";
const OVERVIEW_HREF = `/w/${SLUG}`;
const TRANSCRIPTS_HREF = `/w/${SLUG}/transcripts`;

describe("AppSidebar three-region composition (tasks 2.1–2.2 / 7.1)", () => {
  test("renders the workspace switcher, both nav destinations, and the user menu", () => {
    mockUsePathname.mockReturnValue(OVERVIEW_HREF);

    renderInShell(<AppSidebar />, { transcriptsCount: 12 });

    expect(screen.getByTestId("workspace-shell-switcher-trigger")).not.toBeNull();
    expect(screen.getByTestId("workspace-shell-user-menu-trigger")).not.toBeNull();

    const overview = screen.getByTestId("workspace-shell-nav-overview");
    expect(overview.tagName).toBe("A");
    expect(overview.getAttribute("href")).toBe(OVERVIEW_HREF);

    const transcripts = screen.getByTestId("workspace-shell-nav-transcripts");
    expect(transcripts.tagName).toBe("A");
    expect(transcripts.getAttribute("href")).toBe(TRANSCRIPTS_HREF);
  });

  test("preserves all destinations when the sidebar is icon-collapsed", () => {
    mockUsePathname.mockReturnValue(OVERVIEW_HREF);

    renderInShell(<AppSidebar />, { transcriptsCount: 0, defaultSidebarOpen: false });

    expect(screen.getByTestId("workspace-shell-switcher-trigger")).not.toBeNull();
    expect(screen.getByTestId("workspace-shell-nav-overview")).not.toBeNull();
    expect(screen.getByTestId("workspace-shell-nav-transcripts")).not.toBeNull();
    expect(screen.getByTestId("workspace-shell-user-menu-trigger")).not.toBeNull();
  });

  test("highlights Overview when the pathname is the workspace root and Transcripts otherwise", () => {
    mockUsePathname.mockReturnValue(OVERVIEW_HREF);
    const overview = renderInShell(<AppSidebar />, { transcriptsCount: 4 });
    expect(screen.getByTestId("workspace-shell-nav-overview").getAttribute("data-active")).toBe("true");
    expect(screen.getByTestId("workspace-shell-nav-transcripts").getAttribute("data-active")).toBe("false");
    overview.unmount();

    mockUsePathname.mockReturnValue(TRANSCRIPTS_HREF);
    const transcripts = renderInShell(<AppSidebar />, { transcriptsCount: 4 });
    expect(screen.getByTestId("workspace-shell-nav-overview").getAttribute("data-active")).toBe("false");
    expect(screen.getByTestId("workspace-shell-nav-transcripts").getAttribute("data-active")).toBe("true");
    transcripts.unmount();

    mockUsePathname.mockReturnValue(`${TRANSCRIPTS_HREF}/abc-123`);
    renderInShell(<AppSidebar />, { transcriptsCount: 4 });
    expect(screen.getByTestId("workspace-shell-nav-transcripts").getAttribute("data-active")).toBe("true");
  });

  test.each([
    [0, "0"],
    [42, "42"],
    [999, "999"],
    [1000, "1k+"],
    [4999, "4k+"],
  ] as const)("formats the transcripts count badge — %s renders as %s", (count, label) => {
    mockUsePathname.mockReturnValue(OVERVIEW_HREF);

    renderInShell(<AppSidebar />, { transcriptsCount: count });

    const badge = screen.getByTestId("workspace-shell-nav-transcripts-count");
    expect(badge.textContent).toBe(label);
  });

  test("hides the count badge when the cache provider is omitted", () => {
    mockUsePathname.mockReturnValue(OVERVIEW_HREF);

    renderInShell(<AppSidebar />, { transcriptsCount: null });

    expect(screen.queryByTestId("workspace-shell-nav-transcripts-count")).toBeNull();
  });

  test("encodes the workspace slug in nav destinations", () => {
    mockUsePathname.mockReturnValue(OVERVIEW_HREF);

    renderInShell(<AppSidebar />, {
      context: makeShellContext({
        workspace: { id: "ws", slug: "team/with space", name: "Team", type: "team", archivedAt: null },
      }),
      transcriptsCount: 0,
    });

    const overview = screen.getByTestId("workspace-shell-nav-overview");
    const transcripts = screen.getByTestId("workspace-shell-nav-transcripts");
    expect(overview.getAttribute("href")).toBe("/w/team%2Fwith%20space");
    expect(transcripts.getAttribute("href")).toBe("/w/team%2Fwith%20space/transcripts");
  });
});
