import path from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cliMocks = vi.hoisted(() => ({
  access: vi.fn(),
  mkdir: vi.fn(),
  mkdtemp: vi.fn(),
  readFile: vi.fn(),
  rm: vi.fn(),
  writeFile: vi.fn(),
  loadDotenv: vi.fn(),
  openAIConstructor: vi.fn(),
  prepareAudioForUpload: vi.fn(),
  buildTranscriptArtifacts: vi.fn(),
  generateMeetingSummary: vi.fn(),
  transcribePreparedAudio: vi.fn(),
  renderSummaryMarkdown: vi.fn(),
  renderTranscriptMarkdown: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  access: cliMocks.access,
  mkdir: cliMocks.mkdir,
  mkdtemp: cliMocks.mkdtemp,
  readFile: cliMocks.readFile,
  rm: cliMocks.rm,
  writeFile: cliMocks.writeFile,
}));

vi.mock("dotenv", () => ({
  config: cliMocks.loadDotenv,
}));

vi.mock("openai", () => ({
  default: vi.fn(function MockOpenAI(options: unknown) {
    cliMocks.openAIConstructor(options);
    return {
      responses: {
        create: vi.fn(),
      },
      audio: {
        transcriptions: {
          create: vi.fn(),
        },
      },
    };
  }),
}));

vi.mock("../src/audio/ffmpeg.js", () => ({
  DEFAULT_CHUNK_OVERLAP_SEC: 1,
  prepareAudioForUpload: cliMocks.prepareAudioForUpload,
}));

vi.mock("../src/domain/transcript.js", () => ({
  buildTranscriptArtifacts: cliMocks.buildTranscriptArtifacts,
}));

vi.mock("../src/openai/summarize.js", () => ({
  generateMeetingSummary: cliMocks.generateMeetingSummary,
}));

vi.mock("../src/openai/transcribe.js", () => ({
  transcribePreparedAudio: cliMocks.transcribePreparedAudio,
}));

vi.mock("../src/render/markdown.js", () => ({
  renderSummaryMarkdown: cliMocks.renderSummaryMarkdown,
  renderTranscriptMarkdown: cliMocks.renderTranscriptMarkdown,
}));

const workspaceRoot = "/Users/mickael/Documents/github/audio-recap";
const originalArgv = [...process.argv];
const originalInitCwd = process.env.INIT_CWD;
const originalOpenAiKey = process.env.OPENAI_API_KEY;
const originalExitCode = process.exitCode;

async function importCliModule() {
  vi.resetModules();
  process.argv[1] = "/vitest";
  return import("../src/cli.js");
}

