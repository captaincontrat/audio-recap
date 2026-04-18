import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom does not implement these browser APIs, but the workspace
// shell's responsive sidebar (matchMedia) and the `cmdk` library used
// by the command palette (ResizeObserver) call them at mount. Stub
// them once so every test inherits a stable polyfill rather than each
// suite reinventing the same shim.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverShim {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  Object.defineProperty(globalThis, "ResizeObserver", {
    writable: true,
    configurable: true,
    value: ResizeObserverShim,
  });
}

afterEach(() => {
  cleanup();
});
