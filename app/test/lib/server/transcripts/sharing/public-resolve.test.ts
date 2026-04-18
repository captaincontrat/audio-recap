import { describe, expect, test } from "vitest";

import type { PublicShareLookupView } from "@/lib/server/transcripts/sharing/queries";
import { PublicShareResolutionRefusedError } from "@/lib/server/transcripts/sharing/errors";
import { validatePublicShareLookup } from "@/lib/server/transcripts/sharing/public-resolve";

// These tests exercise every refusal branch of the public-share
// resolver without touching the database. The top-level
// `resolvePublicShare` function is a thin DB wrapper around
// `validatePublicShareLookup`; the wrapper itself is covered by
// the Playwright e2e harness alongside the public page.
//
// Every `expected` reason mirrors exactly what the server will log
// for that refusal. The rendered public surface collapses all of
// these to the same generic "unavailable" copy — the route handler
// owns that collapse, so this test file does not assert on it.

const PUBLIC_SHARE_ID = "11111111-1111-4111-8111-111111111111";
const VALID_SECRET = "22222222-2222-4222-8222-222222222222";
const WRONG_SECRET = "99999999-9999-4999-8999-999999999999";

const NOW = new Date("2026-05-01T12:00:00.000Z");

function makeLookup(overrides: Partial<PublicShareLookupView> = {}): PublicShareLookupView {
  return {
    id: "transcript_1",
    workspaceId: "workspace_1",
    status: "completed",
    title: "Quarterly review",
    customTitle: null,
    recapMarkdown: "## Recap\n\n- Numbers look good.",
    transcriptMarkdown: "# Transcript\n\nWelcome everyone.",
    isPubliclyShared: true,
    publicShareId: PUBLIC_SHARE_ID,
    shareSecretId: VALID_SECRET,
    shareUpdatedAt: new Date("2026-04-15T08:00:00.000Z"),
    workspaceArchivedAt: null,
    workspaceScheduledDeleteAt: null,
    workspaceRestoredAt: null,
    ...overrides,
  };
}

function expectRefused(fn: () => unknown, reason: string): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(PublicShareResolutionRefusedError);
    expect((error as PublicShareResolutionRefusedError).reason).toBe(reason);
    return;
  }
  throw new Error(`expected validatePublicShareLookup to throw with reason "${reason}"`);
}

