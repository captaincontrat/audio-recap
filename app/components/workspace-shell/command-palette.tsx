"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { Command, CommandDialog, CommandEmpty, CommandInput, CommandList } from "@/components/ui/command";

import { useEditSessionPresence } from "./edit-session-presence-context";

// Pre-launch search modal owned by `add-workspace-app-shell`. The
// dialog renders a real `Command` + `CommandInput` but no
// `CommandItem`s — the empty state is the surface (per task 5.2). The
// shortcut is wired here so the rest of the shell can stay focused on
// chrome composition.
type CommandPaletteContextValue = {
  open: boolean;
  setOpen(open: boolean): void;
  toggle(): void;
};

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) {
    throw new Error("useCommandPalette must be used inside <CommandPaletteProvider>.");
  }
  return ctx;
}

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const isEditingTranscript = useEditSessionPresence();

  const toggle = useCallback(() => {
    setOpen((current) => !current);
  }, []);

  // Global `⌘K` / `Ctrl+K` listener. Suppressed when the active
  // element is an input/textarea/contenteditable inside an active
  // transcript edit session — without this guard the shortcut would
  // hijack typing in the recap or transcript editor (task 5.3).
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) return;
      if (event.key?.toLowerCase() !== "k") return;
      if (!event.metaKey && !event.ctrlKey) return;
      if (event.altKey || event.shiftKey) return;
      if (isEditingTranscript && isTypingTarget(event.target)) return;
      event.preventDefault();
      setOpen((current) => !current);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isEditingTranscript]);

  // Reset the query each time the dialog closes so the next open
  // starts fresh; users opening from a stale query is jarring.
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const value = useMemo<CommandPaletteContextValue>(() => ({ open, setOpen, toggle }), [open, toggle]);

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Workspace search"
        description="Search across this workspace. The full search experience launches in a follow-up release."
      >
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search this workspace…" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>{emptyStateLabel(query)}</CommandEmpty>
          </CommandList>
        </Command>
      </CommandDialog>
    </CommandPaletteContext.Provider>
  );
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

// Honest pre-launch empty state. The line MUST react to the typed
// query (per task 5.2) so users can tell the dialog is real but
// search is not yet wired up — never a static "no results" string.
function emptyStateLabel(query: string): string {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return "Search is on its way. Type to test the input — results will start appearing in a future release.";
  }
  return `Nothing to search yet for “${trimmed}”. Workspace search launches in a follow-up release.`;
}
