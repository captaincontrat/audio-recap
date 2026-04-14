import type OpenAI from "openai";

import { formatTimestamp, type TranscriptBlock } from "../domain/transcript.js";

export async function generateMeetingSummary(
  client: OpenAI,
  input: {
    audioPath: string;
    notesPath?: string;
    meetingNotes: string;
    transcriptBlocks: TranscriptBlock[];
    outputLanguage?: string;
  },
): Promise<string> {
  if (input.transcriptBlocks.length === 0) {
    throw new Error("Cannot generate a summary without transcript blocks.");
  }

  const developerPrompt = buildDeveloperPrompt(input.outputLanguage, input.meetingNotes.trim().length > 0);
  const userPrompt = buildUserPrompt(input);
  const response = await client.responses.create({
    model: "gpt-5.4",
    reasoning: {
      effort: "high",
    },
    max_output_tokens: 12000,
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
      ? "- Analyze the meeting notes first to infer the most useful summary structure for this specific meeting."
      : "- No meeting notes were provided. Infer the most useful summary structure directly from the transcript blocks.",
    hasMeetingNotes
      ? "- Cross-check the inferred structure against the transcript blocks before writing the summary."
      : "- Base the structure, tone, and conclusions only on the transcript blocks.",
    hasMeetingNotes
      ? "- Base every substantive claim only on the provided meeting notes and transcript blocks."
      : "- Base every substantive claim only on the provided transcript blocks.",
    "- Do not invent participants, decisions, action items, dates, deadlines, risks, or technical details.",
    "- If a point is plausible but not clearly supported, mark it as `A confirmer`.",
    "- Prefer concise, information-dense wording over generic management phrasing.",
    "- The transcript blocks are provided as citation-ready units with stable IDs and time ranges. Use them for grounding, but do not print the block IDs unless explicitly asked.",
    `- ${languageInstruction}`,
    "",
    "# Output contract",
    "- Return Markdown only.",
    "- Start with a single level-1 heading.",
    "- Choose section headings that best fit the meeting content rather than forcing a rigid template.",
    "- Include dedicated sections for decisions, actions, open questions, and risks only when the source material supports them.",
    "- End with a short `## Next steps` section when concrete next steps are supported by the source material.",
  ].join("\n");
}

export function buildUserPrompt(input: { audioPath: string; notesPath?: string; meetingNotes: string; transcriptBlocks: TranscriptBlock[] }): string {
  const normalizedMeetingNotes = input.meetingNotes.trim();
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
