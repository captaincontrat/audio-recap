import { describe, expect, it, vi } from "vitest";

import type { TranscriptBlock } from "../src/domain/transcript.js";
import { buildDeveloperPrompt, buildUserPrompt, extractSummaryText, generateMeetingSummary } from "../src/openai/summarize.js";

const transcriptBlocks: TranscriptBlock[] = [
  {
    id: "block-0001",
    startSec: 0,
    endSec: 30,
    content: "[00:00:00 - 00:00:30] Alice: Kickoff",
    segmentIds: ["seg-00001"],
  },
];

describe("meeting summary generation", () => {
  it("builds developer prompts for both explicit and inferred languages", () => {
    expect(buildDeveloperPrompt("fr", true)).toContain("Write the summary in fr.");
    expect(buildDeveloperPrompt(undefined, true)).toContain("dominant language of the meeting notes and transcript.");
    expect(buildDeveloperPrompt(undefined, false)).toContain("No meeting notes were provided.");
    expect(buildDeveloperPrompt(undefined, false)).toContain("dominant language of the transcript");
  });

  it("builds the user prompt with transcript blocks and meeting context", () => {
    const prompt = buildUserPrompt({
      audioPath: "/audio/meeting.m4a",
      notesPath: "/notes/meeting.md",
      meetingNotes: "Action items here",
      transcriptBlocks,
    });

    expect(prompt).toContain("Audio file: /audio/meeting.m4a");
    expect(prompt).toContain("Notes file: /notes/meeting.md");
    expect(prompt).toContain('<BLOCK id="block-0001" start="00:00:00" end="00:00:30">');
    expect(prompt).toContain("Action items here");
  });

  it("extracts summary text from direct output and nested content", () => {
    expect(extractSummaryText({ output_text: "  # Direct summary  " })).toBe("# Direct summary");
    expect(
      extractSummaryText({
        output: [
          { type: "message" },
          {
            type: "message",
            content: [{ type: "output_text", text: "Line one" }, { type: "output_text", text: "Line two" }, { type: "ignored" }],
          },
        ],
      }),
    ).toBe("Line one\nLine two");
    expect(extractSummaryText({ output: [{ type: "message", content: [{ type: "output_text" }] }] })).toBe("");
    expect(extractSummaryText({})).toBe("");
  });

  it("rejects summary generation without transcript blocks", async () => {
    const client = {
      responses: {
        create: vi.fn(),
      },
    };

    await expect(
      generateMeetingSummary(client as never, {
        audioPath: "/audio/meeting.m4a",
        meetingNotes: "",
        transcriptBlocks: [],
      }),
    ).rejects.toThrow("Cannot generate a summary without transcript blocks.");
  });

  it("calls OpenAI with structured prompts and returns fallback content text", async () => {
    const create = vi.fn().mockResolvedValue({
      output_text: "",
      output: [
        {
          type: "message",
          content: [
            { type: "output_text", text: "# Recap" },
            { type: "output_text", text: "- Action 1" },
          ],
        },
      ],
    });

    const summary = await generateMeetingSummary(
      {
        responses: {
          create,
        },
      } as never,
      {
        audioPath: "/audio/meeting.m4a",
        notesPath: "/notes/meeting.md",
        meetingNotes: "Team sync notes",
        transcriptBlocks,
        outputLanguage: "fr",
      },
    );

    expect(summary).toBe("# Recap\n- Action 1");
    expect(create).toHaveBeenCalledWith({
      model: "gpt-5.4",
      reasoning: {
        effort: "high",
      },
      max_output_tokens: 12000,
      input: [
        {
          role: "developer",
          content: expect.stringContaining("Write the summary in fr."),
        },
        {
          role: "user",
          content: expect.stringContaining("Team sync notes"),
        },
      ],
    });
  });

  it("surfaces OpenAI empty-summary errors with response details", async () => {
    const create = vi.fn().mockResolvedValue({
      status: "incomplete",
      incomplete_details: {
        reason: "max_output_tokens",
      },
      output: [],
    });

    await expect(
      generateMeetingSummary(
        {
          responses: {
            create,
          },
        } as never,
        {
          audioPath: "/audio/meeting.m4a",
          meetingNotes: "",
          transcriptBlocks,
        },
      ),
    ).rejects.toThrow('OpenAI returned an empty meeting summary (status: incomplete, incomplete_details: {"reason":"max_output_tokens"}).');
  });

  it("falls back to unknown status and missing incomplete details", async () => {
    const create = vi.fn().mockResolvedValue({
      output: [],
    });

    await expect(
      generateMeetingSummary(
        {
          responses: {
            create,
          },
        } as never,
        {
          audioPath: "/audio/meeting.m4a",
          meetingNotes: "",
          transcriptBlocks,
        },
      ),
    ).rejects.toThrow("OpenAI returned an empty meeting summary (status: unknown, incomplete_details: none).");
  });

  it("falls back to unknown when the response status is explicitly null", async () => {
    const create = vi.fn().mockResolvedValue({
      status: null,
      output: [],
    });

    await expect(
      generateMeetingSummary(
        {
          responses: {
            create,
          },
        } as never,
        {
          audioPath: "/audio/meeting.m4a",
          meetingNotes: "",
          transcriptBlocks,
        },
      ),
    ).rejects.toThrow("OpenAI returned an empty meeting summary (status: unknown, incomplete_details: none).");
  });
});
