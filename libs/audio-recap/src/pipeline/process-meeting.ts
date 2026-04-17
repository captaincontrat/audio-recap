import type OpenAI from "openai";

import { DEFAULT_CHUNK_OVERLAP_SEC, type PreparedAudioFile, prepareAudioForUpload } from "../audio/ffmpeg.js";
import { buildTranscriptArtifacts, type TranscriptArtifacts } from "../domain/transcript.js";
import { generateMeetingSummary } from "../openai/summarize.js";
import { type TranscriptionResult, transcribePreparedAudio } from "../openai/transcribe.js";

export type MeetingInputKind = "original" | "mp3-derivative";

export interface MeetingProcessingInput {
  inputKind: MeetingInputKind;
  audioPath: string;
  tempDir: string;
  meetingNotes?: string;
  notesPath?: string;
  outputLanguage?: string;
  overlapSec?: number;
}

export interface MeetingProcessingResult {
  inputKind: MeetingInputKind;
  preparedAudio: PreparedAudioFile;
  transcription: TranscriptionResult;
  transcriptArtifacts: TranscriptArtifacts;
  summary: string;
}

export type MeetingPipelineStage = "prepare-audio" | "transcribe" | "build-transcript" | "generate-summary";

export interface MeetingPipelineHooks {
  onStage?: (stage: MeetingPipelineStage, details?: Record<string, unknown>) => void;
}

export async function runMeetingPipeline(client: OpenAI, input: MeetingProcessingInput, hooks: MeetingPipelineHooks = {}): Promise<MeetingProcessingResult> {
  const overlapSec = input.overlapSec ?? DEFAULT_CHUNK_OVERLAP_SEC;
  const notifyStage = hooks.onStage ?? (() => {});

  notifyStage("prepare-audio", { inputKind: input.inputKind, audioPath: input.audioPath });
  const preparedAudio = await prepareAudioForUpload(input.audioPath, input.tempDir, {
    overlapSec,
  });

  notifyStage("transcribe", { chunkCount: preparedAudio.chunks.length });
  const transcription = await transcribePreparedAudio(client, preparedAudio, {
    ...(input.outputLanguage ? { language: input.outputLanguage } : {}),
  });

  notifyStage("build-transcript", { segmentCount: transcription.mergedSegments.length });
  const transcriptArtifacts = buildTranscriptArtifacts(transcription.mergedSegments);

  notifyStage("generate-summary", { blockCount: transcriptArtifacts.blocks.length });
  const summary = await generateMeetingSummary(client, {
    audioPath: input.audioPath,
    ...(input.notesPath ? { notesPath: input.notesPath } : {}),
    meetingNotes: input.meetingNotes ?? "",
    transcriptBlocks: transcriptArtifacts.blocks,
    ...(input.outputLanguage ? { outputLanguage: input.outputLanguage } : {}),
  });

  return {
    inputKind: input.inputKind,
    preparedAudio,
    transcription,
    transcriptArtifacts,
    summary,
  };
}
