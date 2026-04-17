import type OpenAI from "openai";
import { buildDurationRatio, type DurationRatio, normalizeSegmentsToOriginalTime } from "../domain/timestamps.js";
import { buildTranscriptArtifacts, type TranscriptArtifacts, type TranscriptSegment } from "../domain/transcript.js";
import { generateMeetingTitle } from "../openai/title.js";
import {
  type PrivacySafeSummaryInput,
  type PrivacySafeTranscriptInput,
  renderPrivacySafeSummaryMarkdown,
  renderPrivacySafeTranscriptMarkdown,
} from "../render/markdown.js";
import {
  type MeetingInputKind,
  type MeetingPipelineHooks,
  type MeetingProcessingInput,
  type MeetingProcessingResult,
  runMeetingPipeline,
} from "./process-meeting.js";

export interface WorkerProcessingInput extends MeetingProcessingInput {
  originalDurationSec?: number;
  generatedAt?: string | Date;
}

export interface WorkerProcessingOutputs {
  title: string;
  transcriptMarkdown: string;
  summaryMarkdown: string;
  normalizedSegments: TranscriptSegment[];
  normalizedTranscriptArtifacts: TranscriptArtifacts;
  durationRatio: DurationRatio;
  generatedAt: string;
}

export interface WorkerProcessingResult extends MeetingProcessingResult {
  inputKind: MeetingInputKind;
  outputs: WorkerProcessingOutputs;
}

export async function processMeetingForWorker(client: OpenAI, input: WorkerProcessingInput, hooks: MeetingPipelineHooks = {}): Promise<WorkerProcessingResult> {
  const pipelineResult = await runMeetingPipeline(client, input, hooks);

  const durationRatio = buildDurationRatio({
    ...(typeof input.originalDurationSec === "number" ? { originalDurationSec: input.originalDurationSec } : {}),
    preparedDurationSec: pipelineResult.preparedAudio.durationSec,
    speedMultiplier: pipelineResult.preparedAudio.speedMultiplier,
  });

  const normalizedSegments = normalizeSegmentsToOriginalTime(pipelineResult.transcription.mergedSegments, durationRatio);
  const normalizedTranscriptArtifacts = buildTranscriptArtifacts(normalizedSegments);

  const title = await generateMeetingTitle(client, {
    summary: pipelineResult.summary,
    transcriptBlocks: normalizedTranscriptArtifacts.blocks,
    ...(input.meetingNotes ? { meetingNotes: input.meetingNotes } : {}),
    ...(input.outputLanguage ? { outputLanguage: input.outputLanguage } : {}),
  });

  const generatedAt = formatGeneratedAt(input.generatedAt);

  const transcriptMarkdownInput: PrivacySafeTranscriptInput = {
    title,
    generatedAt,
    preparedAudio: pipelineResult.preparedAudio,
    segments: normalizedSegments,
  };

  const summaryMarkdownInput: PrivacySafeSummaryInput = {
    title,
    generatedAt,
    summary: pipelineResult.summary,
  };

  return {
    ...pipelineResult,
    outputs: {
      title,
      transcriptMarkdown: renderPrivacySafeTranscriptMarkdown(transcriptMarkdownInput),
      summaryMarkdown: renderPrivacySafeSummaryMarkdown(summaryMarkdownInput),
      normalizedSegments,
      normalizedTranscriptArtifacts,
      durationRatio,
      generatedAt,
    },
  };
}

function formatGeneratedAt(value: WorkerProcessingInput["generatedAt"]): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  return new Date().toISOString();
}
