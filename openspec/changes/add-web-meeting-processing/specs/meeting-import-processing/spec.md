## ADDED Requirements

### Requirement: Verified authenticated users can submit one meeting media file with optional notes
The system SHALL allow a verified authenticated user to submit exactly one audio or video file for processing. The submission flow SHALL also allow optional meeting notes captured at submission time as plain text or markdown text. The system MUST reject unauthenticated or unverified requests, MUST reject submissions whose media cannot be validated as supported audio/video input, and MUST reject submissions that exceed configured upload limits before enqueueing background work.

#### Scenario: Successful submission with optional notes
- **WHEN** a verified authenticated user submits one valid audio or video file with notes text
- **THEN** the system creates a transcript record, stores the media and notes as transient processing inputs, creates a queued processing job, and returns the transcript identifier and initial processing status

#### Scenario: Successful submission without notes
- **WHEN** a verified authenticated user submits one valid audio or video file without notes text
- **THEN** the system creates a transcript record and queued processing job without requiring notes

#### Scenario: Submission is rejected before queueing
- **WHEN** a user submits an unreadable, unsupported, or oversized media file
- **THEN** the system rejects the request without creating queued background work

### Requirement: Meeting processing runs asynchronously with visible status stages
The system SHALL process accepted submissions asynchronously rather than inside the upload request. Each transcript record SHALL expose a user-visible processing status that reflects the current lifecycle stage. The status model MUST support `queued`, `preprocessing`, `transcribing`, `generating_recap`, `generating_title`, `finalizing`, `retrying`, `completed`, and `failed`.

#### Scenario: User checks an in-progress transcript
- **WHEN** a user requests the status of a transcript whose job is still running
- **THEN** the system returns the transcript record with its current processing status and without completed markdown fields

#### Scenario: Processing reaches completion
- **WHEN** the worker finishes transcript generation, recap generation, title generation, persistence, and cleanup
- **THEN** the transcript record moves to `completed` status

#### Scenario: Processing reaches terminal failure
- **WHEN** the worker exhausts processing for a submission without a successful completion
- **THEN** the transcript record moves to `failed` status with a generic failure summary suitable for user display

### Requirement: The worker uses shared meeting-processing library code
The web processing system SHALL execute preprocessing, chunking, diarized transcription, overlap-aware transcript merge, transcript artifact construction, recap generation, and title generation through importable shared library code derived from `libs/audio-recap`. The normal processing path MUST NOT depend on spawning the CLI process as a subprocess.

#### Scenario: Worker begins a processing job
- **WHEN** the worker starts handling an accepted submission
- **THEN** it runs the meeting-processing stages through shared library code rather than by invoking the CLI entrypoint as an external process

### Requirement: Successful processing produces transcript markdown, recap markdown, and an AI-generated title
For a successful submission, the system SHALL generate a transcript, a meeting recap, and an AI-generated title for the transcript record. The recap generation SHALL use submitted notes when notes were provided and SHALL fall back to transcript-only generation when notes were not provided. The completed transcript record MUST include non-empty canonical markdown fields for both transcript and recap and a non-empty title.

#### Scenario: Successful processing with notes
- **WHEN** a submission with notes reaches successful completion
- **THEN** the completed transcript record contains transcript markdown, recap markdown informed by the provided notes and transcript, and an AI-generated title

#### Scenario: Successful processing without notes
- **WHEN** a submission without notes reaches successful completion
- **THEN** the completed transcript record contains transcript markdown, recap markdown derived from the transcript alone, and an AI-generated title

### Requirement: Transcript timestamps are normalized to original media time
The system SHALL normalize generated transcript timestamps back to the original submitted media timeline before building canonical transcript markdown. The stored transcript MUST NOT expose the accelerated preprocessing timeline used internally by the worker.

#### Scenario: Completed transcript is viewed after x2 preprocessing
- **WHEN** a user reads a completed transcript that was processed through accelerated preprocessing
- **THEN** the timestamps shown in the transcript correspond to the original submitted media time rather than the prepared-audio time

### Requirement: Retryable failures are retried automatically and non-retryable failures fail fast
The system SHALL automatically retry retryable infrastructure or provider failures up to a bounded maximum of three total attempts for the same transcript record. Non-retryable validation failures MUST NOT be retried. During automatic retry, the transcript status SHALL enter `retrying`, and after the retry budget is exhausted the transcript SHALL move to `failed`.

#### Scenario: Retryable transcription failure
- **WHEN** a processing attempt fails because of a retryable provider or infrastructure error
- **THEN** the system records retrying status, schedules another attempt for the same transcript record, and does not create a duplicate transcript record

#### Scenario: Retry budget is exhausted
- **WHEN** retryable processing continues to fail until the final allowed attempt is exhausted
- **THEN** the system marks the transcript record as `failed` with a generic failure summary

#### Scenario: Validation failure is non-retryable
- **WHEN** processing fails because the submission cannot be validated as usable meeting media
- **THEN** the system fails the transcript without automatic retry
