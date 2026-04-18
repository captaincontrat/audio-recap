import { describe, expect, test } from "vitest";

import { assembleExportDocument } from "@/lib/client/transcripts/export/assemble";

// `assembleExportDocument` is the canonical ordering rule of the
// export capability: display title, recap section, transcript
// section. Every format derives from its output, so every behaviour
// below protects a spec requirement directly (section order,
// markdown-first contract, latest-content reading, empty-section
// fallback copy).

describe("assembleExportDocument", () => {
  test("assembles display title, recap, and transcript in the canonical order", () => {
    const assembled = assembleExportDocument({
      displayTitle: "Weekly sync",
      recapMarkdown: "- Point A\n- Point B",
      transcriptMarkdown: "Speaker 1: Hello.\n\nSpeaker 2: Hi.",
    });

    expect(assembled).toBe(
      ["# Weekly sync", "", "## Recap", "", "- Point A\n- Point B", "", "## Transcript", "", "Speaker 1: Hello.\n\nSpeaker 2: Hi.", ""].join("\n"),
    );
  });

  test("trims leading and trailing whitespace from title and sections so the output is stable", () => {
    const assembled = assembleExportDocument({
      displayTitle: "  Weekly sync  ",
      recapMarkdown: "\n\n- Point A\n\n",
      transcriptMarkdown: "\nTranscript body\n",
    });

    expect(assembled.startsWith("# Weekly sync")).toBe(true);
    expect(assembled).not.toMatch(/^#\s{2}Weekly sync/);
    expect(assembled).toContain("- Point A");
    expect(assembled).toContain("Transcript body");
  });

  test("renders a neutral placeholder when the recap is empty after trim", () => {
    const assembled = assembleExportDocument({
      displayTitle: "Standup",
      recapMarkdown: "   ",
      transcriptMarkdown: "Speaker 1: Hi.",
    });

    expect(assembled).toContain("## Recap\n\n_This section is empty._");
    expect(assembled).toContain("## Transcript\n\nSpeaker 1: Hi.");
  });

  test("renders a neutral placeholder when the transcript is empty after trim", () => {
    const assembled = assembleExportDocument({
      displayTitle: "Standup",
      recapMarkdown: "- One point",
      transcriptMarkdown: "",
    });

    expect(assembled).toContain("## Recap\n\n- One point");
    expect(assembled).toContain("## Transcript\n\n_This section is empty._");
  });
});
