import { describe, expect, test } from "vitest";

import { PublicShareResolutionRefusedError, ShareManagementRefusedError } from "@/lib/server/transcripts/sharing/errors";

// The two error classes carry different contracts and are tested
// separately:
//
//   - `ShareManagementRefusedError` is surfaced on the authenticated
//     side, so each refusal reason must default to a human-readable
//     message the UI can render verbatim.
//   - `PublicShareResolutionRefusedError` stays intentionally
//     uniform on the rendered side (all refusals collapse to the
//     same generic presentation) but carries a rich internal
//     `reason` that server logs rely on.

describe("ShareManagementRefusedError", () => {
  test("captures reason and a stable error code", () => {
    const err = new ShareManagementRefusedError("workspace_archived");
    expect(err.reason).toBe("workspace_archived");
    expect(err.code).toBe("share_management_refused");
    expect(err.name).toBe("ShareManagementRefusedError");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ShareManagementRefusedError);
  });

  test("provides a default message per reason", () => {
    expect(new ShareManagementRefusedError("not_found").message).toMatch(/not found/i);
    expect(new ShareManagementRefusedError("access_denied").message).toMatch(/do not have access/i);
    expect(new ShareManagementRefusedError("forbidden").message).toMatch(/does not allow/i);
    expect(new ShareManagementRefusedError("workspace_archived").message).toMatch(/archived/i);
    expect(new ShareManagementRefusedError("transcript_not_completed").message).toMatch(/completed transcripts/i);
    expect(new ShareManagementRefusedError("share_not_enabled").message).toMatch(/not currently enabled/i);
  });

  test("honors caller-supplied message override", () => {
    expect(new ShareManagementRefusedError("forbidden", "custom_copy").message).toBe("custom_copy");
  });

  test("throws exhaustively on an unexpected reason", () => {
    expect(() => new ShareManagementRefusedError("unexpected" as never)).toThrowError(/Unhandled share management refusal reason/);
  });
});

describe("PublicShareResolutionRefusedError", () => {
  test("captures reason and a stable error code", () => {
    const err = new PublicShareResolutionRefusedError("unknown_share_id");
    expect(err.reason).toBe("unknown_share_id");
    expect(err.code).toBe("public_share_unavailable");
    expect(err.name).toBe("PublicShareResolutionRefusedError");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(PublicShareResolutionRefusedError);
  });

  test("defaults messages to an opaque reason-tagged string so logs can pattern-match, but UI never renders them", () => {
    // The exact prefix is stable so operators can grep logs for
    // "public_share_unavailable:<reason>" without having to decode
    // a per-reason english copy table.
    expect(new PublicShareResolutionRefusedError("secret_mismatch").message).toBe("public_share_unavailable:secret_mismatch");
    expect(new PublicShareResolutionRefusedError("share_disabled").message).toBe("public_share_unavailable:share_disabled");
    expect(new PublicShareResolutionRefusedError("transcript_not_completed").message).toBe("public_share_unavailable:transcript_not_completed");
    expect(new PublicShareResolutionRefusedError("workspace_inactive").message).toBe("public_share_unavailable:workspace_inactive");
  });

  test("honors caller-supplied message override", () => {
    expect(new PublicShareResolutionRefusedError("unknown_share_id", "internal_note").message).toBe("internal_note");
  });
});
