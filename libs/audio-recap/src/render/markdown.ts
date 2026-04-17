import type { PreparedAudioFile } from "../audio/ffmpeg.js";
import { formatTimestamp, type TranscriptSegment } from "../domain/transcript.js";

export function renderTranscriptMarkdown(input: {
  audioPath: string;
  notesPath?: string;
  generatedAt: string;
  preparedAudio: PreparedAudioFile;
  segments: TranscriptSegment[];
}): string {
  const metadataLines = [
    "# Transcript du meeting",
    "",
    `- Audio source: \`${input.audioPath}\``,
    `- Notes source: ${formatNotesSource(input.notesPath)}`,
    "- Modèle de transcription: `gpt-4o-transcribe-diarize`",
    `- Prétraitement audio: vitesse \`x${input.preparedAudio.speedMultiplier}\`, format \`${input.preparedAudio.formatName}\``,
    `- Découpage: \`${input.preparedAudio.chunks.length}\` partie(s) avec overlap \`${input.preparedAudio.overlapSec}s\` quand nécessaire`,
    "- Base temporelle: les horodatages ci-dessous correspondent à l'audio accéléré envoyé à l'API",
    `- Généré le: \`${input.generatedAt}\``,
    "",
    "## Transcript",
    "",
  ];

  return `${[...metadataLines, ...renderSegmentLines(input.segments)].join("\n").trimEnd()}\n`;
}

export function renderSummaryMarkdown(input: { audioPath: string; notesPath?: string; generatedAt: string; summary: string }): string {
  const header = [
    `<!-- Audio source: ${input.audioPath} -->`,
    `<!-- Notes source: ${input.notesPath ?? "none"} -->`,
    `<!-- Generated at ${input.generatedAt} with gpt-5.4 reasoning high -->`,
    "",
  ];

  return [...header, input.summary.trim(), ""].join("\n");
}

export interface PrivacySafeTranscriptInput {
  title?: string;
  generatedAt: string;
  preparedAudio: Pick<PreparedAudioFile, "speedMultiplier" | "formatName" | "chunks" | "overlapSec">;
  segments: TranscriptSegment[];
}

export function renderPrivacySafeTranscriptMarkdown(input: PrivacySafeTranscriptInput): string {
  const heading = input.title ? sanitizeHeadingText(input.title) : "Transcript du meeting";
  const metadataLines = [
    `# ${heading}`,
    "",
    "- Modèle de transcription: `gpt-4o-transcribe-diarize`",
    `- Prétraitement audio: vitesse \`x${input.preparedAudio.speedMultiplier}\`, format \`${input.preparedAudio.formatName}\``,
    `- Découpage: \`${input.preparedAudio.chunks.length}\` partie(s) avec overlap \`${input.preparedAudio.overlapSec}s\` quand nécessaire`,
    "- Base temporelle: les horodatages ci-dessous correspondent à la timeline du média soumis à l'origine",
    `- Généré le: \`${input.generatedAt}\``,
    "",
    "## Transcript",
    "",
  ];

  return `${[...metadataLines, ...renderSegmentLines(input.segments)].join("\n").trimEnd()}\n`;
}

export interface PrivacySafeSummaryInput {
  title?: string;
  generatedAt: string;
  summary: string;
}

export function renderPrivacySafeSummaryMarkdown(input: PrivacySafeSummaryInput): string {
  const header = [`<!-- Generated at ${input.generatedAt} with gpt-5.4 reasoning high -->`, ""];
  const trimmedSummary = input.summary.trim();
  const titleBlock = input.title ? [`# ${sanitizeHeadingText(input.title)}`, ""] : [];

  if (titleBlock.length === 0) {
    return [...header, trimmedSummary, ""].join("\n");
  }

  const summaryWithoutLeadingHeading = stripLeadingHeading(trimmedSummary);
  return [...header, ...titleBlock, summaryWithoutLeadingHeading, ""].join("\n");
}

function renderSegmentLines(segments: TranscriptSegment[]): string[] {
  if (segments.length === 0) {
    return ["Aucun segment n'a été retourné par la transcription.", ""];
  }

  return segments.flatMap((segment) => [
    `### ${formatTimestamp(segment.startSec)} - ${formatTimestamp(segment.endSec)} · ${segment.speaker}`,
    "",
    segment.text,
    "",
  ]);
}

function formatNotesSource(notesPath?: string): string {
  return notesPath ? `\`${notesPath}\`` : "none";
}

function sanitizeHeadingText(value: string): string {
  return value.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
}

function stripLeadingHeading(summary: string): string {
  if (!/^#\s+/.test(summary)) {
    return summary;
  }

  const [, ...rest] = summary.split(/\r?\n/);
  const remainder = rest.join("\n");
  return remainder.replace(/^\s*\n/, "");
}
