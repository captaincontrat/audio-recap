import { randomBytes } from "node:crypto";

// Short opaque identifiers used by transcript, processing-job, and
// upload records. Keeping the generator here means the DB helpers and
// the API acceptance flow share the same shape without reaching into
// BullMQ or Better Auth's id generators.
const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function randomId(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    // `randomBytes(length)` always returns a Buffer of exactly `length`
    // bytes, so the `?? 0` fallback only exists to satisfy noUncheckedIndexedAccess
    // and is unreachable at runtime.
    /* v8 ignore next */
    const byte = bytes[i] ?? 0;
    out += ALPHABET[byte % ALPHABET.length];
  }
  return out;
}

export function generateTranscriptId(): string {
  return `trx_${randomId(22)}`;
}

export function generateProcessingJobId(): string {
  return `job_${randomId(22)}`;
}

export function generateUploadId(): string {
  return `up_${randomId(24)}`;
}
