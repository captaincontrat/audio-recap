import { screen } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";

import { AppSidebar } from "@/components/workspace-shell/app-sidebar";
import { type BreadcrumbRootConfig } from "@/components/workspace-shell/breadcrumb-root-context";
import { UploadHeaderControl } from "@/components/workspace-shell/upload-manager/header-upload-control";
import { canSubmitToWorkspaceFromShellContext } from "@/components/workspace-shell/upload-manager/permissions";
import { UploadManagerProvider } from "@/components/workspace-shell/upload-manager/provider";
import { type WorkspaceShellContextValue, type WorkspaceShellMembership } from "@/components/workspace-shell/workspace-context";

import { makeShellContext, renderInShell } from "./_helpers";

const { mockUsePathname, mockUseRouter } = vi.hoisted(() => ({
  mockUsePathname: vi.fn<() => string | null>(),
  mockUseRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
}));

vi.mock("next/navigation", () => ({
  usePathname: mockUsePathname,
  useRouter: mockUseRouter,
}));

// `add-account-pages-inside-shell` task 4.1, 4.4. The account-shell
// layout (`app/(workspace-shell)/account/layout.tsx`) hosts
// `/account/security` and `/account/close` inside the shared shell.
// On those routes the shell context comes from
// `resolveDefaultWorkspaceContextForUser` rather than a URL slug, but
// every chrome consumer (sidebar, switcher, header upload control,
// drop overlay) MUST behave exactly as if it were on a workspace
// route. These tests mount the same composition the layout produces
// and pin down the cross-cutting behaviors:
//
//   - Sidebar nav links target the resolved default workspace (4.1).
//   - Workspace switcher highlights the resolved default workspace
//     and routes to `/w/<slug>` for every membership (4.1).
//   - Upload header control inherits archived/read-only rules from
//     the resolved default workspace's shell context (4.4).
//
// The breadcrumb root carries the `account` variant in every case so
// the chain never leaks the resolved workspace name into the
// breadcrumb (covered separately by `breadcrumb-band.test.tsx`).

const ACCOUNT_BREADCRUMB_ROOT: BreadcrumbRootConfig = {
  kind: "account",
  rootLabel: "Account",
  sectionLabels: { security: "Security", close: "Close account" },
};

const RESOLVED_DEFAULT: WorkspaceShellMembership = {
  id: "ws-default",
  slug: "riley",
  name: "Riley's Workspace",
  type: "personal",
  archivedAt: null,
};

const ARCHIVED_DEFAULT: WorkspaceShellMembership = {
  ...RESOLVED_DEFAULT,
  id: "ws-archived",
  archivedAt: new Date("2026-01-01").toISOString(),
};

const TEAM_OTHER: WorkspaceShellMembership = {
  id: "ws-team",
  slug: "team-summit",
  name: "Summit Team",
  type: "team",
  archivedAt: null,
};

// Mount a component under the same account-shell composition the
// layout produces: the workspace context resolves to the default
// workspace, the breadcrumb root variant is `account`, and the
// upload-manager provider is wired with the resolved workspace's
// permissions.
function renderInAccountShell(
  ui: ReactElement,
  {
    context,
    pathname,
    breadcrumbRoot = ACCOUNT_BREADCRUMB_ROOT,
  }: {
    context: WorkspaceShellContextValue;
    pathname: string;
    breadcrumbRoot?: BreadcrumbRootConfig;
  },
) {
  mockUsePathname.mockReturnValue(pathname);
  return renderInShell(<UploadShellWrapper context={context}>{ui}</UploadShellWrapper>, {
    context,
    breadcrumbRoot,
    transcriptsCount: 0,
  });
}

