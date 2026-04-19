## MODIFIED Requirements

### Requirement: The submission flow applies the current normalization policy before upload handoff
The submission flow SHALL use browser-side normalization before upload handoff. For audio file selections, the browser SHALL try to convert the selected audio into MP3. For video file selections, the browser SHALL try to extract the primary audio track and convert that extracted audio into MP3. If the current normalization policy is `optional`, the system SHALL still allow upload of the original validated file when local normalization is unavailable, unsupported for the selected file, or fails. If the current normalization policy is `required`, the system SHALL reject the submission before queueing when local normalization is unavailable, unsupported for the selected file, or fails. Raw video upload MUST remain supported as a fallback path only while the current policy is `optional`. The submission flow SHALL genuinely attempt browser-side MP3 conversion on browsers that support it rather than reporting normalization as unavailable without attempting it. While browser-side normalization is in progress, the client SHALL expose an explicit local normalization state distinct from the later server-side transcript-processing lifecycle, SHALL show conversion progress when the browser runtime provides it, and SHALL keep the submission UI responsive. User-initiated cancellation before upload starts MUST abort the local conversion attempt, MUST NOT upload either the original or derivative file, MUST NOT create queued transcript work, and MUST NOT be presented to the user as a failed submission.

#### Scenario: Audio normalization succeeds before upload
- **WHEN** a verified authenticated user selects a supported audio file and browser-side MP3 conversion succeeds
- **THEN** the browser hands off an MP3 processing input and the system still creates the transcript record and queued processing job

#### Scenario: Video audio extraction succeeds before upload
- **WHEN** a verified authenticated user selects a supported video file and browser-side audio extraction plus MP3 conversion succeeds
- **THEN** the browser hands off the extracted-audio MP3 and the system still creates the transcript record and queued processing job

#### Scenario: Optional mode falls back to the original file
- **WHEN** browser-side normalization is unavailable, unsupported for the selected media, or fails while the current policy is `optional`
- **THEN** the system uploads the original validated audio or video file and continues the submission flow

#### Scenario: Required mode rejects failed normalization
- **WHEN** browser-side normalization is unavailable, unsupported for the selected media, or fails while the current policy is `required`
- **THEN** the system rejects the submission before queueing and does not upload the original file as a fallback

#### Scenario: Browser-side normalization is genuinely attempted on supported browsers
- **WHEN** a verified authenticated user selects a supported audio or video file in a browser that can run browser-side MP3 normalization
- **THEN** the submission flow actually performs the conversion attempt before upload and reports `succeeded` or `failed` based on the real outcome rather than reporting `unavailable` without attempting conversion

#### Scenario: Browser-side normalization is surfaced explicitly while it runs
- **WHEN** browser-side normalization takes long enough to be user-visible during a submission
- **THEN** the submission UI shows that local normalization is in progress and surfaces conversion progress when the browser runtime provides it instead of only showing a generic preparation state

#### Scenario: User cancels browser-side normalization before upload starts
- **WHEN** a user cancels the submission while browser-side normalization is still in progress and before the upload begins
- **THEN** the system aborts the local conversion attempt, does not upload a file, does not create queued transcript work, and returns the submission surface to a non-error state

#### Scenario: Submission UI stays responsive while normalization runs
- **WHEN** browser-side normalization is in progress for a selected file during a submission
- **THEN** the dedicated submission form and the shared workspace shell upload manager remain interactive (the user can still navigate, scroll, edit notes, and cancel) while the conversion completes
