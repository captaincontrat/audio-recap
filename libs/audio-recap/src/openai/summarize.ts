import type OpenAI from "openai";

import { formatTimestamp, type TranscriptBlock } from "../domain/transcript.js";
import { resolveSummaryFormatCatalog, serializeSummaryFormatCatalog, type SummaryFormatDefinition } from "./summary-formats.js";

const SUMMARY_MODEL = "gpt-5.4";
const SUMMARY_MAX_OUTPUT_TOKENS = 12000;

export interface GenerateMeetingSummaryInput {
  audioPath: string;
  notesPath?: string;
  meetingNotes: string;
  transcriptBlocks: TranscriptBlock[];
  outputLanguage?: string;
  summaryFormats?: string;
}

export async function generateMeetingSummary(client: OpenAI, input: GenerateMeetingSummaryInput): Promise<string> {
  if (input.transcriptBlocks.length === 0) {
    throw new Error("Cannot generate a summary without transcript blocks.");
  }

  const summaryFormatCatalog = resolveSummaryFormatCatalog(input.summaryFormats);
  const developerPrompt = buildDeveloperPrompt(input.outputLanguage, input.meetingNotes.trim().length > 0);
  const userPrompt = buildUserPrompt({
    ...input,
    summaryFormatCatalog,
  });
  const response = await client.responses.create({
    model: SUMMARY_MODEL,
    reasoning: {
      effort: "high",
    },
    max_output_tokens: SUMMARY_MAX_OUTPUT_TOKENS,
    input: [
      {
        role: "developer",
        content: developerPrompt,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],
  });

  const summary = extractSummaryText(response);

  if (!summary) {
    const status = "status" in response ? String(response.status ?? "unknown") : "unknown";
    const incompleteDetails = "incomplete_details" in response && response.incomplete_details ? JSON.stringify(response.incomplete_details) : "none";
    throw new Error(`OpenAI returned an empty meeting summary (status: ${status}, incomplete_details: ${incompleteDetails}).`);
  }

  return summary;
}

export function buildDeveloperPrompt(outputLanguage?: string, hasMeetingNotes = true): string {
  const languageInstruction = outputLanguage
    ? `Write the summary in ${outputLanguage}.`
    : hasMeetingNotes
      ? "Write the summary in the dominant language of the meeting notes and transcript."
      : "Write the summary in the dominant language of the transcript.";

  return [
    "Formatting re-enabled",
    "# Identity",
    "You are an expert meeting analyst who writes faithful, useful summaries from meeting notes when available and diarized transcripts.",
    "",
    "# Instructions",
    hasMeetingNotes
      ? "- Analyze the meeting notes first to infer the most likely meeting type and the most useful summary structure for this specific meeting."
      : "- No meeting notes were provided. Infer the most likely meeting type and structure directly from the transcript blocks.",
    hasMeetingNotes
      ? "- Cross-check the inferred meeting type and structure against the transcript blocks before writing the summary."
      : "- Base the meeting type, structure, tone, and conclusions only on the transcript blocks.",
    hasMeetingNotes
      ? "- Base every substantive claim only on the provided meeting notes and transcript blocks."
      : "- Base every substantive claim only on the provided transcript blocks.",
    "- A summary format catalog will be provided in the user message.",
    "- Compare each available format's `matchDescription` against the meeting evidence before writing.",
    "- Choose exactly one format before writing the summary. Use `general` when no specialized format is a clear fit.",
    "- Follow the chosen format's structure and intent, but localize headings to the requested output language.",
    "- Omit, merge, or rename sections when the source material does not support them. Never pad the summary with empty sections.",
    "- Do not invent participants, decisions, action items, dates, deadlines, risks, or technical details.",
    "- If a point is plausible but not clearly supported, mark it as `A confirmer`.",
    "- Prefer concise, information-dense wording over generic management phrasing.",
    "- The transcript blocks are provided as citation-ready units with stable IDs and time ranges. Use them for grounding, but do not print the block IDs unless explicitly asked.",
    `- ${languageInstruction}`,
    "",
    "# Output contract",
    "- Return Markdown only.",
    "- Start with a single level-1 heading.",
    "- Use the chosen format as the default outline instead of inventing a different template.",
    "- Do not reveal the chosen format key, the classification step, or any confidence score.",
    "- Include dedicated sections for decisions, actions, open questions, and risks only when the source material supports them.",
    "- End with a short `## Next steps` section, or the closest equivalent in the chosen format, when concrete next steps are supported by the source material.",
  ].join("\n");
}

export function buildUserPrompt(
  input: GenerateMeetingSummaryInput & {
    summaryFormatCatalog?: ReadonlyArray<SummaryFormatDefinition>;
  },
): string {
  const normalizedMeetingNotes = input.meetingNotes.trim();
  const summaryFormatCatalog = input.summaryFormatCatalog ?? resolveSummaryFormatCatalog(input.summaryFormats);
  const transcriptBlockPayload = input.transcriptBlocks
    .map((block) => `<BLOCK id="${block.id}" start="${formatTimestamp(block.startSec)}" end="${formatTimestamp(block.endSec)}">\n${block.content}\n</BLOCK>`)
    .join("\n\n");

  return [
    "<MEETING_CONTEXT>",
    `Audio file: ${input.audioPath}`,
    `Notes file: ${input.notesPath ?? "none"}`,
    "Transcript timestamps refer to the accelerated x2 preprocessing audio that was sent to transcription.",
    "</MEETING_CONTEXT>",
    "",
    "<SUMMARY_FORMAT_CATALOG>",
    serializeSummaryFormatCatalog(summaryFormatCatalog),
    "</SUMMARY_FORMAT_CATALOG>",
    "",
    "<MEETING_NOTES>",
    normalizedMeetingNotes || "No meeting notes were provided.",
    "</MEETING_NOTES>",
    "",
    "<TRANSCRIPT_BLOCKS>",
    transcriptBlockPayload,
    "</TRANSCRIPT_BLOCKS>",
    "",
    "Write the best possible meeting summary from this material.",
  ].join("\n");
}

export function extractSummaryText(response: {
  output_text?: string | null;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
}): string {
  const directText = response.output_text?.trim();

  if (directText) {
    return directText;
  }

  const contentText = response.output
    ?.flatMap((item) =>
      Array.isArray(item.content)
        ? item.content.map((contentItem) => (typeof contentItem.text === "string" ? contentItem.text.trim() : "")).filter(Boolean)
        : [],
    )
    .join("\n")
    .trim();

  return contentText ?? "";
}
