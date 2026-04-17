import { describe, expect, test } from "vitest";

import { isProgressStatus, isTerminalStatus, PROGRESS_STATUSES, statusForPipelineStage, TERMINAL_STATUSES } from "@/lib/server/meetings";

describe("PROGRESS_STATUSES", () => {
  test("lists the linear stages the worker advances through before terminal", () => {
    expect(PROGRESS_STATUSES).toEqual(["queued", "preprocessing", "transcribing", "generating_recap", "generating_title", "finalizing"]);
  });
});

describe("TERMINAL_STATUSES", () => {
  test("contains the two terminal states", () => {
    expect(TERMINAL_STATUSES).toEqual(["completed", "failed"]);
  });
});

describe("isProgressStatus / isTerminalStatus", () => {
  test("progress and terminal status sets are disjoint", () => {
    for (const status of PROGRESS_STATUSES) {
      expect(isProgressStatus(status)).toBe(true);
      expect(isTerminalStatus(status)).toBe(false);
    }
    for (const status of TERMINAL_STATUSES) {
      expect(isProgressStatus(status)).toBe(false);
      expect(isTerminalStatus(status)).toBe(true);
    }
  });

  test("retrying is neither a linear progress stage nor terminal", () => {
    expect(isProgressStatus("retrying")).toBe(false);
    expect(isTerminalStatus("retrying")).toBe(false);
  });
});

describe("statusForPipelineStage", () => {
  test("maps shared library stages to user-visible statuses", () => {
    expect(statusForPipelineStage("prepare-audio")).toBe("preprocessing");
    expect(statusForPipelineStage("transcribe")).toBe("transcribing");
    expect(statusForPipelineStage("build-transcript")).toBe("transcribing");
    expect(statusForPipelineStage("generate-summary")).toBe("generating_recap");
  });

  test("throws if a new pipeline stage is introduced without updating the mapping", () => {
    expect(() => statusForPipelineStage("unexpected" as Parameters<typeof statusForPipelineStage>[0])).toThrowError(/Unhandled pipeline stage/);
  });
});
