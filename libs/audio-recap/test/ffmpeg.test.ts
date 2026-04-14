import { afterEach, describe, expect, it, vi } from "vitest";

const ffmpegMocks = vi.hoisted(() => ({
  execFile: vi.fn(),
  mkdir: vi.fn(),
  rm: vi.fn(),
  stat: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFile: ffmpegMocks.execFile,
}));

vi.mock("node:util", () => ({
  promisify: (fn: (file: string, args: string[], callback: ExecCallback) => void) => (file: string, args: string[]) =>
    new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      fn(file, args, (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }

        resolve({ stdout, stderr });
      });
    }),
}));

vi.mock("node:fs/promises", () => ({
  mkdir: ffmpegMocks.mkdir,
  rm: ffmpegMocks.rm,
  stat: ffmpegMocks.stat,
}));

import { assertBinaryExists, __private__ as ffmpegPrivate, prepareAudioForUpload, probeAudioFile } from "../src/audio/ffmpeg.js";

type ExecCallback = (error: Error | null, stdout: string, stderr: string) => void;

function queueExecSuccess(stdout = "", stderr = ""): void {
  ffmpegMocks.execFile.mockImplementationOnce((_file: string, _args: string[], callback: ExecCallback) => {
    callback(null, stdout, stderr);
  });
}

function queueExecFailure(message: string): void {
  ffmpegMocks.execFile.mockImplementationOnce((_file: string, _args: string[], callback: ExecCallback) => {
    callback(new Error(message), "", "");
  });
}

