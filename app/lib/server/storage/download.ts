import "server-only";

import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";

import { getTransientObjectStream } from "@/lib/server/storage/transient-store";

// Stream a transient object straight to a local file path. Workers run
// the `audio-recap` pipeline against on-disk files (ffmpeg reads from
// disk, not Node streams), so the coordinator materializes each
// transient input to the worker's private tempdir before dispatching
// the pipeline. We use `node:stream/promises` pipeline to ensure the
// download resolves only after the file is fully written and to
// surface backpressure / destination errors.
export async function downloadTransientObjectToFile(key: string, destinationPath: string): Promise<void> {
  const result = await getTransientObjectStream(key);
  await pipeline(result.body, createWriteStream(destinationPath));
}
