import { formatTimestamp, type TranscriptSegment } from "../domain/transcript.js";
import type { PreparedAudioFile } from "../audio/ffmpeg.js";

export function renderTranscriptMarkdown(input: {
  audioPath: string;
  notesPath: string;
  generatedAt: string;
  preparedAudio: PreparedAudioFile;
  segments: TranscriptSegment[];
}): string {
  const metadataLines = [
    "# Transcript du meeting",
    "",
    `- Audio source: \`${input.audioPath}\``,
    `- Notes source: \`${input.notesPath}\``,
    "- Modèle de transcription: `gpt-4o-transcribe-diarize`",
    `- Prétraitement audio: vitesse \`x${input.preparedAudio.speedMultiplier}\`, format \`${input.preparedAudio.formatName}\``,
    `- Découpage: \`${input.preparedAudio.chunks.length}\` partie(s) avec overlap \`${input.preparedAudio.overlapSec}s\` quand nécessaire`,
    "- Base temporelle: les horodatages ci-dessous correspondent à l'audio accéléré envoyé à l'API",
    `- Généré le: \`${input.generatedAt}\``,
    "",
    "## Transcript",
    "",
  ];

  const segmentLines =
    input.segments.length > 0
      ? input.segments.flatMap((segment) => [
          `### ${formatTimestamp(segment.startSec)} - ${formatTimestamp(segment.endSec)} · ${segment.speaker}`,
          "",
          segment.text,
          "",
        ])
      : ["Aucun segment n'a été retourné par la transcription.", ""];

  return [...metadataLines, ...segmentLines].join("\n").trimEnd() + "\n";
}

export function renderSummaryMarkdown(input: {
  audioPath: string;
  notesPath: string;
  generatedAt: string;
  summary: string;
}): string {
  const header = [
    `<!-- Generated from ${input.audioPath} and ${input.notesPath} -->`,
    `<!-- Generated at ${input.generatedAt} with gpt-5.4 reasoning high -->`,
    "",
  ];

  return [...header, input.summary.trim(), ""].join("\n");
}
