export interface ChunkLocalSegment {
  speaker: string;
  startSec: number;
  endSec: number;
  text: string;
}

export interface ChunkTranscript {
  chunkIndex: number;
  chunkStartSec: number;
  segments: ChunkLocalSegment[];
}

export interface TranscriptSegment {
  id: string;
  speaker: string;
  startSec: number;
  endSec: number;
  text: string;
  chunkIndex: number;
}

export interface TranscriptBlock {
  id: string;
  startSec: number;
  endSec: number;
  content: string;
  segmentIds: string[];
}

export interface TranscriptArtifacts {
  segments: TranscriptSegment[];
  blocks: TranscriptBlock[];
  speakers: string[];
  fullText: string;
}

const DUPLICATE_TIME_MARGIN_SEC = 1.75;
const DUPLICATE_TEXT_SIMILARITY_THRESHOLD = 0.8;

export function formatTimestamp(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

export function mergeChunkTranscriptions(chunkTranscripts: ChunkTranscript[], overlapSec: number): TranscriptSegment[] {
  const flattened = chunkTranscripts
    .flatMap((chunkTranscript) =>
      chunkTranscript.segments.map((segment) => ({
        id: "",
        speaker: segment.speaker,
        startSec: segment.startSec + chunkTranscript.chunkStartSec,
        endSec: segment.endSec + chunkTranscript.chunkStartSec,
        text: segment.text.trim(),
        chunkIndex: chunkTranscript.chunkIndex,
      })),
    )
    .filter((segment) => segment.text.length > 0)
    .sort((left, right) => {
      if (left.startSec === right.startSec) {
        return left.endSec - right.endSec;
      }

      return left.startSec - right.startSec;
    });

  const merged: Omit<TranscriptSegment, "id">[] = [];

  for (const candidate of flattened) {
    const previous = merged.at(-1);

    if (previous && shouldDeduplicate(previous, candidate, overlapSec)) {
      merged[merged.length - 1] = mergeDuplicatePair(previous, candidate);
      continue;
    }

    merged.push(candidate);
  }

  return merged.map((segment, index) => ({
    ...segment,
    id: `seg-${String(index + 1).padStart(5, "0")}`,
  }));
}

export function buildTranscriptArtifacts(
  segments: TranscriptSegment[],
  options: {
    maxBlockChars?: number;
    maxSegmentsPerBlock?: number;
  } = {},
): TranscriptArtifacts {
  const maxBlockChars = options.maxBlockChars ?? 1800;
  const maxSegmentsPerBlock = options.maxSegmentsPerBlock ?? 10;
  const speakers = Array.from(new Set(segments.map((segment) => segment.speaker)));
  const fullText = segments.map((segment) => `[${formatTimestamp(segment.startSec)}] ${segment.speaker}: ${segment.text}`).join("\n");
  const blocks: TranscriptBlock[] = [];

  let currentLines: string[] = [];
  let currentSegmentIds: string[] = [];
  let currentStartSec = 0;
  let currentEndSec = 0;

  const flushBlock = () => {
    if (currentLines.length === 0) {
      return;
    }

    blocks.push({
      id: `block-${String(blocks.length + 1).padStart(4, "0")}`,
      startSec: currentStartSec,
      endSec: currentEndSec,
      content: currentLines.join("\n"),
      segmentIds: [...currentSegmentIds],
    });

    currentLines = [];
    currentSegmentIds = [];
    currentStartSec = 0;
    currentEndSec = 0;
  };

  for (const segment of segments) {
    const line = `[${formatTimestamp(segment.startSec)} - ${formatTimestamp(segment.endSec)}] ${segment.speaker}: ${segment.text}`;
    const nextLength = currentLines.join("\n").length + (currentLines.length > 0 ? 1 : 0) + line.length;
    const wouldOverflow = currentLines.length >= maxSegmentsPerBlock || (currentLines.length > 0 && nextLength > maxBlockChars);

    if (wouldOverflow) {
      flushBlock();
    }

    if (currentLines.length === 0) {
      currentStartSec = segment.startSec;
    }

    currentLines.push(line);
    currentSegmentIds.push(segment.id);
    currentEndSec = segment.endSec;
  }

  flushBlock();

  return {
    segments,
    blocks,
    speakers,
    fullText,
  };
}

function shouldDeduplicate(previous: Omit<TranscriptSegment, "id">, current: Omit<TranscriptSegment, "id">, overlapSec: number): boolean {
  const previousText = normalizeText(previous.text);
  const currentText = normalizeText(current.text);

  if (!previousText || !currentText) {
    return false;
  }

  const overlapWindow = overlapSec + DUPLICATE_TIME_MARGIN_SEC;
  const startsClose = Math.abs(current.startSec - previous.startSec) <= overlapWindow;
  const rangesTouch = current.startSec <= previous.endSec + overlapWindow;

  if (!startsClose && !rangesTouch) {
    return false;
  }

  if (previousText === currentText) {
    return true;
  }

  if (previousText.includes(currentText) || currentText.includes(previousText)) {
    return true;
  }

  return computeWordOverlap(previousText, currentText) >= DUPLICATE_TEXT_SIMILARITY_THRESHOLD;
}

function mergeDuplicatePair(previous: Omit<TranscriptSegment, "id">, current: Omit<TranscriptSegment, "id">): Omit<TranscriptSegment, "id"> {
  const normalizedTextsMatch = normalizeText(previous.text) === normalizeText(current.text);
  const preferredText = pickPreferredText(previous.text, current.text);
  const preferredSpeaker = normalizedTextsMatch ? previous.speaker : preferredText === current.text ? current.speaker : previous.speaker;

  return {
    speaker: preferredSpeaker,
    startSec: Math.min(previous.startSec, current.startSec),
    endSec: Math.max(previous.endSec, current.endSec),
    text: preferredText,
    chunkIndex: Math.min(previous.chunkIndex, current.chunkIndex),
  };
}

function pickPreferredText(left: string, right: string): string {
  const leftNormalized = normalizeText(left);
  const rightNormalized = normalizeText(right);

  if (leftNormalized === rightNormalized) {
    return left.length >= right.length ? left : right;
  }

  if (rightNormalized.includes(leftNormalized)) {
    return right;
  }

  if (leftNormalized.includes(rightNormalized)) {
    return left;
  }

  return right.length >= left.length ? right : left;
}

function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function computeWordOverlap(left: string, right: string): number {
  const leftWords = new Set(left.split(" ").filter(Boolean));
  const rightWords = new Set(right.split(" ").filter(Boolean));

  if (leftWords.size === 0 || rightWords.size === 0) {
    return 0;
  }

  let sharedCount = 0;

  for (const word of leftWords) {
    if (rightWords.has(word)) {
      sharedCount += 1;
    }
  }

  return sharedCount / Math.max(leftWords.size, rightWords.size);
}
