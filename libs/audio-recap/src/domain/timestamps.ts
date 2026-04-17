import type { TranscriptSegment } from "./transcript.js";

export type RatioSource = "duration-observed" | "speed-multiplier" | "default";

export interface DurationRatio {
  value: number;
  source: RatioSource;
}

export const DEFAULT_DURATION_RATIO: DurationRatio = {
  value: 1,
  source: "default",
};

export interface BuildDurationRatioInput {
  originalDurationSec?: number;
  preparedDurationSec?: number;
  speedMultiplier?: number;
}

export function buildDurationRatio(input: BuildDurationRatioInput): DurationRatio {
  const observedRatio = computeObservedRatio(input.originalDurationSec, input.preparedDurationSec);

  if (observedRatio !== null) {
    return { value: observedRatio, source: "duration-observed" };
  }

  if (typeof input.speedMultiplier === "number" && Number.isFinite(input.speedMultiplier) && input.speedMultiplier > 0) {
    return { value: input.speedMultiplier, source: "speed-multiplier" };
  }

  return DEFAULT_DURATION_RATIO;
}

export function normalizeSegmentsToOriginalTime(segments: TranscriptSegment[], ratio: DurationRatio): TranscriptSegment[] {
  if (segments.length === 0) {
    return [];
  }

  if (ratio.value === 1) {
    return segments.map((segment) => ({ ...segment }));
  }

  return segments.map((segment) => ({
    ...segment,
    startSec: roundToMilliseconds(segment.startSec * ratio.value),
    endSec: roundToMilliseconds(segment.endSec * ratio.value),
  }));
}

function computeObservedRatio(originalDurationSec?: number, preparedDurationSec?: number): number | null {
  if (!isPositiveFinite(originalDurationSec) || !isPositiveFinite(preparedDurationSec)) {
    return null;
  }

  return originalDurationSec / preparedDurationSec;
}

function isPositiveFinite(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function roundToMilliseconds(value: number): number {
  return Math.round(value * 1000) / 1000;
}
