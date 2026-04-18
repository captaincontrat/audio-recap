"use client";

import { createContext, useContext } from "react";

// Breadcrumb root configuration. The shared shell hosts both
// workspace-scoped routes (where the root crumb is the current
// workspace name) and authenticated user-scoped account-settings
// routes (where the root crumb is a non-workspace label like
// `Account`). This context lets the layout pick the variant once
// and lets the breadcrumb band stay agnostic about which surface it
// is rendering on.
//
// Variants:
// - `workspace`: the breadcrumb root reads the current workspace name
//   from `WorkspaceShellContext` (and the segment chain is derived
//   from `/w/<slug>/...`).
// - `account`: the breadcrumb root renders the localized account
//   label (e.g. `Account`); the segment chain is derived from
//   `/account/...`. Each known account sub-route carries its own
//   default final-crumb label, which the page can still override
//   through `usePushFinalCrumb`.
export type BreadcrumbRootConfig =
  | { kind: "workspace" }
  | {
      kind: "account";
      // Localized non-workspace root label (e.g. `Account`). The
      // shell layout passes this through after server-side i18n
      // resolution so the breadcrumb band never has to import the
      // translator on the client.
      rootLabel: string;
      // Localized default labels for the known account sub-routes.
      // The page can still call `usePushFinalCrumb` to override the
      // final crumb (mirroring the workspace-route behavior); these
      // defaults guarantee the band is meaningful even before the
      // override settles.
      sectionLabels: {
        security: string;
        close: string;
      };
    };

const DEFAULT_CONFIG: BreadcrumbRootConfig = { kind: "workspace" };

const BreadcrumbRootContext = createContext<BreadcrumbRootConfig>(DEFAULT_CONFIG);

export function BreadcrumbRootProvider({ value, children }: { value: BreadcrumbRootConfig; children: React.ReactNode }) {
  return <BreadcrumbRootContext.Provider value={value}>{children}</BreadcrumbRootContext.Provider>;
}

export function useBreadcrumbRoot(): BreadcrumbRootConfig {
  return useContext(BreadcrumbRootContext);
}