// The workspace-shell `_helpers.tsx` `renderInShell` mounts the
// breadcrumb / sidebar provider stack but not the upload-manager
// provider — chrome that needs it (header control, drop overlay,
// tray) wraps itself here. The `canSubmit` derivation matches the
// layout exactly: it reads from the resolved workspace context.
function UploadShellWrapper({ context, children }: { context: WorkspaceShellContextValue; children: ReactNode }) {
  const canSubmit = canSubmitToWorkspaceFromShellContext(context);
  return (
    <UploadManagerProvider workspaceSlug={context.workspace.slug} canSubmit={canSubmit}>
      {children}
    </UploadManagerProvider>
  );
}

describe("Account-shell composition: sidebar + switcher target resolved default (task 4.1)", () => {
  test("sidebar Overview and Transcripts links resolve to the default workspace's slug on /account/security", () => {
    renderInAccountShell(<AppSidebar />, {
      context: makeShellContext({ workspace: RESOLVED_DEFAULT, memberships: [RESOLVED_DEFAULT, TEAM_OTHER] }),
      pathname: "/account/security",
    });

    expect(screen.getByTestId("workspace-shell-nav-overview").getAttribute("href")).toBe(`/w/${RESOLVED_DEFAULT.slug}`);
    expect(screen.getByTestId("workspace-shell-nav-transcripts").getAttribute("href")).toBe(`/w/${RESOLVED_DEFAULT.slug}/transcripts`);
  });

  test("Overview and Transcripts are NOT marked active on /account/security (account routes do not match workspace nav)", () => {
    renderInAccountShell(<AppSidebar />, {
      context: makeShellContext({ workspace: RESOLVED_DEFAULT, memberships: [RESOLVED_DEFAULT, TEAM_OTHER] }),
      pathname: "/account/security",
    });

    expect(screen.getByTestId("workspace-shell-nav-overview").getAttribute("data-active")).toBe("false");
    expect(screen.getByTestId("workspace-shell-nav-transcripts").getAttribute("data-active")).toBe("false");
  });

  test("workspace switcher highlights the resolved default workspace as the current entry", () => {
    renderInAccountShell(<AppSidebar />, {
      context: makeShellContext({ workspace: RESOLVED_DEFAULT, memberships: [RESOLVED_DEFAULT, TEAM_OTHER] }),
      pathname: "/account/close",
    });

    const trigger = screen.getByTestId("workspace-shell-switcher-trigger");
    expect(trigger.textContent).toContain(RESOLVED_DEFAULT.name);
  });
});

describe("Account-shell composition: upload chrome inherits archived rules (task 4.4)", () => {
  test("header upload control is enabled when the resolved default workspace is active and the role can submit", () => {
    renderInAccountShell(<UploadHeaderControl />, {
      context: makeShellContext({ workspace: RESOLVED_DEFAULT, memberships: [RESOLVED_DEFAULT], currentRole: "admin" }),
      pathname: "/account/security",
    });

    const button = screen.getByTestId("workspace-shell-upload-header-control");
    expect(button.getAttribute("data-can-submit")).toBe("true");
    expect(button.hasAttribute("disabled")).toBe(false);
  });

  test("header upload control is disabled when the resolved default workspace is archived", () => {
    renderInAccountShell(<UploadHeaderControl />, {
      context: makeShellContext({ workspace: ARCHIVED_DEFAULT, memberships: [ARCHIVED_DEFAULT], currentRole: "admin" }),
      pathname: "/account/security",
    });

    const button = screen.getByTestId("workspace-shell-upload-header-control");
    expect(button.getAttribute("data-can-submit")).toBe("false");
    expect(button.hasAttribute("disabled")).toBe(true);
  });

  test("header upload control is disabled when the viewer's role on the resolved default workspace is read_only", () => {
    renderInAccountShell(<UploadHeaderControl />, {
      context: makeShellContext({ workspace: RESOLVED_DEFAULT, memberships: [RESOLVED_DEFAULT], currentRole: "read_only" }),
      pathname: "/account/security",
    });

    const button = screen.getByTestId("workspace-shell-upload-header-control");
    expect(button.getAttribute("data-can-submit")).toBe("false");
    expect(button.hasAttribute("disabled")).toBe(true);
  });
});
