# meeting-processing-foundation Specification

## Purpose

Defines the shared processing platform that downstream transcript lifecycle and product-workflow capabilities (meeting submission, transcript management, sharing, export) build on top of. This capability owns the S3-compatible transient-input storage contract used in production and local/CI environments, the browser-direct presigned `PUT` upload contract and the bucket configuration (CORS, origins, headers) that makes it safe across those environments, the importable shared library boundary derived from `libs/audio-recap` that exposes preprocessing, chunk planning, diarized transcription, overlap-aware segment merge, transcript artifact construction, and recap generation without requiring the worker to shell out to the CLI, the web-safe pipeline output helpers (AI title generation, privacy-safe markdown rendering, timestamp normalization back to original submitted-media time), and the worker-facing processing interfaces that accept both original validated uploads and browser-produced MP3 derivatives through a single pipeline contract. Durable transcript persistence, submission UX, retry semantics, retention, management, sharing, and export remain out of scope and belong to downstream product-facing changes that consume this foundation.

## Requirements

### Requirement: Transient input storage is S3-compatible across environments
The system SHALL use one internal S3-compatible transient-input storage contract for uploaded media and optional notes across production, local development, and CI. Production SHALL use private AWS S3, while local development and CI SHALL use MinIO or another ephemeral S3-compatible service without requiring a separate filesystem-only code path.

#### Scenario: Local and production use the same storage contract
- **WHEN** the web app or worker interacts with transient meeting inputs in either production or local/CI environments
- **THEN** it uses the same object-storage abstraction for create, read, and delete operations

### Requirement: Browser-direct transient uploads use presigned `PUT` requests
The system SHALL support browser-direct transient uploads through short-lived presigned `PUT` requests instead of proxying large media files through the web app. The transient bucket configuration MUST allow the required request method, origins, and headers needed by the presigned upload flow across local development, CI browser tests, and production web origins.

#### Scenario: Browser uploads through a presigned request
- **WHEN** the browser receives valid presigned upload details for a transient input
- **THEN** it can upload that object directly to the configured S3-compatible service using the documented method and required headers

### Requirement: Meeting processing is available as importable shared library code
The web processing system SHALL expose preprocessing, chunk planning, diarized transcription, overlap-aware segment merge, transcript artifact construction, and recap generation as importable shared library code derived from `libs/audio-recap`. The normal worker path MUST NOT depend on invoking the CLI as a subprocess, and the CLI SHALL remain available as a thin wrapper over the same shared modules.

#### Scenario: Worker starts processing without shelling out to the CLI
- **WHEN** a worker begins processing a meeting input
- **THEN** it imports and runs the shared library modules rather than spawning the CLI entrypoint as an external process

#### Scenario: CLI continues to use the shared processing modules
- **WHEN** the CLI runs a meeting-processing flow
- **THEN** it delegates to the same shared pipeline modules rather than maintaining a separate implementation path

### Requirement: Shared pipeline outputs are web-safe and normalized for durable consumers
The shared processing foundation SHALL provide helper functions that generate an AI title, render privacy-safe markdown that omits local-path and transient-storage metadata, and normalize transcript timestamps back to original submitted-media time before downstream changes persist durable transcript content.

#### Scenario: Successful shared pipeline output is safe for durable persistence
- **WHEN** the shared pipeline finishes transcript construction for a successful submission
- **THEN** it can provide a title, privacy-safe markdown, and timestamps aligned to the original submitted-media timeline

### Requirement: Worker-facing processing interfaces support original uploads and browser-produced MP3 derivatives
The shared processing contract SHALL accept either original validated meeting-media uploads or browser-produced MP3 derivatives created during client-side normalization. Downstream changes MAY apply different intake policies, but they MUST NOT require separate processing implementations for the two input shapes.

#### Scenario: Original upload and normalized derivative use the same processing contract
- **WHEN** downstream processing provides either an original validated upload or a browser-produced MP3 derivative
- **THEN** the worker-facing shared interfaces can process both inputs through the same pipeline contract
