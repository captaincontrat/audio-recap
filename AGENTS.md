# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Audio Recap is a CLI tool that processes meeting audio files through a pipeline: audio preprocessing (ffmpeg), chunked transcription (OpenAI `gpt-4o-transcribe-diarize`), and summarization (OpenAI `gpt-5.4`). See `README.md` for full documentation.

### Required environment

- **Node.js 20+**, **pnpm**, **ffmpeg**, and **ffprobe** must be available on `$PATH`.
- An `OPENAI_API_KEY` must be set in a `.env` file at the project root (see `.env.example`).

### Key commands

| Task | Command |
|---|---|
| Install deps | `pnpm install` |
| Type-check | `pnpm typecheck` |
| Run pipeline | `pnpm process:meeting --audio <file> --out-dir <dir>` |

### Caveats

- There is **no test suite** (no unit/integration tests). The only automated check is `pnpm typecheck` (`tsc --noEmit`).
- End-to-end validation requires a real audio file with speech and a valid `OPENAI_API_KEY`.
- The `esbuild` build script is intentionally blocked by pnpm's build policy. Do **not** run `pnpm approve-builds`; this warning is expected and harmless.
- The `.env` file is gitignored and must be created manually from `.env.example` on fresh setups.
