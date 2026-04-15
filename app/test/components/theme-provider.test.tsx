import { fireEvent, render, screen } from "@testing-library/react";
import type * as React from "react";
import { beforeEach, expect, test, vi } from "vitest";

const { mockNextThemesProvider, mockUseTheme } = vi.hoisted(() => ({
  mockNextThemesProvider: vi.fn(),
  mockUseTheme: vi.fn(),
}));

vi.mock("next-themes", async () => {
  const React = await import("react");

  return {
    ThemeProvider: ({
      attribute,
      children,
      defaultTheme,
      disableTransitionOnChange,
      enableSystem,
      forcedTheme,
    }: {
      attribute?: string;
      children: React.ReactNode;
      defaultTheme?: string;
      disableTransitionOnChange?: boolean;
      enableSystem?: boolean;
      forcedTheme?: string;
    }) => {
      mockNextThemesProvider({
        attribute,
        children,
        defaultTheme,
        disableTransitionOnChange,
        enableSystem,
        forcedTheme,
      });

      return React.createElement(
        "div",
        {
          "data-testid": "next-themes-provider",
          "data-attribute": attribute,
          "data-default-theme": defaultTheme,
          "data-disable-transition-on-change": String(disableTransitionOnChange),
          "data-enable-system": String(enableSystem),
          "data-forced-theme": forcedTheme ?? "",
        },
        children,
      );
    },
    useTheme: mockUseTheme,
  };
});

import { ThemeProvider } from "@/components/theme-provider";

function createPreventedShortcut() {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    key: "d",
  });

  event.preventDefault();

  return event;
}

beforeEach(() => {
  mockNextThemesProvider.mockClear();
  mockUseTheme.mockReset();
});

test("ThemeProvider forwards its props and renders children", () => {
  mockUseTheme.mockReturnValue({
    resolvedTheme: "light",
    setTheme: vi.fn(),
  });

  render(
    <ThemeProvider forcedTheme="dark">
      <span>Child content</span>
    </ThemeProvider>,
  );

  const provider = screen.getByTestId("next-themes-provider");

  expect(provider.getAttribute("data-attribute")).toBe("class");
  expect(provider.getAttribute("data-default-theme")).toBe("system");
  expect(provider.getAttribute("data-disable-transition-on-change")).toBe("true");
  expect(provider.getAttribute("data-enable-system")).toBe("true");
  expect(provider.getAttribute("data-forced-theme")).toBe("dark");
  expect(screen.getByText("Child content")).toBeDefined();
});

test("ThemeProvider toggles to dark mode when d is pressed", () => {
  const setTheme = vi.fn();
  mockUseTheme.mockReturnValue({
    resolvedTheme: "light",
    setTheme,
  });

  render(<ThemeProvider>Child content</ThemeProvider>);

  window.dispatchEvent(new KeyboardEvent("keydown", { key: "d" }));

  expect(setTheme).toHaveBeenCalledWith("dark");
});

test("ThemeProvider toggles to light mode when d is pressed in dark mode", () => {
  const setTheme = vi.fn();
  mockUseTheme.mockReturnValue({
    resolvedTheme: "dark",
    setTheme,
  });

  render(<ThemeProvider>Child content</ThemeProvider>);

  window.dispatchEvent(new KeyboardEvent("keydown", { key: "d" }));

  expect(setTheme).toHaveBeenCalledWith("light");
});

test("ThemeProvider ignores prevented, repeated, modified, and unrelated keys", () => {
  const setTheme = vi.fn();
  mockUseTheme.mockReturnValue({
    resolvedTheme: "light",
    setTheme,
  });

  render(<ThemeProvider>Child content</ThemeProvider>);

  window.dispatchEvent(createPreventedShortcut());
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "d", repeat: true }));
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "d", metaKey: true }));
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "d", ctrlKey: true }));
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "d", altKey: true }));
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "x" }));

  expect(setTheme).not.toHaveBeenCalled();
});

test("ThemeProvider ignores hotkeys while typing in editable controls", () => {
  const setTheme = vi.fn();
  mockUseTheme.mockReturnValue({
    resolvedTheme: "light",
    setTheme,
  });

  render(
    <ThemeProvider>
      <div>
        <input aria-label="name" />
        <textarea aria-label="notes" />
        <select aria-label="speaker">
          <option>Alex</option>
        </select>
        <div data-testid="editable" />
      </div>
    </ThemeProvider>,
  );

  const editable = screen.getByTestId("editable");
  Object.defineProperty(editable, "isContentEditable", {
    configurable: true,
    value: true,
  });

  fireEvent.keyDown(screen.getByLabelText("name"), { key: "d" });
  fireEvent.keyDown(screen.getByLabelText("notes"), { key: "d" });
  fireEvent.keyDown(screen.getByLabelText("speaker"), { key: "d" });
  fireEvent.keyDown(editable, { key: "d" });

  expect(setTheme).not.toHaveBeenCalled();
});

test("ThemeProvider removes its hotkey listener on unmount", () => {
  const setTheme = vi.fn();
  mockUseTheme.mockReturnValue({
    resolvedTheme: "light",
    setTheme,
  });

  const { unmount } = render(<ThemeProvider>Child content</ThemeProvider>);

  unmount();
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "d" }));

  expect(setTheme).not.toHaveBeenCalled();
});
