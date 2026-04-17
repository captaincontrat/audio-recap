## Why

`add-web-meeting-processing` currently mixes two different scopes: the internal storage and pipeline refactors needed to make meeting processing web-safe, and the end-to-end transcript submission/job lifecycle that later product work depends on. Keeping both in one change makes the processing change too large and forces downstream work to load low-level implementation details that are not part of the transcript resource contract.

This new change extracts the shared processing foundation so the reduced `add-web-meeting-processing` change can stay focused on transcript creation, worker orchestration, retries, and retention guarantees while depending on stable storage and pipeline interfaces.

## What Changes

- Define a single S3-compatible transient-input storage contract used across production, local development, and CI.
- Define the browser-direct presigned upload contract, including MinIO parity and the required CORS/header rules for local, CI, and production origins.
- Refactor `libs/audio-recap` into importable pipeline modules instead of treating the CLI process as the orchestration boundary.
- Add shared title-generation, privacy-safe markdown rendering, and original-media timestamp-normalization helpers for durable downstream consumers.
- Define worker-facing processing interfaces that accept either original validated media uploads or browser-produced MP3 derivatives.

## Capabilities

### New Capabilities
- `meeting-processing-foundation`: Shared transient storage, direct-upload contract, importable meeting-processing modules, privacy-safe output helpers, and timestamp normalization for web-worker consumption.

### Modified Capabilities
- None.

## Impact

- `libs/audio-recap` becomes library-first for web-worker use, with the CLI preserved as a thin wrapper over the same shared modules.
- `app/` and `app/worker` gain a shared transient-storage contract and worker-facing processing interfaces without yet defining the transcript/job lifecycle.
- The reduced `add-web-meeting-processing` change can depend on this foundation instead of carrying storage/CORS/pipeline-refactor details in the same artifact set.
