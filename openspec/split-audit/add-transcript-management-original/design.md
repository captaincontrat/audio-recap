## Context

The earlier changes established three foundations:

- `bootstrap-meeting-recap-web-platform` defined the authenticated browser/API/worker topology, Postgres as the durable source of truth, Redis for async coordination, and owner-scoped account rules.
- `add-web-meeting-processing` defined transcript creation from uploaded media, canonical markdown persistence, privacy-safe retained metadata, and the transcript record as the long-lived resource.
- The repository still has only a placeholder `app/` UI, so transcript management now needs to define the first persistent post-processing product surfaces: a library of transcript records and a detail page for one record.

This change builds on the durable transcript record from the processing change. It does not redefine processing, retention, sharing, or export. Instead, it defines how users browse and manage the records they already own.

## Goals / Non-Goals

**Goals:**

- Define the authenticated transcript library and transcript detail page.
- Define ownership and authorization rules for listing, reading, updating, and deleting transcript records.
- Keep the backend-to-frontend contract markdown-first for transcript and recap content.
- Define the right-sized management actions: rename, edit markdown, tags, important toggle, and delete with confirmation.
- Define server-side search, sort, and filter behavior, including explicit organization sorting for important state and tags, with cursor-based pagination and an explicit "Load more" interaction.
- Define empty, loading, no-results, not-found, and error states for the library and detail surfaces.

**Non-Goals:**

- Public sharing URLs and share management.
- Export formats or frontend conversion from markdown.
- Changes to transcript generation, privacy retention, or background processing behavior beyond what transcript management needs to read and update durable records.
- Rich text or WYSIWYG storage formats.
- Collaborative editing, comments, version history, or audit timelines.

## Decisions

### Decision: Build two primary surfaces - library and detail

The product surface for this change is:

- a library page for browsing many transcript records
- a detail page for viewing and managing one owned record

The library returns summary data only:

- transcript identifier
- display title
- processing status
- important flag
- tags
- created and updated timestamps
- optional short recap preview derived from canonical markdown

The detail page returns the full owned transcript record, including canonical `transcriptMarkdown` and `recapMarkdown`.

**Why this over alternatives**

- Over loading full markdown for every library item: that would make the list heavier, slower, and harder to paginate.
- Over merging everything into one page: the library and detail views have different query and UX needs.

### Decision: Keep the contract markdown-first end to end

The backend remains the source of truth for canonical transcript content in markdown. The detail read surface returns markdown strings; the edit surface accepts markdown strings; the frontend renders markdown for reading and uses markdown-aware edit controls for authoring.

The system will not switch to HTML as the persisted contract for transcript or recap content.

This means:

- `transcriptMarkdown` and `recapMarkdown` stay canonical in Postgres
- the frontend renders markdown into readable UI
- editing uses markdown text inputs with preview or rendered read mode, not HTML storage

**Why this over alternatives**

- Over persisting HTML: it would fight the export-first roadmap, add sanitization/storage complexity, and break the repo's established markdown-centric data model.
- Over hiding raw markdown behind a rich editor abstraction: that is possible later, but the source of truth should still stay markdown.

### Decision: Separate generated and user-managed titles

The processing change requires a durable AI-generated title, while transcript management adds rename. To avoid races and preserve both intents, the transcript record will support:

- `generatedTitle`: written by the processing pipeline
- `customTitle`: nullable user override written by management surfaces

The user-facing display title is computed as `customTitle ?? generatedTitle`.

This lets users rename any transcript record without losing the generated title and without requiring the worker to know whether a user has already overridden the title.

**Why this over alternatives**

- Over mutating the generated title in place: that loses the system-generated baseline and creates worker/user overwrite races.
- Over forbidding rename until after completion: it adds avoidable product friction and complicates consistent library behavior.

### Decision: Use one transcript patch surface for non-destructive updates

The management API will use:

- one list read surface
- one detail read surface
- one patch surface for rename, markdown edits, tags, and important toggle
- one delete surface for destructive removal

The patch surface accepts only owner-authorized fields:

- `customTitle`
- `transcriptMarkdown`
- `recapMarkdown`
- `tags`
- `isImportant`

Validation rules:

- `transcriptMarkdown` and `recapMarkdown` are editable only when the transcript is in `completed` status
- `customTitle`, `tags`, and `isImportant` are editable for any owned record
- tags are normalized, deduplicated, and limited in count/length

**Why this over alternatives**

- Over separate endpoints for every small toggle: one patch surface keeps the API simpler without weakening ownership controls.
- Over allowing markdown edits on non-completed records: those records may not yet have stable canonical content.

### Decision: Tags are a normalized per-transcript string list

