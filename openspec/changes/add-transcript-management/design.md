## Context

The earlier changes established three foundations:

- `bootstrap-meeting-recap-web-platform` defined the authenticated browser/API/worker topology, Postgres as the durable source of truth, Redis for async coordination, and owner-scoped account rules.
- `add-web-meeting-processing` defined transcript creation from uploaded media, canonical markdown persistence, privacy-safe retained metadata, and the transcript record as the long-lived resource.
- The repository still has only a placeholder `app/` UI, so transcript management now needs to define the first private post-processing product surfaces: a library of transcript records and a detail page for one owned record.

This reduced change builds on the durable transcript record from processing. It does not redefine write-side transcript curation, public sharing, or export. Instead, it defines the minimum private library and detail foundation that later follow-up changes can build on.

## Goals / Non-Goals

**Goals:**

- Define the authenticated private transcript library and transcript detail page.
- Define ownership and authorization rules for listing and reading transcript records.
- Keep the backend-to-frontend contract markdown-first for transcript and recap content.
- Define server-side search, baseline sort, status filtering, cursor pagination, and explicit "Load more" behavior for the private library.
- Define empty, loading, no-results, not-found, and recoverable error states for the library and detail surfaces.

**Non-Goals:**

- Custom title overrides or generated-vs-custom title rules.
- Tag management, important markers, or metadata-heavy organization controls.
- Transcript or recap markdown editing.
- Delete confirmation or destructive transcript removal.
- Public sharing URLs and share management.
- Export formats or frontend conversion from markdown.
- Changes to transcript generation, privacy retention, or background processing behavior beyond what read-only transcript browsing needs.
- Rich text or WYSIWYG storage formats.

## Decisions

### Decision: Build two primary read-first surfaces - library and detail

The product surface for this change is:

- a library page for browsing many transcript records
- a detail page for viewing one owned record

The library returns summary data only:

- transcript identifier
- durable title from processing
- processing status
- created and updated timestamps
- optional short recap preview derived from canonical markdown

The detail page returns the full owned transcript record, including canonical `transcriptMarkdown` and `recapMarkdown` when they exist.

**Why this over alternatives**

- Over loading full markdown for every library item: that would make the list heavier, slower, and harder to paginate.
- Over merging everything into one page: the library and detail views have different query and UX needs.

### Decision: Keep the read contract markdown-first end to end

The backend remains the source of truth for canonical transcript content in markdown. The detail read surface returns markdown strings and the frontend renders markdown for reading.

The system will not switch to HTML as the persisted contract for transcript or recap content.

This means:

- `transcriptMarkdown` and `recapMarkdown` stay canonical in Postgres
- the frontend renders markdown into readable UI
- this change does not introduce edit inputs or write-side content mutation

**Why this over alternatives**

- Over persisting HTML: it would fight the export-first roadmap, add sanitization/storage complexity, and break the repo's established markdown-centric data model.
- Over blocking transcript viewing until a richer editor exists: users need read access before curation tooling is added.

### Decision: Search, sort, and filtering are server-side but scoped to read-first controls

The transcript library must remain correct under pagination and ownership enforcement, so search, sort, and filtering will happen on the server. The library query supports:

- full-text query across title, transcript content, and recap content
- sort options for newest first, oldest first, recently updated, title A-Z, and title Z-A
- filtering by processing status

To keep the persisted content markdown-first without making search quality poor, the backend may derive an internal search document from stripped markdown text. That internal search representation is not a user-facing content contract.

This reduced change intentionally does not include tag-based or important-state organization controls. Those move to a follow-up curation change.

**Why this over alternatives**

- Over client-side filtering of all records: it would not scale and would undermine owner-scoped pagination.
- Over searching raw markdown only: markdown syntax noise would reduce search quality.
- Over leaving all organization controls for the follow-up: users still need baseline discovery tools in the first private library release.

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
- Over infinite scroll: explicit load more is simpler, more accessible, and easier to combine with loading and error states.

### Decision: Enforce ownership by scoping every query to the current user and hiding non-owned records

Every transcript-management operation in this reduced change is scoped by `ownerUserId`. A user can only list or load transcript records they own. Direct access to another user's transcript identifier returns the same not-found behavior as a missing transcript so the system does not reveal record existence across accounts.

This ownership model applies only to authenticated private transcript records. Future public share routes remain out of scope here.

**Why this over alternatives**

- Over returning explicit forbidden errors for known foreign records: hiding existence is a safer default for private resources.

### Decision: Define explicit UI states for library and detail

The UI must distinguish between:

- initial loading
- library empty state when the user owns no transcripts
- no-results state when search or status filters match nothing
- recoverable library fetch error with retry
- detail loading
- detail not found or unavailable
- recoverable detail fetch error with retry

This prevents the common mistake of collapsing "nothing here" and "we failed to load" into one ambiguous blank page.

**Why this over alternatives**

- Over generic placeholders everywhere: transcript management is a primary product surface, so state clarity matters.

## Risks / Trade-offs

- [Full-text search over transcript content can become expensive] -> Use server-side search indexes derived from markdown content and keep list responses summary-only.
- [Cursor pagination gets trickier with multiple sort modes] -> Encode sort-specific boundaries in the cursor and reset cursors whenever query controls change.
- [A read-first split can leave later curation work feeling separate from the initial library] -> Keep the reduced list/detail contract stable so follow-up curation controls can layer onto the same surfaces instead of replacing them.
- [Hiding foreign records as not-found can make internal debugging harder] -> Keep structured server logs for authorization failures without exposing record existence to users.

## Migration Plan

1. Extend transcript query support and any supporting indexes needed for owner-scoped search, baseline sorting, status filtering, and cursor pagination.
2. Add server-side transcript list and detail read surfaces with owner scoping.
3. Build the transcript library UI with search, baseline sort, status filter, load-more pagination, and explicit empty/loading/error states.
4. Build the transcript detail UI with canonical markdown rendering plus status and privacy-safe metadata.
5. Add authorization and regression coverage for owner-only access and list-query behavior.

Rollback strategy:

- keep transcript creation and processing intact even if private library surfaces are disabled
- disable new library/detail routes if needed without affecting auth or processing
- retain any read-side query/index improvements even if the UI is temporarily withdrawn

## Open Questions

None are blocking for this reduced change. Rename, markdown editing, tags, important markers, and delete flows move to a follow-up transcript-curation change.
