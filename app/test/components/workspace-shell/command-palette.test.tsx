import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { CommandPaletteProvider, useCommandPalette } from "@/components/workspace-shell/command-palette";
import { EditSessionPresenceProvider, usePublishEditSessionPresence } from "@/components/workspace-shell/edit-session-presence-context";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

afterEach(() => {
  vi.useRealTimers();
});

function PaletteHarness({ children }: { children?: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={0}>
      <EditSessionPresenceProvider>
        <CommandPaletteProvider>{children}</CommandPaletteProvider>
      </EditSessionPresenceProvider>
    </TooltipProvider>
  );
}

function OpenStateProbe() {
  const { open } = useCommandPalette();
  return <span data-testid="palette-open">{open ? "open" : "closed"}</span>;
}

function ManualOpener() {
  const { setOpen, toggle } = useCommandPalette();
  return (
    <>
      <button type="button" data-testid="open" onClick={() => setOpen(true)}>
        open
      </button>
      <button type="button" data-testid="toggle" onClick={() => toggle()}>
        toggle
      </button>
    </>
  );
}

function EditSessionToggle() {
  const [active, setActive] = useState(false);
  usePublishEditSessionPresence(active);
  return (
    <button type="button" data-testid="toggle-edit" onClick={() => setActive((value) => !value)}>
      {active ? "stop editing" : "start editing"}
    </button>
  );
}

function dispatchShortcut({
  key = "k",
  meta = false,
  ctrl = false,
  alt = false,
  shift = false,
  target,
}: {
  key?: string;
  meta?: boolean;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  target?: HTMLElement;
} = {}) {
  const event = new KeyboardEvent("keydown", {
    key,
    metaKey: meta,
    ctrlKey: ctrl,
    altKey: alt,
    shiftKey: shift,
    bubbles: true,
    cancelable: true,
  });
  if (target) {
    Object.defineProperty(event, "target", { value: target, configurable: true });
    target.dispatchEvent(event);
  } else {
    window.dispatchEvent(event);
  }
  return event;
}

describe("CommandPaletteProvider open paths (tasks 5.1–5.2 / 7.3)", () => {
  test("starts closed and opens on the global ⌘K shortcut", () => {
    render(
      <PaletteHarness>
        <OpenStateProbe />
      </PaletteHarness>,
    );

    expect(screen.getByTestId("palette-open").textContent).toBe("closed");
    expect(screen.queryByRole("dialog")).toBeNull();

    act(() => {
      dispatchShortcut({ meta: true });
    });

    expect(screen.getByTestId("palette-open").textContent).toBe("open");
    expect(screen.getByRole("dialog")).not.toBeNull();
  });

  test("opens on Ctrl+K for non-mac platforms", () => {
    render(
      <PaletteHarness>
        <OpenStateProbe />
      </PaletteHarness>,
    );

    act(() => {
      dispatchShortcut({ ctrl: true });
    });

    expect(screen.getByTestId("palette-open").textContent).toBe("open");
  });

  test("toggles closed on a second shortcut press", () => {
    render(
      <PaletteHarness>
        <OpenStateProbe />
      </PaletteHarness>,
    );

    act(() => {
      dispatchShortcut({ meta: true });
    });
    expect(screen.getByTestId("palette-open").textContent).toBe("open");

    act(() => {
      dispatchShortcut({ meta: true });
    });
    expect(screen.getByTestId("palette-open").textContent).toBe("closed");
  });

  test.each([
    { name: "no modifier", attrs: {} },
    { name: "shift+meta", attrs: { meta: true, shift: true } },
    { name: "alt+meta", attrs: { meta: true, alt: true } },
    { name: "wrong key", attrs: { meta: true, key: "j" } },
  ] as const)("ignores irrelevant key combinations — $name", ({ attrs }) => {
    render(
      <PaletteHarness>
        <OpenStateProbe />
      </PaletteHarness>,
    );

    act(() => {
      dispatchShortcut(attrs);
    });

    expect(screen.getByTestId("palette-open").textContent).toBe("closed");
  });

  test("ignores already-prevented and repeated shortcut events", () => {
    render(
      <PaletteHarness>
        <OpenStateProbe />
      </PaletteHarness>,
    );

    const prevented = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    prevented.preventDefault();
    act(() => {
      window.dispatchEvent(prevented);
    });
    expect(screen.getByTestId("palette-open").textContent).toBe("closed");

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "k",
          metaKey: true,
          repeat: true,
          bubbles: true,
        }),
      );
    });
    expect(screen.getByTestId("palette-open").textContent).toBe("closed");
  });

  test("opens via the imperative setOpen accessor", () => {
    render(
      <PaletteHarness>
        <OpenStateProbe />
        <ManualOpener />
      </PaletteHarness>,
    );

    fireEvent.click(screen.getByTestId("open"));
    expect(screen.getByTestId("palette-open").textContent).toBe("open");
  });

  test("toggles via the imperative toggle accessor", () => {
    render(
      <PaletteHarness>
        <OpenStateProbe />
        <ManualOpener />
      </PaletteHarness>,
    );

    fireEvent.click(screen.getByTestId("toggle"));
    expect(screen.getByTestId("palette-open").textContent).toBe("open");
    fireEvent.click(screen.getByTestId("toggle"));
    expect(screen.getByTestId("palette-open").textContent).toBe("closed");
  });

  test("useCommandPalette throws when consumed outside the provider", () => {
    function Probe() {
      useCommandPalette();
      return null;
    }
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/CommandPaletteProvider/);
    error.mockRestore();
  });
});

