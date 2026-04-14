import { describe, expect, it } from "vitest";

import type { PreparedAudioFile } from "../src/audio/ffmpeg.js";
import { renderSummaryMarkdown, renderTranscriptMarkdown } from "../src/render/markdown.js";

const preparedAudio: PreparedAudioFile = {
  sourcePath: "/tmp/meeting.m4a",
  preparedPath: "/tmp/prepared-x2.mp3",
  durationSec: 120,
  sizeBytes: 4096,
  formatName: "mp3",
  speedMultiplier: 2,
  overlapSec: 1,
  chunks: [
    {
      index: 0,
      path: "/tmp/prepared-x2.mp3",
      startSec: 0,
      durationSec: 120,
      sizeBytes: 4096,
      overlapBeforeSec: 0,
      overlapAfterSec: 0,
    },
  ],
};

describe("markdown rendering", () => {
  it("renders transcript metadata and segments", () => {
    const markdown = renderTranscriptMarkdown({
      audioPath: "/audio/meeting.m4a",
      notesPath: "/notes/meeting.md",
      generatedAt: "2026-04-14T10:00:00.000Z",
      preparedAudio,
      segments: [
        {
          id: "seg-00001",
          speaker: "Alice",
          startSec: 0,
          endSec: 12,
          text: "Bonjour tout le monde.",
          chunkIndex: 0,
        },
      ],
    });

    expect(markdown).toContain("# Transcript du meeting");
    expect(markdown).toContain("- Notes source: `/notes/meeting.md`");
    expect(markdown).toContain("### 00:00:00 - 00:00:12 · Alice");
    expect(markdown).toContain("Bonjour tout le monde.");
    expect(markdown.endsWith("\n")).toBe(true);
  });

  it("renders a fallback message when no transcript segment exists", () => {
    const markdown = renderTranscriptMarkdown({
      audioPath: "/audio/meeting.m4a",
      generatedAt: "2026-04-14T10:00:00.000Z",
      preparedAudio,
      segments: [],
    });

    expect(markdown).toContain("- Notes source: none");
    expect(markdown).toContain("Aucun segment n'a été retourné par la transcription.");
  });

  it("renders summary markdown with trimmed content and metadata comments", () => {
    const markdown = renderSummaryMarkdown({
      audioPath: "/audio/meeting.m4a",
      generatedAt: "2026-04-14T10:00:00.000Z",
      summary: "\n# Recap\n\n- Action 1\n",
    });

    expect(markdown).toBe(
      [
        "<!-- Audio source: /audio/meeting.m4a -->",
        "<!-- Notes source: none -->",
        "<!-- Generated at 2026-04-14T10:00:00.000Z with gpt-5.4 reasoning high -->",
        "",
        "# Recap",
        "",
        "- Action 1",
        "",
      ].join("\n"),
    );
  });
});