describe("ffmpeg audio preparation", () => {
  afterEach(() => {
    vi.clearAllMocks();
    ffmpegMocks.mkdir.mockResolvedValue(undefined);
    ffmpegMocks.rm.mockResolvedValue(undefined);
  });

  it("checks required binaries", async () => {
    queueExecSuccess("ffmpeg version");
    await expect(assertBinaryExists("ffmpeg")).resolves.toBeUndefined();

    queueExecFailure("command not found");
    await expect(assertBinaryExists("ffprobe")).rejects.toThrow('Required binary "ffprobe" is not available in PATH.');
  });

  it("probes audio metadata and rejects invalid ffprobe payloads", async () => {
    queueExecSuccess(JSON.stringify({ format: { duration: "42", size: "2048", format_name: "mp3" } }));
    await expect(probeAudioFile("/tmp/input.m4a")).resolves.toEqual({
      durationSec: 42,
      sizeBytes: 2048,
      formatName: "mp3",
    });

    queueExecSuccess(JSON.stringify({ format: { duration: "42", size: "2048" } }));
    await expect(probeAudioFile("/tmp/input.m4a")).resolves.toEqual({
      durationSec: 42,
      sizeBytes: 2048,
      formatName: "unknown",
    });

    queueExecSuccess(JSON.stringify({}));
    await expect(probeAudioFile("/tmp/input.m4a")).rejects.toThrow('Unable to determine audio duration for "/tmp/input.m4a".');

    queueExecSuccess(JSON.stringify({ format: { duration: "0", size: "2048", format_name: "mp3" } }));
    await expect(probeAudioFile("/tmp/input.m4a")).rejects.toThrow('Unable to determine audio duration for "/tmp/input.m4a".');

    queueExecSuccess(JSON.stringify({ format: { duration: "42", size: "0", format_name: "mp3" } }));
    await expect(probeAudioFile("/tmp/input.m4a")).rejects.toThrow('Unable to determine audio size for "/tmp/input.m4a".');
  });

  it("prepares a single upload chunk when the processed file already fits", async () => {
    queueExecSuccess();
    queueExecSuccess();
    queueExecSuccess();
    queueExecSuccess(JSON.stringify({ format: { duration: "120", size: "1024", format_name: "mp3" } }));

    const prepared = await prepareAudioForUpload("/tmp/source.m4a", "/tmp/work", {
      targetUploadBytes: 2048,
      overlapSec: 2,
    });

    expect(ffmpegMocks.mkdir).toHaveBeenCalledWith("/tmp/work", { recursive: true });
    expect(prepared).toEqual({
      sourcePath: "/tmp/source.m4a",
      preparedPath: "/tmp/work/prepared-x2.mp3",
      durationSec: 120,
      sizeBytes: 1024,
      formatName: "mp3",
      speedMultiplier: 2,
      overlapSec: 2,
      chunks: [
        {
          index: 0,
          path: "/tmp/work/prepared-x2.mp3",
          startSec: 0,
          durationSec: 120,
          sizeBytes: 1024,
          overlapBeforeSec: 0,
          overlapAfterSec: 0,
        },
      ],
    });
  });

  it("rejects unsupported preprocessing speeds", async () => {
    await expect(
      prepareAudioForUpload("/tmp/source.m4a", "/tmp/work", {
        speedMultiplier: 1,
      }),
    ).rejects.toThrow("Only x2 preprocessing is currently supported, received x1.");
  });

  it("retries chunk splitting when the first attempt produces oversized chunks", async () => {
    queueExecSuccess();
    queueExecSuccess();
    queueExecSuccess();
    queueExecSuccess(JSON.stringify({ format: { duration: "700", size: "1400", format_name: "mp3" } }));
    queueExecSuccess();
    queueExecSuccess();
    queueExecSuccess();

    ffmpegMocks.stat.mockResolvedValueOnce({ size: 1200 });
    ffmpegMocks.stat.mockResolvedValueOnce({ size: 800 });
    ffmpegMocks.stat.mockResolvedValueOnce({ size: 700 });

    const prepared = await prepareAudioForUpload("/tmp/source.m4a", "/tmp/work", {
      targetUploadBytes: 1000,
      overlapSec: 1,
    });

    expect(prepared.chunks).toEqual([
      {
        index: 0,
        path: "/tmp/work/chunks-attempt-2/chunk-001.mp3",
        startSec: 0,
        durationSec: 382,
        sizeBytes: 800,
        overlapBeforeSec: 0,
        overlapAfterSec: 1,
      },
      {
        index: 1,
        path: "/tmp/work/chunks-attempt-2/chunk-002.mp3",
        startSec: 381,
        durationSec: 319,
        sizeBytes: 700,
        overlapBeforeSec: 1,
        overlapAfterSec: 0,
      },
    ]);
  });

  it("fails after exhausting all split attempts", async () => {
    queueExecSuccess();
    queueExecSuccess();
    queueExecSuccess();
    queueExecSuccess(JSON.stringify({ format: { duration: "700", size: "1400", format_name: "mp3" } }));

    for (let attempt = 0; attempt < 6; attempt += 1) {
      queueExecSuccess();
      ffmpegMocks.stat.mockResolvedValueOnce({ size: 1500 });
    }

    await expect(
      prepareAudioForUpload("/tmp/source.m4a", "/tmp/work", {
        targetUploadBytes: 1000,
        overlapSec: 1,
      }),
    ).rejects.toThrow('Unable to split "/tmp/work/prepared-x2.mp3" into chunks below 1000 bytes after 6 attempts.');
  });

  it("exposes chunk-plan helpers for deterministic edge cases", () => {
    expect(() => ffmpegPrivate.buildChunkPlan(10, 1, 1)).toThrow("Chunk duration must be greater than the overlap duration.");
    expect(ffmpegPrivate.buildChunkPlan(12, 6, 1)).toEqual([
      {
        index: 0,
        startSec: 0,
        durationSec: 6,
        overlapBeforeSec: 0,
        overlapAfterSec: 1,
      },
      {
        index: 1,
        startSec: 5,
        durationSec: 6,
        overlapBeforeSec: 1,
        overlapAfterSec: 1,
      },
      {
        index: 2,
        startSec: 10,
        durationSec: 2,
        overlapBeforeSec: 1,
        overlapAfterSec: 0,
      },
    ]);
    expect(ffmpegPrivate.formatFfmpegSeconds(1.23456)).toBe("1.235");
  });
});
