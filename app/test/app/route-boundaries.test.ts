import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

// Filesystem-level assertions so the route layout the
// `add-workspace-app-shell` design pins (task 1.4 / 7.4) cannot drift
// silently. Workspace-scoped pages MUST live inside the
// `(workspace-shell)` private route group so the shared chrome wraps
// them; non-workspace surfaces (auth, account, public share, the
// landing redirect target) MUST stay outside that group so they
// continue to render without the workspace sidebar/header/breadcrumb.

const APP_ROOT = resolve(__dirname, "../../app");

function shellPath(...segments: string[]): string {
  return resolve(APP_ROOT, "(workspace-shell)", ...segments);
}

function nonShellPath(...segments: string[]): string {
  return resolve(APP_ROOT, ...segments);
}

function assertExists(path: string) {
  expect(existsSync(path), `expected ${path} to exist`).toBe(true);
}

function assertIsFile(path: string) {
  assertExists(path);
  expect(statSync(path).isFile(), `expected ${path} to be a file`).toBe(true);
}

function assertIsDirectory(path: string) {
  assertExists(path);
  expect(statSync(path).isDirectory(), `expected ${path} to be a directory`).toBe(true);
}

function assertDoesNotExist(path: string) {
  expect(existsSync(path), `expected ${path} NOT to exist`).toBe(false);
}

describe("Workspace-scoped routes live inside (workspace-shell) (task 1.4 / 7.4)", () => {
  test("the workspace shell layout is mounted at the route group root", () => {
    assertIsFile(shellPath("w", "[slug]", "layout.tsx"));
  });

  test.each([
    ["w/[slug]/page.tsx"],
    ["w/[slug]/transcripts/page.tsx"],
    ["w/[slug]/transcripts/[transcriptId]/page.tsx"],
    ["w/[slug]/meetings/new/page.tsx"],
    ["w/[slug]/meetings/[transcriptId]/page.tsx"],
  ])("workspace page %s lives under (workspace-shell)", (relative) => {
    assertIsFile(shellPath(...relative.split("/")));
  });

  test("the legacy /app/w/[slug] copy outside the route group has been removed", () => {
    assertDoesNotExist(nonShellPath("w", "[slug]", "page.tsx"));
    assertDoesNotExist(nonShellPath("w", "[slug]", "transcripts", "page.tsx"));
    assertDoesNotExist(nonShellPath("w", "[slug]", "transcripts", "[transcriptId]", "page.tsx"));
    assertDoesNotExist(nonShellPath("w", "[slug]", "meetings", "new", "page.tsx"));
    assertDoesNotExist(nonShellPath("w", "[slug]", "meetings", "[transcriptId]", "page.tsx"));
  });
});

describe("Non-workspace surfaces stay outside (workspace-shell) (task 1.4 / 7.4)", () => {
  test.each([
    "share",
    "sign-in",
    "sign-up",
    "forgot-password",
    "reset-password",
    "verify-email",
    "two-factor",
    "account",
    "dashboard",
  ])("'/app/%s' stays outside the workspace-shell route group", (segment) => {
    assertIsDirectory(nonShellPath(segment));
    assertDoesNotExist(shellPath(segment));
  });

  test("the landing /app/page.tsx is a sibling of (workspace-shell), not a child", () => {
    assertIsFile(nonShellPath("page.tsx"));
    assertDoesNotExist(shellPath("page.tsx"));
  });
});
