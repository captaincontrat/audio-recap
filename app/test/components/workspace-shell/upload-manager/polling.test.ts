import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { PollingController } from "@/components/workspace-shell/upload-manager/polling";
import { getUploadManagerStore } from "@/components/workspace-shell/upload-manager/store";

beforeEach(() => {
  vi.useFakeTimers();
  getUploadManagerStore().__resetForTests();
});

afterEach(() => {
  vi.useRealTimers();
  getUploadManagerStore().__resetForTests();
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

describe("PollingController (tasks 5.1, 5.3)", () => {
  test("polls the meeting-status endpoint and pushes server phase into the store", async () => {
    const store = getUploadManagerStore();
    const id = store.addDraft({ workspaceSlug: "riley", file: new File(["x"], "a.mp3", { type: "audio/mpeg" }) });
    store.beginSubmission(id);
    store.attachTranscriptId(id, "tr_a", "queued");

    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        ok: true,
        transcript: { id: "tr_a", status: "transcribing", title: null, failure: null },
      }),
    );
    const controller = new PollingController(store, { intervalMs: 1000, fetcher });
    controller.ensurePolling({ workspaceSlug: "riley", transcriptId: "tr_a" });
    await vi.runOnlyPendingTimersAsync();
    await Promise.resolve();
    await Promise.resolve();

    expect(fetcher).toHaveBeenCalled();
    expect(fetcher.mock.calls[0]?.[0]).toBe("/api/workspaces/riley/meetings/tr_a/status");
    expect(store.findItem(id)?.serverPhase).toBe("transcribing");
    controller.__resetForTests();
  });

  test("stops polling once the worker reports a terminal phase", async () => {
    const store = getUploadManagerStore();
    const id = store.addDraft({ workspaceSlug: "riley", file: new File(["x"], "a.mp3", { type: "audio/mpeg" }) });
    store.beginSubmission(id);
    store.attachTranscriptId(id, "tr_a", "queued");

    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        ok: true,
        transcript: { id: "tr_a", status: "completed", title: "Done", failure: null },
      }),
    );
    const controller = new PollingController(store, { intervalMs: 1000, fetcher });
    controller.ensurePolling({ workspaceSlug: "riley", transcriptId: "tr_a" });
    await vi.runOnlyPendingTimersAsync();
    await Promise.resolve();

    const callsAfterFirst = fetcher.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetcher.mock.calls.length).toBe(callsAfterFirst);
    expect(store.findItem(id)?.serverPhase).toBe("completed");
    expect(store.findItem(id)?.title).toBe("Done");
    controller.__resetForTests();
  });

  test("collapses duplicate ensurePolling calls into one in-flight loop (task 5.3)", async () => {
    const store = getUploadManagerStore();
    const id = store.addDraft({ workspaceSlug: "riley", file: new File(["x"], "a.mp3", { type: "audio/mpeg" }) });
    store.beginSubmission(id);
    store.attachTranscriptId(id, "tr_a", "queued");

    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        ok: true,
        transcript: { id: "tr_a", status: "transcribing", title: null, failure: null },
      }),
    );
    const controller = new PollingController(store, { intervalMs: 10_000, fetcher });
    controller.ensurePolling({ workspaceSlug: "riley", transcriptId: "tr_a" });
    controller.ensurePolling({ workspaceSlug: "riley", transcriptId: "tr_a" });
    controller.ensurePolling({ workspaceSlug: "riley", transcriptId: "tr_a" });
    // Let the immediate tick's microtask resolve without firing the
    // interval. If duplicate calls were not deduped we would see one
    // immediate tick per ensurePolling call.
    await Promise.resolve();
    await Promise.resolve();
    expect(fetcher).toHaveBeenCalledTimes(1);
    controller.__resetForTests();
  });

  test("stops polling on a refusal payload to avoid hammering the API", async () => {
    const store = getUploadManagerStore();
    const id = store.addDraft({ workspaceSlug: "riley", file: new File(["x"], "a.mp3", { type: "audio/mpeg" }) });
    store.beginSubmission(id);
    store.attachTranscriptId(id, "tr_a", "queued");

    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ ok: false, code: "access_denied", message: "nope" }));
    const controller = new PollingController(store, { intervalMs: 1000, fetcher });
    controller.ensurePolling({ workspaceSlug: "riley", transcriptId: "tr_a" });
    await vi.runOnlyPendingTimersAsync();
    await Promise.resolve();

    const callsAfterFirst = fetcher.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetcher.mock.calls.length).toBe(callsAfterFirst);
    controller.__resetForTests();
  });
});
