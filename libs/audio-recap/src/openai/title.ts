import type OpenAI from "openai";

import type { TranscriptBlock } from "../domain/transcript.js";
import { extractSummaryText } from "./summarize.js";

const MAX_TITLE_LENGTH = 120;
const TITLE_MODEL = "gpt-5.4";
const TITLE_MAX_OUTPUT_TOKENS = 200;

export interface GenerateMeetingTitleInput {
  summary: string;
  transcriptBlocks: TranscriptBlock[];
  meetingNotes?: string;
  outputLanguage?: string;
}

export async function generateMeetingTitle(client: OpenAI, input: GenerateMeetingTitleInput): Promise<string> {
  if (!input.summary.trim() && input.transcriptBlocks.length === 0 && !input.meetingNotes?.trim()) {
    throw new Error("Cannot generate a meeting title without a summary, transcript, or meeting notes.");
  }

  const developerPrompt = buildTitleDeveloperPrompt(input.outputLanguage);
  const userPrompt = buildTitleUserPrompt(input);
  const response = await client.responses.create({
    model: TITLE_MODEL,
    reasoning: {
      effort: "minimal",
    },
    max_output_tokens: TITLE_MAX_OUTPUT_TOKENS,
    input: [
      { role: "developer", content: developerPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const rawTitle = extractSummaryText(response);
  const sanitized = sanitizeTitle(rawTitle);

  if (!sanitized) {
    throw new Error("OpenAI returned an empty meeting title.");
  }

  return sanitized;
}

export function sanitizeTitle(raw: string): string {
  const firstLine = raw.split(/\r?\n/).find((line) => line.trim().length > 0) ?? "";
  const stripped = firstLine
    .replace(/^#{1,6}\s+/, "")
    .replace(/^[-*•]\s+/, "")
    .replace(/^["'“”‘’`]+/, "")
    .replace(/["'“”‘’`]+$/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (stripped.length <= MAX_TITLE_LENGTH) {
    return stripped;
  }

  return `${stripped.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…`;
}

function buildTitleDeveloperPrompt(outputLanguage?: string): string {
  const languageInstruction = outputLanguage ? `Write the title in ${outputLanguage}.` : "Write the title in the dominant language of the provided material.";

  return [
    "Formatting re-enabled",
    "# Identity",
    "You are an editor who writes concise, faithful meeting titles from summaries, transcripts, and optional meeting notes.",
    "",
    "# Instructions",
    "- Produce a single title line, under 120 characters.",
    "- Do not invent participants, dates, or decisions that the material does not support.",
    "- Avoid generic phrasing like 'Meeting recap' unless the material really is that ambiguous.",
    "- Do not include quotation marks, trailing punctuation, markdown syntax, or surrounding commentary.",
    `- ${languageInstruction}`,
    "",
    "# Output contract",
    "- Return only the title text, no prefix, no suffix, no explanation.",
  ].join("\n");
}

function buildTitleUserPrompt(input: GenerateMeetingTitleInput): string {
  const trimmedSummary = input.summary.trim();
  const trimmedNotes = input.meetingNotes?.trim() ?? "";
  const transcriptSample = input.transcriptBlocks
    .slice(0, 3)
    .map((block) => block.content)
    .join("\n\n");

  return [
    "<MEETING_SUMMARY>",
    trimmedSummary || "No summary available.",
    "</MEETING_SUMMARY>",
    "",
    "<MEETING_NOTES>",
    trimmedNotes || "No meeting notes were provided.",
    "</MEETING_NOTES>",
    "",
    "<TRANSCRIPT_SAMPLE>",
    transcriptSample || "No transcript sample available.",
    "</TRANSCRIPT_SAMPLE>",
    "",
    "Write the best possible meeting title from this material.",
  ].join("\n");
}
