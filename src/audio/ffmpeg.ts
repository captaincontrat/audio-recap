import { execFile } from "node:child_process";
import { mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const TARGET_UPLOAD_BYTES = 24 * 1024 * 1024;
export const DEFAULT_CHUNK_OVERLAP_SEC = 1;
export const DEFAULT_SPEED_MULTIPLIER = 2;
export const MAX_TRANSCRIBE_DURATION_SEC = 1390;
export const TARGET_TRANSCRIBE_DURATION_SEC = 600;

const PREPARED_AUDIO_CODEC = "libmp3lame";
const PREPARED_AUDIO_BITRATE = "48k";
const PREPARED_AUDIO_CHANNELS = "1";
const PREPARED_AUDIO_SAMPLE_RATE = "16000";
const SPLIT_RETRY_FACTOR = 0.85;
const SPLIT_ATTEMPTS = 6;
const SPLIT_MARGIN = 0.9;

export interface AudioFileStats {
  durationSec: number;
  sizeBytes: number;
  formatName: string;
}

export interface PreparedAudioChunk {
  index: number;
  path: string;
  startSec: number;
  durationSec: number;
  sizeBytes: number;
  overlapBeforeSec: number;
  overlapAfterSec: number;
}

export interface PreparedAudioFile {
  sourcePath: string;
  preparedPath: string;
  durationSec: number;
  sizeBytes: number;
  formatName: string;
  speedMultiplier: number;
  overlapSec: number;
  chunks: PreparedAudioChunk[];
}

interface ChunkWindowPlan {
  index: number;
  startSec: number;
  durationSec: number;
  overlapBeforeSec: number;
  overlapAfterSec: number;
}

export async function assertBinaryExists(binaryName: string): Promise<void> {
  try {
    await execFileAsync(binaryName, ["-version"]);
  } catch (error) {
    throw new Error(`Required binary "${binaryName}" is not available in PATH.`, {
      cause: error,
    });
  }
}

export async function probeAudioFile(filePath: string): Promise<AudioFileStats> {
  const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-show_entries", "format=duration,size,format_name", "-of", "json", filePath]);

  const parsed = JSON.parse(stdout) as {
    format?: {
      duration?: string;
      size?: string;
      format_name?: string;
    };
  };

  const durationSec = Number(parsed.format?.duration ?? 0);
  const sizeBytes = Number(parsed.format?.size ?? 0);
  const formatName = parsed.format?.format_name ?? "unknown";

  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    throw new Error(`Unable to determine audio duration for "${filePath}".`);
  }

  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    throw new Error(`Unable to determine audio size for "${filePath}".`);
  }

  return {
    durationSec,
    sizeBytes,
    formatName,
  };
}

export async function prepareAudioForUpload(
  sourcePath: string,
  tempDir: string,
  options: {
    targetUploadBytes?: number;
    overlapSec?: number;
    speedMultiplier?: number;
  } = {},
): Promise<PreparedAudioFile> {
  const targetUploadBytes = options.targetUploadBytes ?? TARGET_UPLOAD_BYTES;
  const overlapSec = options.overlapSec ?? DEFAULT_CHUNK_OVERLAP_SEC;
  const speedMultiplier = options.speedMultiplier ?? DEFAULT_SPEED_MULTIPLIER;

  if (speedMultiplier !== 2) {
    throw new Error(`Only x2 preprocessing is currently supported, received x${speedMultiplier}.`);
  }

  await Promise.all([assertBinaryExists("ffmpeg"), assertBinaryExists("ffprobe")]);
  await mkdir(tempDir, { recursive: true });

  const preparedPath = path.join(tempDir, "prepared-x2.mp3");
  await preprocessAudio(sourcePath, preparedPath);

  const preparedStats = await probeAudioFile(preparedPath);
  const chunks =
    preparedStats.sizeBytes <= targetUploadBytes && preparedStats.durationSec <= TARGET_TRANSCRIBE_DURATION_SEC
      ? [
          {
            index: 0,
            path: preparedPath,
            startSec: 0,
            durationSec: preparedStats.durationSec,
            sizeBytes: preparedStats.sizeBytes,
            overlapBeforeSec: 0,
            overlapAfterSec: 0,
          },
        ]
      : await splitPreparedAudio(preparedPath, preparedStats, tempDir, targetUploadBytes, overlapSec);

  return {
    sourcePath,
    preparedPath,
    durationSec: preparedStats.durationSec,
    sizeBytes: preparedStats.sizeBytes,
    formatName: preparedStats.formatName,
    speedMultiplier,
    overlapSec,
    chunks,
  };
}