describe("CommandPalette empty state (task 5.2 / 7.3)", () => {
  test("renders the honest pre-launch line when the input is empty", () => {
    render(
      <PaletteHarness>
        <ManualOpener />
      </PaletteHarness>,
    );
    fireEvent.click(screen.getByTestId("open"));

    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toMatch(/Search is on its way/);
  });

  test("the empty state echoes the typed query so users can tell the input is real", () => {
    render(
      <PaletteHarness>
        <ManualOpener />
      </PaletteHarness>,
    );
    fireEvent.click(screen.getByTestId("open"));

    const input = screen.getByPlaceholderText("Search this workspace…");
    fireEvent.change(input, { target: { value: "Q4 review" } });

    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toMatch(/Q4 review/);
    expect(dialog.textContent).toMatch(/Workspace search launches in a follow-up release/);
  });

  test("the query resets between opens so a stale string never greets the next user", () => {
    render(
      <PaletteHarness>
        <ManualOpener />
      </PaletteHarness>,
    );

    fireEvent.click(screen.getByTestId("open"));
    const firstInput = screen.getByPlaceholderText("Search this workspace…") as HTMLInputElement;
    fireEvent.change(firstInput, { target: { value: "stale" } });
    expect(firstInput.value).toBe("stale");

    fireEvent.click(screen.getByTestId("toggle"));

    fireEvent.click(screen.getByTestId("open"));
    const reopened = screen.getByPlaceholderText("Search this workspace…") as HTMLInputElement;
    expect(reopened.value).toBe("");
  });
});

describe("CommandPalette edit-session shortcut suppression (task 5.3 / 7.3)", () => {
  test("does not open when an edit session is active and the shortcut fires from a typing target", () => {
    render(
      <PaletteHarness>
        <OpenStateProbe />
        <EditSessionToggle />
        <textarea data-testid="recap" />
      </PaletteHarness>,
    );

    fireEvent.click(screen.getByTestId("toggle-edit"));

    const recap = screen.getByTestId("recap");
    act(() => {
      dispatchShortcut({ meta: true, target: recap });
    });

    expect(screen.getByTestId("palette-open").textContent).toBe("closed");
  });

  test("still opens when an edit session is active but the shortcut fires from a non-typing target", () => {
    render(
      <PaletteHarness>
        <OpenStateProbe />
        <EditSessionToggle />
      </PaletteHarness>,
    );

    fireEvent.click(screen.getByTestId("toggle-edit"));

    act(() => {
      dispatchShortcut({ meta: true });
    });

    expect(screen.getByTestId("palette-open").textContent).toBe("open");
  });

  test("opens normally from a typing target when no edit session is active", () => {
    render(
      <PaletteHarness>
        <OpenStateProbe />
        <textarea data-testid="recap" />
      </PaletteHarness>,
    );

    const recap = screen.getByTestId("recap");
    act(() => {
      dispatchShortcut({ meta: true, target: recap });
    });

    expect(screen.getByTestId("palette-open").textContent).toBe("open");
  });

  test.each(["INPUT", "TEXTAREA", "SELECT"] as const)("treats <%s> as a typing target during an edit session", (tag) => {
    render(
      <PaletteHarness>
        <OpenStateProbe />
        <EditSessionToggle />
      </PaletteHarness>,
    );

    fireEvent.click(screen.getByTestId("toggle-edit"));

    const node = document.createElement(tag.toLowerCase()) as HTMLElement;
    document.body.appendChild(node);
    try {
      act(() => {
        dispatchShortcut({ meta: true, target: node });
      });
      expect(screen.getByTestId("palette-open").textContent).toBe("closed");
    } finally {
      node.remove();
    }
  });

  test("treats contenteditable hosts as a typing target during an edit session", () => {
    render(
      <PaletteHarness>
        <OpenStateProbe />
        <EditSessionToggle />
      </PaletteHarness>,
    );

    fireEvent.click(screen.getByTestId("toggle-edit"));

    const node = document.createElement("div");
    Object.defineProperty(node, "isContentEditable", { configurable: true, value: true });
    document.body.appendChild(node);
    try {
      act(() => {
        dispatchShortcut({ meta: true, target: node });
      });
      expect(screen.getByTestId("palette-open").textContent).toBe("closed");
    } finally {
      node.remove();
    }
  });

  test("ignores publishers mounted outside an EditSessionPresenceProvider", () => {
    function StandalonePublisher() {
      usePublishEditSessionPresence(true);
      return null;
    }
    expect(() => render(<StandalonePublisher />)).not.toThrow();
  });
});
