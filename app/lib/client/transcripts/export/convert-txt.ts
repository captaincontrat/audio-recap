import type { Root } from "mdast";
import { toString as toStringUtil } from "mdast-util-to-string";

import { mimeTypeFor } from "./formats";

// Plain-text conversion owned by `add-client-side-transcript-export`.
// The design routes `txt` through `mdast-util-to-string` against the
// shared `mdast` tree so the output is a structured text rendering of
// the same assembled document every other format derives from. The
// serialized result is wrapped in a `Blob` with the shared
// `text/plain;charset=utf-8` MIME type so the panel can hand it to
// the browser download flow with the rest of the formats. Failures
// from the serializer surface to the orchestrator so the shared
// `ExportConversionError` wrapping stays in one place.

export function convertToPlainTextBlob(tree: Root): Blob {
  const plainText = toStringUtil(tree);
  return new Blob([plainText], { type: mimeTypeFor("txt") });
}
