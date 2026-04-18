"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

// The shell's `⌘K` shortcut MUST NOT hijack keystrokes while the user
// is mid-edit on a transcript (see `add-workspace-app-shell` task
// 5.3). The transcript detail view publishes its `isEditing` state
// here, and the command palette consults the context — combined with
// the active element's tag — before opening on the shortcut.
type EditSessionPresenceContextValue = {
  isActive: boolean;
  setActive(active: boolean): void;
};

const EditSessionPresenceContext = createContext<EditSessionPresenceContextValue | null>(null);

export function EditSessionPresenceProvider({ children }: { children: React.ReactNode }) {
  const [isActive, setActive] = useState(false);
  const value = useMemo<EditSessionPresenceContextValue>(() => ({ isActive, setActive }), [isActive]);
  return <EditSessionPresenceContext.Provider value={value}>{children}</EditSessionPresenceContext.Provider>;
}

// Read-only accessor consumed by the command palette to gate the
// global shortcut.
export function useEditSessionPresence(): boolean {
  return useContext(EditSessionPresenceContext)?.isActive ?? false;
}

// Publisher hook used by the transcript detail view. Outside the
// shell the hook is a no-op, so the detail view stays usable in
// isolated tests or storybook.
export function usePublishEditSessionPresence(active: boolean) {
  const ctx = useContext(EditSessionPresenceContext);
  useEffect(() => {
    if (!ctx) return;
    ctx.setActive(active);
    return () => {
      ctx.setActive(false);
    };
  }, [active, ctx]);
}
