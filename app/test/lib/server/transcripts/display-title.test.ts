import { describe, expect, test } from "vitest";

import type { TranscriptRow } from "@/lib/server/db/schema";
import { DISPLAY_TITLE_FALLBACK, deriveDisplayTitle, deriveDisplayTitleFromRow } from "@/lib/server/transcripts/display-title";

describe("deriveDisplayTitle", () => {
  test("returns the processing title when no custom title is provided", () => {
    expect(deriveDisplayTitle({ title: "Weekly sync" })).toBe("Weekly sync");
  });

  test("prefers the custom title when present (future curation contract)", () => {
    expect(deriveDisplayTitle({ title: "Weekly sync", customTitle: "Renamed by user" })).toBe("Renamed by user");
  });

  test("ignores a blank custom title and falls back to processing title", () => {
    expect(deriveDisplayTitle({ title: "Weekly sync", customTitle: "   " })).toBe("Weekly sync");
    expect(deriveDisplayTitle({ title: "Weekly sync", customTitle: null })).toBe("Weekly sync");
  });

  test("returns the fallback string when both titles are blank", () => {
    expect(deriveDisplayTitle({ title: "" })).toBe(DISPLAY_TITLE_FALLBACK);
    expect(deriveDisplayTitle({ title: "   " })).toBe(DISPLAY_TITLE_FALLBACK);
    expect(deriveDisplayTitle({ title: "", customTitle: "" })).toBe(DISPLAY_TITLE_FALLBACK);
  });

  test("trims whitespace from values it returns", () => {
    expect(deriveDisplayTitle({ title: "  spaced out  " })).toBe("spaced out");
    expect(deriveDisplayTitle({ title: "ignored", customTitle: "  custom  " })).toBe("custom");
  });
});

describe("deriveDisplayTitleFromRow", () => {
  test("delegates to the structural helper using only the title field", () => {
    const row = { title: "From row", transcriptMarkdown: "ignored", recapMarkdown: "ignored" } as unknown as TranscriptRow;
    expect(deriveDisplayTitleFromRow(row)).toBe("From row");
  });
});
