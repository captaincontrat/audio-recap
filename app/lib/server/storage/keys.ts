export type TransientInputKind = "media" | "notes" | "mp3-derivative";

export interface TransientInputKeyInput {
  uploadId: string;
  kind: TransientInputKind;
  filename?: string;
}

const TRANSIENT_INPUT_PREFIX = "transient-inputs";
const KIND_SEGMENT: Record<TransientInputKind, string> = {
  media: "media",
  notes: "notes",
  "mp3-derivative": "mp3-derivative",
};

export function sanitizeUploadId(uploadId: string): string {
  const trimmed = uploadId.trim();

  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(trimmed)) {
    throw new Error(`Invalid uploadId "${uploadId}". Expected alphanumeric, dash, or underscore segments.`);
  }

  return trimmed;
}

export function sanitizeFilenameSegment(filename: string | undefined): string | undefined {
  if (!filename) {
    return undefined;
  }

  const trimmed = filename.trim();

  if (trimmed.length === 0) {
    return undefined;
  }

  const sanitized = trimmed
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (sanitized.length === 0) {
    return undefined;
  }

  return sanitized.slice(0, 96);
}

export function buildTransientInputKey(input: TransientInputKeyInput): string {
  const safeUploadId = sanitizeUploadId(input.uploadId);
  const safeFilename = sanitizeFilenameSegment(input.filename);
  const kindSegment = KIND_SEGMENT[input.kind];
  const filenameSegment = safeFilename ?? defaultFilenameFor(input.kind);

  return `${TRANSIENT_INPUT_PREFIX}/${safeUploadId}/${kindSegment}/${filenameSegment}`;
}

function defaultFilenameFor(kind: TransientInputKind): string {
  switch (kind) {
    case "media":
      return "source";
    case "notes":
      return "notes.md";
    case "mp3-derivative":
      return "derivative.mp3";
    default: {
      const exhaustive: never = kind;
      throw new Error(`Unhandled transient input kind: ${String(exhaustive)}`);
    }
  }
}
