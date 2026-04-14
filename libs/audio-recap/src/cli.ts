import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { config as loadDotenv } from "dotenv";
import OpenAI from "openai";

import { DEFAULT_CHUNK_OVERLAP_SEC, prepareAudioForUpload } from "./audio/ffmpeg.js";
import { buildTranscriptArtifacts } from "./domain/transcript.js";
import { generateMeetingSummary } from "./openai/summarize.js";
import { transcribePreparedAudio } from "./openai/transcribe.js";
import { renderSummaryMarkdown, renderTranscriptMarkdown } from "./render/markdown.js";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORKSPACE_ROOT = path.resolve(PACKAGE_ROOT, "../..");

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const invocationCwd = resolveInvocationCwd();
  loadEnvironment(invocationCwd);
  const options = parseCommandLine(argv);
  const resolvedAudioPath = path.resolve(invocationCwd, options.audio);
  const resolvedNotesPath = options.notes ? path.resolve(invocationCwd, options.notes) : undefined;
  const resolvedOutDir = path.resolve(invocationCwd, options.outDir);

  await assertReadableFile(resolvedAudioPath);

  if (resolvedNotesPath) {
    await assertReadableFile(resolvedNotesPath);
  }

  await mkdir(resolvedOutDir, { recursive: true });

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY in the environment.");
  }

  const notesContent = resolvedNotesPath ? await readFile(resolvedNotesPath, "utf8") : "";
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "audio-recap-"));
  const generatedAt = new Date().toISOString();

  try {
    console.log("Preparing audio with ffmpeg...");
    const preparedAudio = await prepareAudioForUpload(resolvedAudioPath, tempDir, {
      overlapSec: DEFAULT_CHUNK_OVERLAP_SEC,
    });

    const client = new OpenAI({ apiKey });

    console.log(`Transcribing ${preparedAudio.chunks.length} chunk(s) with gpt-4o-transcribe-diarize...`);
    const transcription = await transcribePreparedAudio(client, preparedAudio, {
      language: options.language,
    });
    const transcriptArtifacts = buildTranscriptArtifacts(transcription.mergedSegments);

    const transcriptOutputPath = path.join(resolvedOutDir, "transcript.md");
    await writeFile(
      transcriptOutputPath,
      renderTranscriptMarkdown({
        audioPath: resolvedAudioPath,
        notesPath: resolvedNotesPath,
        generatedAt,
        preparedAudio,
        segments: transcriptArtifacts.segments,
      }),
      "utf8",
    );

    console.log("Generating summary with gpt-5.4 (reasoning high)...");
    const summary = await generateMeetingSummary(client, {
      audioPath: resolvedAudioPath,
      notesPath: resolvedNotesPath,
      meetingNotes: notesContent,
      transcriptBlocks: transcriptArtifacts.blocks,
      outputLanguage: options.language,
    });

    const summaryOutputPath = path.join(resolvedOutDir, "summary.md");
    await writeFile(
      summaryOutputPath,
      renderSummaryMarkdown({
        audioPath: resolvedAudioPath,
        notesPath: resolvedNotesPath,
        generatedAt,
        summary,
      }),
      "utf8",
    );

    console.log(`Transcript written to: ${transcriptOutputPath}`);
    console.log(`Summary written to: ${summaryOutputPath}`);
  } finally {
    if (!options.keepTemp) {
      await rm(tempDir, { recursive: true, force: true });
    } else {
      console.log(`Temporary files kept in: ${tempDir}`);
    }
  }
}

export function parseCommandLine(argv: string[]): {
  audio: string;
  notes?: string;
  outDir: string;
  language?: string;
  keepTemp: boolean;
} {
  const { values } = parseArgs({
    args: argv,
    options: {
      audio: {
        type: "string",
      },
      notes: {
        type: "string",
      },
      "out-dir": {
        type: "string",
      },
      language: {
        type: "string",
      },
      "keep-temp": {
        type: "boolean",
        default: false,
      },
      help: {
        type: "boolean",
        short: "h",
        default: false,
      },
    },
    allowPositionals: false,
  });

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  if (!values.audio) {
    printHelp();
    throw new Error("Missing required argument: --audio.");
  }

  return {
    audio: values.audio,
    notes: values.notes,
    outDir: values["out-dir"] ?? ".",
    language: values.language,
    keepTemp: values["keep-temp"] === true,
  };
}

export function resolveInvocationCwd(): string {
  return process.env.INIT_CWD ? path.resolve(process.env.INIT_CWD) : process.cwd();
}

export function loadEnvironment(invocationCwd: string): void {
  const envPaths = new Set([path.join(invocationCwd, ".env"), path.join(WORKSPACE_ROOT, ".env")]);

  for (const envPath of envPaths) {
    loadDotenv({
      path: envPath,
      override: false,
    });
  }
}

export async function assertReadableFile(filePath: string): Promise<void> {
  try {
    await access(filePath);
  } catch (error) {
    throw new Error(`Unable to access "${filePath}".`, {
      cause: error,
    });
  }
}

export function printHelp(): void {
  console.log(
    `
Usage:
  pnpm process:meeting --audio "/path/to/meeting.m4a" [--notes "/path/to/meeting-notes.md"] [--out-dir "./out"] [--language "fr"] [--keep-temp]

Options:
  --audio       Path to the source meeting audio file.
  --notes       Optional path to the meeting notes markdown file.
  --out-dir     Output directory for transcript.md and summary.md. Defaults to the current directory.
  --language    Optional language hint forwarded to transcription and summary generation.
  --keep-temp   Keep the intermediate ffmpeg artifacts instead of deleting them.
  -h, --help    Show this help message.
`.trim(),
  );
}

export function shouldRunCli(moduleUrl: string, argv1 = process.argv[1]): boolean {
  if (!argv1) {
    return false;
  }

  return moduleUrl === pathToFileURL(path.resolve(argv1)).href;
}

export function handleFatalError(error: unknown): void {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

export function runCliIfInvoked(moduleUrl = import.meta.url, argv: string[] = process.argv.slice(2), argv1 = process.argv[1]): void {
  if (!shouldRunCli(moduleUrl, argv1)) {
    return;
  }

  void main(argv).catch(handleFatalError);
}

runCliIfInvoked();