Tags are a lightweight organizational feature, not a first-class collaborative taxonomy. The durable transcript record will store tags as a normalized set of strings:

- case-insensitive uniqueness
- trimmed values
- normalized casing for storage and filtering
- bounded maximum count and per-tag length

This keeps the first implementation right-sized while still supporting filtering and search.

**Why this over alternatives**

- Over a separate global tag table: that is heavier than necessary for a single-user transcript library.
- Over unbounded free-form tags: normalization and limits prevent noisy duplicates and poor filter UX.

### Decision: Search, sort, and filters are server-side

The transcript library must remain correct under pagination and ownership enforcement, so search, sort, and filtering will happen on the server. The library query supports:

- full-text query across display title, transcript content, recap content, and tags
- sort options for newest first, oldest first, recently updated, title A-Z, title Z-A, important-first, important-last, tag-list A-Z, and tag-list Z-A
- filters for status, important state, and selected tags

For tag-based sorting, each transcript record uses a deterministic normalized tag sort key derived from its sorted normalized tag list. Records without tags sort after tagged records for ascending tag-list order and before tagged records for descending tag-list order.

To keep the persisted content markdown-first without making search quality poor, the backend may derive an internal search document from stripped markdown text. That internal search representation is not a user-facing content contract.

**Why this over alternatives**

- Over client-side filtering of all records: it would not scale and would undermine owner-scoped pagination.
- Over searching raw markdown only: markdown syntax noise would reduce search quality.

### Decision: Use cursor-based pagination with explicit "Load more"

The library will use cursor-based pagination with a default page size of 20 transcript records and an explicit "Load more" control.

Rules:

- the server returns `nextCursor` when more results exist
- changing search, sort, or filters resets pagination
- the cursor encodes the active sort boundary so pagination remains stable
- the UI appends the next page when the user chooses "Load more"

This change explicitly does not use infinite scroll.

**Why this over alternatives**

- Over numbered pages: cursor pagination is more stable as records change and better fits timeline-style transcript libraries.
- Over infinite scroll: explicit load more is simpler, more accessible, and easier to combine with loading/error states.

### Decision: Enforce ownership by scoping every query to the current user and hiding non-owned records

Every transcript-management read or write operation will be scoped by `ownerUserId`. A user can only list, load, patch, or delete transcript records they own. Direct access to another user's transcript identifier returns the same not-found behavior as a missing transcript so the system does not reveal record existence across accounts.

This ownership model applies only to authenticated private transcript records. Future public share routes are out of scope for this change.

**Why this over alternatives**

- Over returning explicit forbidden errors for known foreign records: hiding existence is a safer default for private resources.

### Decision: Define explicit UI states for library and detail

The UI must distinguish between:

- initial loading
- library empty state (user has no transcripts)
- no-results state (filters/search produced no matches)
- fetch error with retry
- detail not found/unavailable
- detail loading

This prevents the common mistake of collapsing "nothing here" and "we failed to load" into one ambiguous blank page.

**Why this over alternatives**

- Over generic placeholders everywhere: transcript management is a primary product surface, so state clarity matters.

## Risks / Trade-offs

- [Full-text search over transcript content can become expensive] -> Use server-side search indexes derived from markdown content and keep list responses summary-only.
- [Cursor pagination gets trickier with multiple sort modes] -> Encode sort-specific boundaries in the cursor and reset cursors whenever query controls change.
- [Allowing rename before processing completes introduces title coordination complexity] -> Store generated and custom titles separately and compute display title from both.
- [Markdown editing can feel technical for some users] -> Keep the persistence contract markdown-first now and allow richer editing affordances later without changing storage.
- [Hiding foreign records as not-found can make internal debugging harder] -> Keep structured server logs for authorization failures without exposing record existence to users.

## Migration Plan

1. Extend the transcript persistence model to support custom titles, tags, important flag, and search-friendly indexing.
2. Add server-side transcript list, detail, patch, and delete surfaces with owner scoping and cursor pagination.
3. Build the transcript library UI with search, sort, filters, load-more pagination, and explicit empty/loading/error states.
4. Build the transcript detail UI with markdown rendering, rename, markdown editing, tag editing, important toggle, and delete confirmation.
5. Add authorization and regression coverage for owner-only access, management actions, and list-query behavior.

Rollback strategy:

- keep transcript creation and processing intact even if management surfaces are disabled
- disable new library/detail routes if needed without affecting auth or processing
- preserve the new transcript metadata fields in Postgres even if management UI is temporarily withdrawn

## Open Questions

None are blocking for this change. Public sharing and export flows will build on the management surfaces and markdown contract defined here.
