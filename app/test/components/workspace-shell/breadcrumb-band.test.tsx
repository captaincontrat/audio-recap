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
    mockUsePathname.mockReturnValue("/account/security");

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
