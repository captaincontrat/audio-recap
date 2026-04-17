import { describe, expect, it, vi } from "vitest";

import type { TranscriptBlock } from "../src/domain/transcript.js";
import { generateMeetingTitle, sanitizeTitle } from "../src/openai/title.js";

const transcriptBlocks: TranscriptBlock[] = [
  {
    id: "block-0001",
    startSec: 0,
    endSec: 30,
    content: "[00:00:00 - 00:00:30] Alice: Kickoff",
    segmentIds: ["seg-00001"],
  },
  {
    id: "block-0002",
    startSec: 30,
    endSec: 60,
    content: "[00:00:30 - 00:01:00] Bob: Budget review",
    segmentIds: ["seg-00002"],
  },
];

describe("sanitizeTitle", () => {
  it("removes markdown heading syntax and surrounding punctuation", () => {
    expect(sanitizeTitle("### Weekly sync")).toBe("Weekly sync");
    expect(sanitizeTitle('"Q1 kickoff"')).toBe("Q1 kickoff");
    expect(sanitizeTitle("- Budget review")).toBe("Budget review");
  });

  it("keeps only the first non-empty line", () => {
    expect(sanitizeTitle("\n\nSprint review\nLine two ignored")).toBe("Sprint review");
    expect(sanitizeTitle("")).toBe("");
  });

  it("truncates overly long titles with a trailing ellipsis", () => {
    const longTitle = sanitizeTitle("a".repeat(200));
    expect(longTitle).toHaveLength(120);
    expect(longTitle.endsWith("…")).toBe(true);
  });
});

describe("generateMeetingTitle", () => {
  it("rejects requests without any source material", async () => {
    const create = vi.fn();

    await expect(
      generateMeetingTitle(
        {
          responses: { create },
        } as never,
        {
          summary: "   ",
          transcriptBlocks: [],
          meetingNotes: "   ",
        },
      ),
    ).rejects.toThrow(/Cannot generate a meeting title without/);
    expect(create).not.toHaveBeenCalled();
  });

  it("calls the Responses API with the transcript sample and returns the sanitized title", async () => {
    const create = vi.fn().mockResolvedValue({ output_text: "  ### Q1 kickoff meeting  " });

    const title = await generateMeetingTitle(
      {
        responses: { create },
      } as never,
      {
        summary: "# Meeting recap\n- Scoped Q1",
        transcriptBlocks,
        meetingNotes: "Budget review kickoff",
        outputLanguage: "fr",
      },
    );

    expect(title).toBe("Q1 kickoff meeting");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-5.4",
        reasoning: { effort: "minimal" },
        input: [
          {
            role: "developer",
            content: expect.stringContaining("Write the title in fr."),
          },
          {
            role: "user",
            content: expect.stringContaining("Budget review kickoff"),
          },
        ],
      }),
    );
    const userPrompt = (create.mock.calls[0] as Array<{ input: Array<{ role: string; content: string }> }>)[0].input[1].content;
    expect(userPrompt).toContain("Kickoff");
    expect(userPrompt).toContain("Budget review");
  });

  it("falls back to the default language instruction and empty section markers when material is sparse", async () => {
    const create = vi.fn().mockResolvedValue({ output_text: "Team sync" });

    const title = await generateMeetingTitle(
      {
        responses: { create },
      } as never,
      {
        summary: "   ",
        transcriptBlocks: [],
        meetingNotes: "Informal catch-up notes only",
      },
    );

    expect(title).toBe("Team sync");
    const developerPrompt = (create.mock.calls[0] as Array<{ input: Array<{ role: string; content: string }> }>)[0].input[0].content;
    const userPrompt = (create.mock.calls[0] as Array<{ input: Array<{ role: string; content: string }> }>)[0].input[1].content;
    expect(developerPrompt).toContain("dominant language of the provided material");
    expect(userPrompt).toContain("No summary available.");
    expect(userPrompt).toContain("Informal catch-up notes only");
    expect(userPrompt).toContain("No transcript sample available.");
  });

  it("rejects empty responses from the model", async () => {
    const create = vi.fn().mockResolvedValue({ output_text: "   " });

    await expect(
      generateMeetingTitle(
        {
          responses: { create },
        } as never,
        {
          summary: "Team sync recap",
          transcriptBlocks,
        },
      ),
    ).rejects.toThrow(/empty meeting title/);
  });
});
