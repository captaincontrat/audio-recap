## 1. Transient Storage Foundation

- [ ] 1.1 Define the shared S3-compatible transient-input storage contract for uploaded media and optional notes across AWS S3 in production and MinIO-backed local/CI environments.
- [ ] 1.2 Define the browser-direct presigned `PUT` upload contract, including bucket bootstrap plus the CORS and required-header rules for local, CI, and production app origins.
- [ ] 1.3 Define shared create/read/delete object operations that both the Next.js web runtime and worker can consume without diverging into environment-specific storage code paths.

## 2. Shared Processing Library Foundation

- [ ] 2.1 Refactor `libs/audio-recap` into importable preprocessing, transcription, merge, transcript-artifact, and recap-generation modules while keeping the CLI as a thin wrapper over the shared pipeline.
- [ ] 2.2 Add shared-library support for AI title generation and privacy-safe markdown rendering that strips local-path and transient-storage metadata.
- [ ] 2.3 Add shared timestamp-normalization helpers that rescale merged transcript segments from prepared-audio time back to original submitted-media time.

## 3. Integration Contract And Coverage

- [ ] 3.1 Define worker-facing processing interfaces that accept either original validated uploads or browser-produced MP3 derivatives without requiring separate pipeline implementations.
- [ ] 3.2 Add automated coverage for storage parity, presigned upload contract expectations, CLI-to-library parity, title/rendering helpers, and timestamp normalization behavior.
