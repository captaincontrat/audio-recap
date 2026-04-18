"use client";

import { createContext, useContext } from "react";

// Shape of the membership entries the workspace switcher renders. The
// shell assembles these on the server (see `workspace-shell.tsx`) so
// the client never re-fetches the membership list on intra-shell
// navigation.
export type WorkspaceShellMembership = {
  id: string;
  slug: string;
  name: string;
  type: "personal" | "team";
  archivedAt: string | null;
};

export type WorkspaceShellWorkspace = WorkspaceShellMembership;

export type WorkspaceShellUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

export type WorkspaceShellContextValue = {
  workspace: WorkspaceShellWorkspace;
  memberships: WorkspaceShellMembership[];
  user: WorkspaceShellUser;
};

const WorkspaceShellContext = createContext<WorkspaceShellContextValue | null>(null);

export function WorkspaceShellContextProvider({ value, children }: { value: WorkspaceShellContextValue; children: React.ReactNode }) {
  return <WorkspaceShellContext.Provider value={value}>{children}</WorkspaceShellContext.Provider>;
}

export function useWorkspaceShell(): WorkspaceShellContextValue {
  const ctx = useContext(WorkspaceShellContext);
  if (!ctx) {
    throw new Error("useWorkspaceShell must be used inside <WorkspaceShellContextProvider>.");
  }
  return ctx;
}