describe("cli entrypoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.argv = [...originalArgv];
    process.argv[1] = "/vitest";

    process.exitCode = originalExitCode;

    if (originalInitCwd === undefined) {
      delete process.env.INIT_CWD;
    } else {
      process.env.INIT_CWD = originalInitCwd;
    }

    if (originalOpenAiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalOpenAiKey;
    }

    cliMocks.access.mockResolvedValue(undefined);
    cliMocks.mkdir.mockResolvedValue(undefined);
    cliMocks.mkdtemp.mockResolvedValue("/tmp/audio-recap-temp");
    cliMocks.readFile.mockResolvedValue("notes content");
    cliMocks.rm.mockResolvedValue(undefined);
    cliMocks.writeFile.mockResolvedValue(undefined);
    cliMocks.loadDotenv.mockReturnValue({ parsed: {} });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses command-line options, handles help, and enforces the required audio flag", async () => {
    const cli = await importCliModule();
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: string | number | null) => {
      throw new Error(`exit:${code ?? ""}`);
    }) as never);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    expect(() => cli.parseCommandLine(["--help"])).toThrow("exit:0");
    expect(() => cli.parseCommandLine([])).toThrow("Missing required argument: --audio.");
    expect(cli.parseCommandLine(["--audio", "meeting.m4a", "--notes", "notes.md", "--out-dir", "out", "--language", "fr", "--keep-temp"])).toEqual({
      audio: "meeting.m4a",
      notes: "notes.md",
      outDir: "out",
      language: "fr",
      keepTemp: true,
    });

    expect(exitSpy).toHaveBeenCalledWith(0);
    expect(logSpy).toHaveBeenCalled();
  });

  it("resolves the invocation cwd and loads unique env files", async () => {
    const cli = await importCliModule();

    process.env.INIT_CWD = "/tmp/invocation";
    expect(cli.resolveInvocationCwd()).toBe("/tmp/invocation");

    delete process.env.INIT_CWD;
    expect(cli.resolveInvocationCwd()).toBe(process.cwd());

    cli.loadEnvironment("/tmp/invocation");
    expect(cliMocks.loadDotenv).toHaveBeenCalledWith({
      path: "/tmp/invocation/.env",
      override: false,
    });
    expect(cliMocks.loadDotenv).toHaveBeenCalledWith({
      path: path.join(workspaceRoot, ".env"),
      override: false,
    });

    cliMocks.loadDotenv.mockClear();
    cli.loadEnvironment(workspaceRoot);
    expect(cliMocks.loadDotenv).toHaveBeenCalledTimes(1);
  });

  it("checks readable files, prints help, matches direct execution, and reports fatal errors", async () => {
    const cli = await importCliModule();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(cli.assertReadableFile("/tmp/file.txt")).resolves.toBeUndefined();

    cliMocks.access.mockRejectedValueOnce(new Error("missing"));
    await expect(cli.assertReadableFile("/tmp/missing.txt")).rejects.toThrow('Unable to access "/tmp/missing.txt".');

    cli.printHelp();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Usage:"));

    expect(cli.shouldRunCli(pathToFileURL("/tmp/cli.ts").href, "")).toBe(false);
    expect(cli.shouldRunCli(pathToFileURL("/tmp/cli.ts").href)).toBe(false);
    expect(cli.shouldRunCli(pathToFileURL("/tmp/cli.ts").href, "/tmp/cli.ts")).toBe(true);
    expect(cli.shouldRunCli(pathToFileURL("/tmp/cli.ts").href, "/tmp/other.ts")).toBe(false);

    process.exitCode = undefined;
    cli.handleFatalError("boom");
    expect(errorSpy).toHaveBeenCalledWith("boom");
    expect(process.exitCode).toBe(1);
  });

  it("processes a meeting with notes and keeps temporary files when requested", async () => {
    const cli = await importCliModule();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    process.env.INIT_CWD = "/tmp/invocation";
    process.env.OPENAI_API_KEY = "sk-test";

    const preparedAudio = {
      sourcePath: "/tmp/invocation/meeting.m4a",
      preparedPath: "/tmp/audio-recap-temp/prepared-x2.mp3",
      durationSec: 60,
      sizeBytes: 2048,
      formatName: "mp3",
      speedMultiplier: 2,
      overlapSec: 1,
      chunks: [
        {
          index: 0,
          path: "/tmp/audio-recap-temp/chunk-001.mp3",
          startSec: 0,
          durationSec: 60,
          sizeBytes: 2048,
          overlapBeforeSec: 0,
          overlapAfterSec: 0,
        },
      ],
    };

    cliMocks.prepareAudioForUpload.mockResolvedValue(preparedAudio);
    cliMocks.transcribePreparedAudio.mockResolvedValue({
      chunkTranscripts: [],
      mergedSegments: [{ id: "seg-00001" }],
    });
    cliMocks.buildTranscriptArtifacts.mockReturnValue({
      segments: [{ id: "seg-00001" }],
      blocks: [{ id: "block-0001" }],
      speakers: ["Alice"],
      fullText: "full text",
    });
    cliMocks.renderTranscriptMarkdown.mockReturnValue("transcript markdown");
    cliMocks.generateMeetingSummary.mockResolvedValue("# Summary");
    cliMocks.renderSummaryMarkdown.mockReturnValue("summary markdown");

    await cli.main(["--audio", "meeting.m4a", "--notes", "notes.md", "--out-dir", "out", "--language", "fr", "--keep-temp"]);

    expect(cliMocks.access).toHaveBeenCalledWith("/tmp/invocation/meeting.m4a");
    expect(cliMocks.access).toHaveBeenCalledWith("/tmp/invocation/notes.md");
    expect(cliMocks.prepareAudioForUpload).toHaveBeenCalledWith("/tmp/invocation/meeting.m4a", "/tmp/audio-recap-temp", {
      overlapSec: 1,
    });
    expect(cliMocks.generateMeetingSummary).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        meetingNotes: "notes content",
        notesPath: "/tmp/invocation/notes.md",
        outputLanguage: "fr",
      }),
    );
    expect(cliMocks.writeFile).toHaveBeenCalledWith("/tmp/invocation/out/transcript.md", "transcript markdown", "utf8");
    expect(cliMocks.writeFile).toHaveBeenCalledWith("/tmp/invocation/out/summary.md", "summary markdown", "utf8");
    expect(cliMocks.rm).not.toHaveBeenCalled();
    expect(cliMocks.openAIConstructor).toHaveBeenCalledWith({ apiKey: "sk-test" });
    expect(logSpy).toHaveBeenCalledWith("Temporary files kept in: /tmp/audio-recap-temp");
  });

  it("processes a meeting without notes and cleans temporary files by default", async () => {
    const cli = await importCliModule();

    process.env.INIT_CWD = "/tmp/invocation";
    process.env.OPENAI_API_KEY = "sk-test";

    const preparedAudio = {
      sourcePath: "/tmp/invocation/meeting.m4a",
      preparedPath: "/tmp/audio-recap-temp/prepared-x2.mp3",
      durationSec: 60,
      sizeBytes: 2048,
      formatName: "mp3",
      speedMultiplier: 2,
      overlapSec: 1,
      chunks: [],
    };

    cliMocks.prepareAudioForUpload.mockResolvedValue(preparedAudio);
    cliMocks.transcribePreparedAudio.mockResolvedValue({
      chunkTranscripts: [],
      mergedSegments: [],
    });
    cliMocks.buildTranscriptArtifacts.mockReturnValue({
      segments: [],
      blocks: [{ id: "block-0001" }],
      speakers: [],
      fullText: "",
    });
    cliMocks.renderTranscriptMarkdown.mockReturnValue("transcript markdown");
    cliMocks.generateMeetingSummary.mockResolvedValue("# Summary");
    cliMocks.renderSummaryMarkdown.mockReturnValue("summary markdown");

    await cli.main(["--audio", "meeting.m4a"]);

    expect(cliMocks.readFile).not.toHaveBeenCalled();
    expect(cliMocks.generateMeetingSummary).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        meetingNotes: "",
        notesPath: undefined,
        outputLanguage: undefined,
      }),
    );
    expect(cliMocks.rm).toHaveBeenCalledWith("/tmp/audio-recap-temp", {
      recursive: true,
      force: true,
    });
  });

  it("rejects execution when OPENAI_API_KEY is missing", async () => {
    const cli = await importCliModule();

    process.env.INIT_CWD = "/tmp/invocation";
    delete process.env.OPENAI_API_KEY;

    await expect(cli.main(["--audio", "meeting.m4a"])).rejects.toThrow("Missing OPENAI_API_KEY in the environment.");
  });

  it("runs the entrypoint when invoked directly and routes failures through fatal handling", async () => {
    const cli = await importCliModule();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    process.env.INIT_CWD = "/tmp/invocation";
    delete process.env.OPENAI_API_KEY;
    process.exitCode = undefined;

    cli.runCliIfInvoked(pathToFileURL("/tmp/cli.ts").href, ["--audio", "meeting.m4a"], "/tmp/cli.ts");

    await new Promise((resolve) => {
      setImmediate(resolve);
    });

    expect(errorSpy).toHaveBeenCalledWith("Missing OPENAI_API_KEY in the environment.");
    expect(process.exitCode).toBe(1);
  });
});