async function preprocessAudio(sourcePath: string, targetPath: string): Promise<void> {
  await execFileAsync("ffmpeg", [
    "-y",
    "-i",
    sourcePath,
    "-vn",
    "-filter:a",
    "atempo=2.0",
    "-ac",
    PREPARED_AUDIO_CHANNELS,
    "-ar",
    PREPARED_AUDIO_SAMPLE_RATE,
    "-c:a",
    PREPARED_AUDIO_CODEC,
    "-b:a",
    PREPARED_AUDIO_BITRATE,
    targetPath,
  ]);
}

async function splitPreparedAudio(
  preparedPath: string,
  preparedStats: AudioFileStats,
  tempDir: string,
  targetUploadBytes: number,
  overlapSec: number,
): Promise<PreparedAudioChunk[]> {
  const bytesPerSecond = preparedStats.sizeBytes / preparedStats.durationSec;
  let targetChunkDurationSec = Math.max(
    overlapSec + 5,
    Math.min(TARGET_TRANSCRIBE_DURATION_SEC, MAX_TRANSCRIBE_DURATION_SEC, Math.floor((targetUploadBytes * SPLIT_MARGIN) / bytesPerSecond)),
  );

  for (let attempt = 0; attempt < SPLIT_ATTEMPTS; attempt += 1) {
    const chunkDir = path.join(tempDir, `chunks-attempt-${attempt + 1}`);
    await rm(chunkDir, { recursive: true, force: true });
    await mkdir(chunkDir, { recursive: true });

    const plan = buildChunkPlan(preparedStats.durationSec, targetChunkDurationSec, overlapSec);
    const chunks: PreparedAudioChunk[] = [];
    let oversizedChunk = false;

    for (const window of plan) {
      const chunkPath = path.join(chunkDir, `chunk-${String(window.index + 1).padStart(3, "0")}.mp3`);
      await extractChunk(preparedPath, chunkPath, window.startSec, window.durationSec);

      const chunkStat = await stat(chunkPath);

      if (chunkStat.size > targetUploadBytes) {
        oversizedChunk = true;
        break;
      }

      chunks.push({
        index: window.index,
        path: chunkPath,
        startSec: window.startSec,
        durationSec: window.durationSec,
        sizeBytes: chunkStat.size,
        overlapBeforeSec: window.overlapBeforeSec,
        overlapAfterSec: window.overlapAfterSec,
      });
    }

    if (!oversizedChunk) {
      return chunks;
    }

    targetChunkDurationSec = Math.max(overlapSec + 5, Math.floor(targetChunkDurationSec * SPLIT_RETRY_FACTOR));
  }

  throw new Error(`Unable to split "${preparedPath}" into chunks below ${targetUploadBytes} bytes after ${SPLIT_ATTEMPTS} attempts.`);
}

function buildChunkPlan(totalDurationSec: number, targetChunkDurationSec: number, overlapSec: number): ChunkWindowPlan[] {
  if (targetChunkDurationSec <= overlapSec) {
    throw new Error("Chunk duration must be greater than the overlap duration.");
  }

  const plan: ChunkWindowPlan[] = [];
  let currentStartSec = 0;
  let index = 0;

  while (currentStartSec < totalDurationSec) {
    const remainingSec = totalDurationSec - currentStartSec;
    const durationSec = Math.min(targetChunkDurationSec, remainingSec);
    const reachesEnd = currentStartSec + durationSec >= totalDurationSec;

    plan.push({
      index,
      startSec: currentStartSec,
      durationSec,
      overlapBeforeSec: index === 0 ? 0 : overlapSec,
      overlapAfterSec: reachesEnd ? 0 : overlapSec,
    });

    if (reachesEnd) {
      break;
    }

    currentStartSec += durationSec - overlapSec;
    index += 1;
  }

  return plan;
}

async function extractChunk(preparedPath: string, chunkPath: string, startSec: number, durationSec: number): Promise<void> {
  await execFileAsync("ffmpeg", [
    "-y",
    "-ss",
    formatFfmpegSeconds(startSec),
    "-t",
    formatFfmpegSeconds(durationSec),
    "-i",
    preparedPath,
    "-vn",
    "-ac",
    PREPARED_AUDIO_CHANNELS,
    "-ar",
    PREPARED_AUDIO_SAMPLE_RATE,
    "-c:a",
    PREPARED_AUDIO_CODEC,
    "-b:a",
    PREPARED_AUDIO_BITRATE,
    chunkPath,
  ]);
}

function formatFfmpegSeconds(value: number): string {
  return value.toFixed(3);
}
