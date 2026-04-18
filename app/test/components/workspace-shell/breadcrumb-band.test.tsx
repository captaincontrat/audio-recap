import { screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { BreadcrumbBand } from "@/components/workspace-shell/breadcrumb-band";
import { FinalBreadcrumb } from "@/components/workspace-shell/final-breadcrumb";

import { makeShellContext, renderInShell } from "./_helpers";

const { mockUsePathname } = vi.hoisted(() => ({
  mockUsePathname: vi.fn<() => string | null>(),
}));

vi.mock("next/navigation", () => ({
  usePathname: mockUsePathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const SLUG = "riley";
const ROOT = `/w/${SLUG}`;

describe("BreadcrumbBand workspace root (task 4.2 / 7.2)", () => {
  test("renders the workspace as the page crumb when the route is the workspace root", () => {
    mockUsePathname.mockReturnValue(ROOT);

    renderInShell(<BreadcrumbBand />);

    const root = screen.getByTestId("workspace-shell-breadcrumb-root");
    expect(root.tagName).toBe("SPAN");
    expect(root.getAttribute("aria-current")).toBe("page");
    expect(root.textContent).toBe("Riley's Workspace");
    expect(screen.queryByTestId("workspace-shell-breadcrumb-page")).toBeNull();
  });

  test("renders the workspace as a link when the route has a sub-path", () => {
    mockUsePathname.mockReturnValue(`${ROOT}/transcripts`);

    renderInShell(<BreadcrumbBand />);

    const root = screen.getByTestId("workspace-shell-breadcrumb-root");
    expect(root.tagName).toBe("A");
    expect(root.getAttribute("href")).toBe(ROOT);
    expect(root.getAttribute("aria-current")).toBeNull();
  });

  test("falls back to the slug when the workspace name is empty", () => {
    mockUsePathname.mockReturnValue(ROOT);

    renderInShell(<BreadcrumbBand />, {
      context: makeShellContext({
        workspace: { id: "ws", slug: SLUG, name: "", type: "personal", archivedAt: null },
      }),
    });

    expect(screen.getByTestId("workspace-shell-breadcrumb-root").textContent).toBe(SLUG);
  });

  test("renders nothing past the workspace root when the pathname is not workspace-scoped", () => {
    mockUsePathname.mockReturnValue("/some/unrelated/path");

    renderInShell(<BreadcrumbBand />);

    expect(screen.getByTestId("workspace-shell-breadcrumb-root").textContent).toBe("Riley's Workspace");
    expect(screen.queryByTestId("workspace-shell-breadcrumb-middle")).toBeNull();
    expect(screen.queryByTestId("workspace-shell-breadcrumb-page")).toBeNull();
  });
});

describe("BreadcrumbBand final-crumb humanisation (tasks 4.3–4.4 / 7.2)", () => {
  test("humanises a known sub-root segment", () => {
    mockUsePathname.mockReturnValue(`${ROOT}/transcripts`);

    renderInShell(<BreadcrumbBand />);

    const final = screen.getByTestId("workspace-shell-breadcrumb-page");
    expect(final.textContent).toBe("Transcripts");
    expect(final.className).toContain("truncate");
    expect(final.className).toContain("max-w-full");
  });

  test("shortens an opaque uuid-like final segment", () => {
    const id = "0a1b2c3d-4e5f-6789-abcd-ef0123456789";
    mockUsePathname.mockReturnValue(`${ROOT}/transcripts/${id}`);

    renderInShell(<BreadcrumbBand />);

    expect(screen.getByTestId("workspace-shell-breadcrumb-page").textContent).toBe("0a1b2c3d…");
  });

  test("decodes percent-escaped final segments before falling back", () => {
    mockUsePathname.mockReturnValue(`${ROOT}/${encodeURIComponent("hello world")}`);

    renderInShell(<BreadcrumbBand />);

    expect(screen.getByTestId("workspace-shell-breadcrumb-page").textContent).toBe("hello world");
  });

  test("lets a page override the final crumb via usePushFinalCrumb", () => {
    mockUsePathname.mockReturnValue(`${ROOT}/transcripts/0a1b2c3d-4e5f-6789-abcd-ef0123456789`);

    renderInShell(
      <>
        <BreadcrumbBand />
        <FinalBreadcrumb label="Quarterly review with the founders" />
      </>,
    );

    expect(screen.getByTestId("workspace-shell-breadcrumb-page").textContent).toBe("Quarterly review with the founders");
  });
});

describe("BreadcrumbBand middle-crumb collapse (task 4.3 / 7.2)", () => {
  test("renders a single middle crumb inline", () => {
    mockUsePathname.mockReturnValue(`${ROOT}/transcripts/abc-def-ghij-klmn`);

    renderInShell(<BreadcrumbBand />);

    const middles = screen.getAllByTestId("workspace-shell-breadcrumb-middle");
    expect(middles).toHaveLength(1);
    expect(middles[0]?.textContent).toBe("Transcripts");
    expect(middles[0]?.getAttribute("href")).toBe(`${ROOT}/transcripts`);
    expect(screen.queryByTestId("workspace-shell-breadcrumb-ellipsis")).toBeNull();
  });

  test("collapses overflow middle crumbs into an ellipsis dropdown when the chain has 3+ segments", () => {
    mockUsePathname.mockReturnValue(`${ROOT}/meetings/2024-q4/sessions/new`);

    renderInShell(<BreadcrumbBand />);

    const middles = screen.getAllByTestId("workspace-shell-breadcrumb-middle");
    expect(middles).toHaveLength(1);
    expect(middles[0]?.textContent).toBe("Meetings");
    expect(middles[0]?.getAttribute("href")).toBe(`${ROOT}/meetings`);

    const ellipsis = screen.getByTestId("workspace-shell-breadcrumb-ellipsis");
    expect(ellipsis.getAttribute("aria-label")).toBe("More breadcrumb segments");

    const final = screen.getByTestId("workspace-shell-breadcrumb-page");
    expect(final.textContent).toBe("New");
  });

  test("workspace root keeps shrink-0 so it never collapses with the middle chain", () => {
    mockUsePathname.mockReturnValue(`${ROOT}/meetings/2024-q4/sessions/notes`);

    renderInShell(<BreadcrumbBand />);

    const root = screen.getByTestId("workspace-shell-breadcrumb-root");
    const rootItem = root.closest("[data-slot='breadcrumb-item']");
    expect(rootItem?.className).toContain("shrink-0");
  });
});

// Account-root variant exercised by `add-account-pages-inside-shell`
// (tasks 2.1, 2.2, 4.2). The shell layout swaps the breadcrumb root
// to the localized non-workspace label on `/account/...` routes; the
// resolved default workspace stays in `WorkspaceShellContext` for the
// rest of the chrome but the breadcrumb chain MUST NOT mention it.
const ACCOUNT_BREADCRUMB_ROOT = {
  kind: "account" as const,
  rootLabel: "Account",
  sectionLabels: { security: "Security", close: "Close account" },
};

describe("BreadcrumbBand account root (add-account-pages-inside-shell tasks 2.1 / 4.2)", () => {
  test("renders the localized account label as the page crumb on /account/security", () => {
    mockUsePathname.mockReturnValue("/account/security");

    renderInShell(<BreadcrumbBand />, { breadcrumbRoot: ACCOUNT_BREADCRUMB_ROOT });

    const root = screen.getByTestId("workspace-shell-breadcrumb-root");
    expect(root.textContent).toBe("Account");
    expect(root.getAttribute("data-root-kind")).toBe("account");
    expect(root.tagName).toBe("A");
    expect(root.getAttribute("href")).toBe("/account/security");

    const final = screen.getByTestId("workspace-shell-breadcrumb-page");
    expect(final.textContent).toBe("Security");
  });

  test("renders the localized account label as the page crumb on /account/close", () => {
    mockUsePathname.mockReturnValue("/account/close");

    renderInShell(<BreadcrumbBand />, { breadcrumbRoot: ACCOUNT_BREADCRUMB_ROOT });

    expect(screen.getByTestId("workspace-shell-breadcrumb-root").textContent).toBe("Account");
    expect(screen.getByTestId("workspace-shell-breadcrumb-page").textContent).toBe("Close account");
  });

  test("never surfaces the resolved workspace name in the chain on account routes", () => {
    mockUsePathname.mockReturnValue("/account/security");

    renderInShell(<BreadcrumbBand />, { breadcrumbRoot: ACCOUNT_BREADCRUMB_ROOT });

    const band = screen.getByTestId("workspace-shell-breadcrumb-band");
    expect(band.textContent).not.toContain("Riley's Workspace");
    expect(band.textContent).not.toContain("riley");
  });

  test("preserves truncation priority on account routes: root keeps shrink-0, final truncates first", () => {
    mockUsePathname.mockReturnValue("/account/security");

    renderInShell(<BreadcrumbBand />, { breadcrumbRoot: ACCOUNT_BREADCRUMB_ROOT });

    const root = screen.getByTestId("workspace-shell-breadcrumb-root");
    const rootItem = root.closest("[data-slot='breadcrumb-item']");
    expect(rootItem?.className).toContain("shrink-0");

    const final = screen.getByTestId("workspace-shell-breadcrumb-page");
    expect(final.className).toContain("truncate");
    expect(final.className).toContain("max-w-full");
  });
});