describe("validatePublicShareLookup", () => {
  test("returns only the privacy-minimal public view when every guard passes", () => {
    const view = validatePublicShareLookup({ record: makeLookup(), shareSecretId: VALID_SECRET, now: NOW });
    // The view exposes exactly three fields: display title, recap
    // markdown, transcript markdown. Anything else (workspace id,
    // transcript id, tags, share state, timestamps) would leak
    // workspace-private information to the unauthenticated surface.
    expect(view).toEqual({
      displayTitle: "Quarterly review",
      recapMarkdown: "## Recap\n\n- Numbers look good.",
      transcriptMarkdown: "# Transcript\n\nWelcome everyone.",
    });
    expect(Object.keys(view).sort()).toEqual(["displayTitle", "recapMarkdown", "transcriptMarkdown"]);
  });

  test("prefers customTitle over the processing-owned title for displayTitle", () => {
    const view = validatePublicShareLookup({
      record: makeLookup({ customTitle: "Quarterly review — amended" }),
      shareSecretId: VALID_SECRET,
      now: NOW,
    });
    expect(view.displayTitle).toBe("Quarterly review — amended");
  });

  test("refuses unknown_share_id when the lookup finds no record", () => {
    // The resolver collapses "invalid UUID shape", "UUID doesn't
    // exist", and "transcript was deleted" to the same `unknown_share_id`
    // branch. The pure validator owns the post-lookup half of that
    // collapse.
    expectRefused(() => validatePublicShareLookup({ record: null, shareSecretId: VALID_SECRET, now: NOW }), "unknown_share_id");
  });

  test("refuses share_disabled when the record exists but sharing is currently off", () => {
    expectRefused(
      () => validatePublicShareLookup({ record: makeLookup({ isPubliclyShared: false }), shareSecretId: VALID_SECRET, now: NOW }),
      "share_disabled",
    );
  });

  test("refuses secret_mismatch when the URL's secret segment does not match the active rotation", () => {
    expectRefused(() => validatePublicShareLookup({ record: makeLookup(), shareSecretId: WRONG_SECRET, now: NOW }), "secret_mismatch");
  });

  test("refuses secret_mismatch when the stored secret is null even though the share is flagged enabled", () => {
    // This is a defensive path: if a row ever reached a state with
    // `isPubliclyShared === true` but `shareSecretId === null`,
    // the resolver must not accept _any_ candidate secret. Without
    // this check, a rotated-but-not-yet-saved row could briefly
    // expose the transcript to anyone guessing a UUID-shaped
    // secret.
    expectRefused(() => validatePublicShareLookup({ record: makeLookup({ shareSecretId: null }), shareSecretId: VALID_SECRET, now: NOW }), "secret_mismatch");
  });

  test("refuses transcript_not_completed when the record is mid-processing or failed", () => {
    for (const status of ["queued", "transcribing", "failed"] as const) {
      expectRefused(() => validatePublicShareLookup({ record: makeLookup({ status }), shareSecretId: VALID_SECRET, now: NOW }), "transcript_not_completed");
    }
  });

  describe("archival lifecycle integration", () => {
    test("refuses workspace_inactive when the workspace is currently archived", () => {
      expectRefused(
        () =>
          validatePublicShareLookup({
            record: makeLookup({
              workspaceArchivedAt: new Date("2026-04-20T08:00:00.000Z"),
              workspaceScheduledDeleteAt: new Date("2026-06-19T08:00:00.000Z"),
            }),
            shareSecretId: VALID_SECRET,
            now: NOW,
          }),
        "workspace_inactive",
      );
    });

    test("refuses workspace_inactive when the workspace was restored after the share was last updated (post-restore suppression)", () => {
      // The archival lifecycle spec requires previously-enabled
      // shares to stay inactive after restore until a member/admin
      // runs a fresh share-management action. The pure validator
      // enforces that rule via `isShareSuppressedByRestore`.
      expectRefused(
        () =>
          validatePublicShareLookup({
            record: makeLookup({
              shareUpdatedAt: new Date("2026-04-01T08:00:00.000Z"),
              workspaceArchivedAt: null,
              workspaceScheduledDeleteAt: null,
              workspaceRestoredAt: new Date("2026-04-20T08:00:00.000Z"),
            }),
            shareSecretId: VALID_SECRET,
            now: NOW,
          }),
        "workspace_inactive",
      );
    });

    test("allows resolution when the share has been re-touched after a restore", () => {
      // Share updated AFTER restore → suppression clears; the
      // resolver falls through to the rest of the validation
      // pipeline and returns the privacy-minimal view.
      const view = validatePublicShareLookup({
        record: makeLookup({
          shareUpdatedAt: new Date("2026-04-25T08:00:00.000Z"),
          workspaceArchivedAt: null,
          workspaceScheduledDeleteAt: null,
          workspaceRestoredAt: new Date("2026-04-20T08:00:00.000Z"),
        }),
        shareSecretId: VALID_SECRET,
        now: NOW,
      });
      expect(view.displayTitle).toBe("Quarterly review");
    });

    test("allows resolution when the workspace has never been archived even if restoredAt is unset", () => {
      // The default never-archived case: both `workspaceArchivedAt`
      // and `workspaceRestoredAt` are null, share is enabled,
      // transcript is completed. This guards against a regression
      // where a naive post-restore check might throw whenever
      // `workspaceRestoredAt === null`.
      const view = validatePublicShareLookup({ record: makeLookup(), shareSecretId: VALID_SECRET, now: NOW });
      expect(view.displayTitle).toBe("Quarterly review");
    });

    test("skips post-restore suppression when the share has never been touched", () => {
      // If a share was never enabled, `shareUpdatedAt` is null.
      // The validator must not treat that as "suppressed by
      // restore"; the subsequent `isPubliclyShared` guard will
      // refuse for the correct reason (`share_disabled`) instead.
      expectRefused(
        () =>
          validatePublicShareLookup({
            record: makeLookup({
              isPubliclyShared: false,
              shareSecretId: null,
              shareUpdatedAt: null,
              workspaceArchivedAt: null,
              workspaceRestoredAt: new Date("2026-04-20T08:00:00.000Z"),
            }),
            shareSecretId: VALID_SECRET,
            now: NOW,
          }),
        "share_disabled",
      );
    });
  });
});
