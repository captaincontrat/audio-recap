import { render, type RenderResult } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { UploadManagerProvider } from "@/components/workspace-shell/upload-manager/provider";
import { getUploadManagerStore } from "@/components/workspace-shell/upload-manager/store";
import { WorkspaceShellContextProvider, type WorkspaceShellContextValue, type WorkspaceShellMembership } from "@/components/workspace-shell/workspace-context";

// Default fixtures used by every upload-manager test. Helpers spread
// over these so individual cases only spell out the surface they care
// about (a different role, an archived workspace, a different slug).

export const DEFAULT_WORKSPACE: WorkspaceShellMembership = {
  id: "ws-personal",
  slug: "riley",
  name: "Riley's Workspace",
  type: "personal",
  archivedAt: null,
};

export function makeUploadShellContext(overrides: Partial<WorkspaceShellContextValue> = {}): WorkspaceShellContextValue {
  return {
    workspace: overrides.workspace ?? DEFAULT_WORKSPACE,
    memberships: overrides.memberships ?? [DEFAULT_WORKSPACE],
    user: overrides.user ?? { id: "user-1", name: "Riley", email: "riley@summitdown.test", image: null },
    currentRole: overrides.currentRole ?? "admin",
  };
}

export type RenderUploadOptions = {
  context?: WorkspaceShellContextValue;
  canSubmit?: boolean;
  workspaceSlugOverride?: string;
};

// Mount a component beneath the upload-manager provider stack. The
// shell context is required so deeper consumers (header control,
// drop overlay) can read the workspace name and viewer's role.
export function renderInUploadShell(ui: ReactElement, options: RenderUploadOptions = {}): RenderResult {
  const context = options.context ?? makeUploadShellContext();
  const slug = options.workspaceSlugOverride ?? context.workspace.slug;
  const canSubmit = options.canSubmit ?? (!context.workspace.archivedAt && context.currentRole !== "read_only");

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <WorkspaceShellContextProvider value={context}>
        <TooltipProvider delayDuration={0}>
          <UploadManagerProvider workspaceSlug={slug} canSubmit={canSubmit}>
            {children}
          </UploadManagerProvider>
        </TooltipProvider>
      </WorkspaceShellContextProvider>
    );
  }

  return render(ui, { wrapper: Wrapper });
}

// Tear the singleton store down between tests so items added in one
// case do not leak into another. Tests opt in by importing
// `useFreshUploadManagerStore` at the top of the suite.
export function useFreshUploadManagerStore(): void {
  beforeEach(() => {
    getUploadManagerStore().__resetForTests();
  });
  afterEach(() => {
    getUploadManagerStore().__resetForTests();
  });
}

// Helper for tests that need a concrete File instance. jsdom supports
// `File` natively so this is just a thin wrapper.
export function makeFile(name: string, contents = "audio-bytes"): File {
  return new File([contents], name, { type: "audio/mpeg" });
}
