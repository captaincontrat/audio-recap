import { createReadStream } from "node:fs";

import OpenAI from "openai";

import type { PreparedAudioFile } from "../audio/ffmpeg.js";
import {
  mergeChunkTranscriptions,
  type ChunkLocalSegment,
  type ChunkTranscript,
  type TranscriptSegment,
} from "../domain/transcript.js";

interface DiarizedApiSegment {
  speaker?: string;
  start?: number;
  end?: number;
  text?: string;
}

interface DiarizedApiResponse {
  text?: string;
  segments?: DiarizedApiSegment[];
}

export interface TranscriptionResult {
  chunkTranscripts: ChunkTranscript[];
  mergedSegments: TranscriptSegment[];
}

export async function transcribePreparedAudio(
  client: OpenAI,
  preparedAudio: PreparedAudioFile,
  options: {
    language?: string;
  } = {},
): Promise<TranscriptionResult> {
  const chunkTranscripts = (
    await Promise.all(
      preparedAudio.chunks.map(async (chunk) => {
        console.log(
          `Starting transcription for chunk ${chunk.index + 1}/${preparedAudio.chunks.length} (${Math.round(chunk.durationSec)}s)...`,
        );

        const response = (await client.audio.transcriptions.create({
          file: createReadStream(chunk.path),
          model: "gpt-4o-transcribe-diarize",
          response_format: "diarized_json",
          chunking_strategy: "auto",
          ...(options.language ? { language: options.language } : {}),
        } as never)) as unknown as DiarizedApiResponse;

        console.log(`Completed transcription for chunk ${chunk.index + 1}/${preparedAudio.chunks.length}.`);

        return {
          chunkIndex: chunk.index,
          chunkStartSec: chunk.startSec,
          segments: extractChunkSegments(response),
        } satisfies ChunkTranscript;
      }),
    )
  ).sort((left, right) => left.chunkIndex - right.chunkIndex);

  return {
    chunkTranscripts,
    mergedSegments: mergeChunkTranscriptions(chunkTranscripts, preparedAudio.overlapSec),
  };
}

function extractChunkSegments(response: DiarizedApiResponse): ChunkLocalSegment[] {
  const segments = Array.isArray(response.segments)
    ? response.segments
        .map((segment) => ({
          speaker: (segment.speaker ?? "speaker_unknown").trim() || "speaker_unknown",
          startSec: Number(segment.start ?? 0),
          endSec: Number(segment.end ?? segment.start ?? 0),
          text: (segment.text ?? "").trim(),
        }))
        .filter(
          (segment) =>
            segment.text.length > 0 &&
            Number.isFinite(segment.startSec) &&
            Number.isFinite(segment.endSec) &&
            segment.endSec >= segment.startSec,
        )
    : [];

  if (segments.length > 0) {
    return segments;
  }

  const fallbackText = response.text?.trim();

  if (!fallbackText) {
    return [];
  }

  return [
    {
      speaker: "speaker_unknown",
      startSec: 0,
      endSec: 0,
      text: fallbackText,
    },
  ];
}
