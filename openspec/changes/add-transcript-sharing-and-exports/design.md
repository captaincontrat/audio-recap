## Context

The previous changes established the prerequisite layers for this final scope:

- `bootstrap-meeting-recap-web-platform` defined the authenticated browser/API/worker topology and owner-scoped product model.
- `add-web-meeting-processing` made the transcript record the durable product resource with canonical markdown fields and privacy-safe metadata.
- `add-transcript-management` added owner-scoped library and detail surfaces and kept transcript/recap editing markdown-first.

This change completes the remaining user-facing scope from the brief:

- public sharing by hard-to-guess URL
- exports in `md`, `txt`, `pdf`, and `docx`

Because earlier changes already established canonical `transcriptMarkdown` and `recapMarkdown`, this change can preserve the rule that the backend always sends markdown to the frontend and keep all formatting conversions on the client.

## Goals / Non-Goals

**Goals:**

- Define owner-managed public transcript sharing with enable, disable, and secret rotation.
- Define a double-UUID public URL shape that does not expose internal transcript identifiers.
- Define how public sharing state appears as an owner-only organization criterion in the private transcript library.
- Define privacy-minimal public transcript rendering with read-only behavior.
- Define access behavior for disabled, rotated, missing, or otherwise invalid public URLs.
- Define authenticated export actions for owned transcripts in `md`, `txt`, `pdf`, and `docx`.
- Preserve the markdown-first backend-to-frontend contract for all export paths.

**Non-Goals:**

- Changing transcript creation, retention, or management rules outside what sharing and export need.
- Allowing public editing, public export, or public access to owner-only metadata.
- Adding analytics, view counters, access logs, or expiration policies for shares.
- Moving export generation to the backend.
- Introducing HTML as a persisted backend representation.

## Decisions

### Decision: Public sharing is owner-managed and only available for completed transcripts

Only the owner of a transcript record can manage sharing for that record. Public sharing is available only when the transcript is in `completed` status, because only completed transcripts guarantee stable canonical markdown for both the recap and transcript sections.

Owners can:

- enable sharing
- disable sharing
- rotate the share secret

This keeps the public surface simple and avoids sharing incomplete or failed transcript states.

**Why this over alternatives**

- Over allowing public access to in-progress or failed records: those states are operational, not presentation-ready.
- Over exposing share controls to non-owners: sharing is a private management action, not a collaborative permission system.

### Decision: Use a double-UUID URL with stable public ID and rotatable secret ID

The public share URL will use two UUIDs:

```text
/share/<publicShareId>/<shareSecretId>
```

Field roles:

- `publicShareId`: stable per transcript once the transcript becomes share-capable
- `shareSecretId`: active secret identifier used to authorize the public link and rotated when the owner requests a new link

On first enable:

- create `publicShareId` if missing
- create a fresh `shareSecretId`
- mark sharing enabled

On disable:

- mark sharing disabled
- invalidate the active secret without deleting the transcript

On secret rotation:

- keep `publicShareId`
- replace `shareSecretId` with a fresh UUID
- invalidate the prior link immediately

This satisfies the brief's double-UUID requirement while giving the owner a predictable share handle plus a revocable secret.

**Why this over alternatives**

- Over using the transcript ID in the URL: it would leak internal record identity into the public surface.
- Over rotating both UUIDs every time: keeping the public share ID stable simplifies management while the secret UUID provides revocation.

### Decision: Public sharing state participates in owner-only library organization

The authenticated transcript library and detail surfaces will expose whether each owned transcript is currently publicly shared. That owner-only share state becomes part of the private organization model:

- library summary data includes `isPubliclyShared`
- server-side query controls support `shared-first` and `unshared-first` sort options
- server-side filters support `shared-only` and `unshared-only`

This completes the brief's organization criteria by making public sharing state a first-class private-library dimension without exposing extra metadata on the public route.

**Why this over alternatives**

- Over keeping share state visible only inside per-record controls: users need to organize their private library by whether records are shared.
- Over treating share state only as a filter: the brief calls for sorting by the organization criteria, so share state needs explicit sort behavior too.

### Decision: Invalid, disabled, missing, and rotated links all resolve to the same public-unavailable behavior

The public share surface must not reveal whether a transcript exists, used to be shared, or was recently rotated. Therefore, these cases all return the same public-unavailable behavior:

- nonexistent `publicShareId`
- wrong `shareSecretId`
- disabled share
- rotated old link
- deleted transcript

The user-facing result is a generic unavailable/not-found page. The server may log the specific reason internally, but that reason is never exposed in the public response.

**Why this over alternatives**

- Over telling viewers that a link was rotated or disabled: that leaks private transcript-management state.

### Decision: Public rendering is read-only and privacy-minimal

The public share page renders only the minimum useful transcript content:

- display title
- canonical `recapMarkdown`
- canonical `transcriptMarkdown`

It does not expose:

- transcript identifiers
- owner identity or account information
- tags
- important marker
- processing status
- failure information
- source media metadata
- notes metadata
- share-management metadata
- authenticated management controls
- export actions

The public page remains read-only even when the viewer is also signed in as the owner. Owner controls stay on the authenticated transcript-management surfaces, not on the share route.

**Why this over alternatives**

- Over exposing more transcript metadata for convenience: the brief's privacy posture favors minimal public disclosure.
- Over reusing the authenticated detail page directly: the public route has different safety and presentation rules.

### Decision: Public shares always render the latest canonical markdown

The public share page reads the current canonical `recapMarkdown`, `transcriptMarkdown`, and display title from the transcript record at request time. If the owner later edits the transcript, recap, or title through transcript management, the public page reflects the updated canonical content automatically.

This avoids having to snapshot duplicate share content and keeps one source of truth for what is being shared.

**Why this over alternatives**

- Over snapshotting share content on enable: it would create drift between the shared content and the canonical transcript record.

### Decision: Exports are authenticated owner actions and are only available for completed transcripts

Exports are owner-scoped actions available from authenticated transcript-management surfaces. Only the owner of a `completed` transcript can export it. Public share pages do not offer export controls.

This aligns export with private transcript ownership and avoids supporting partially generated or failed content as downloadable artifacts.

**Why this over alternatives**

- Over allowing public export from shared links: the request only requires authenticated export actions and public sharing should stay read-only and minimal.
- Over allowing export before completion: the durable content may be incomplete or absent.

### Decision: Export conversion happens entirely on the frontend from canonical markdown

The backend always sends canonical markdown to the frontend:

- `recapMarkdown`
- `transcriptMarkdown`
- display title

The frontend assembles a single export document in canonical order:

1. title
2. recap section
3. transcript section

The frontend then processes that assembled document through one browser-side markdown pipeline built on `unified`, `remark-parse`, and `remark-gfm` so every export format shares the same parsed markdown model.

Then it converts that assembled client-side document into:

- `md`: direct download of the assembled canonical markdown
- `txt`: plain-text download derived from the parsed markdown tree with `mdast-util-to-string`
- `pdf`: PDF compiled from the parsed markdown tree with `remark-pdf`
- `docx`: DOCX compiled from the parsed markdown tree with `remark-docx`

Transient HTML rendering may still be used for browser preview surfaces if useful, but HTML is not the canonical export intermediate and is never persisted by the backend. The backend contract remains markdown-only.

Implementation references for the selected export stack:

- [`unified`](https://unifiedjs.com/)
- [`remark-parse`](https://github.com/remarkjs/remark/tree/main/packages/remark-parse)
- [`remark-gfm`](https://github.com/remarkjs/remark-gfm#readme)
- [`mdast-util-to-string`](https://github.com/syntax-tree/mdast-util-to-string)
- [`remark-pdf`](https://unifiedjs.com/explore/package/remark-pdf)
- [`remark-docx`](https://unifiedjs.com/explore/package/remark-docx/)

**Why this over alternatives**

- Over server-side export generation: it would violate the brief's rule that the backend always sends markdown to the frontend and the frontend performs conversion.
- Over format-specific backend payloads: they would fragment the content contract and duplicate rendering logic.
- Over a primary `markdown -> html -> anything` pipeline: HTML-only conversion would add another intermediate representation and increase drift between `txt`, `pdf`, and `docx`, while the selected `remark` stack keeps one parsed markdown model across formats.

### Decision: Share and export filenames/links are derived from the display title, but internal state stays separate

Downloads should use a sanitized filename derived from the current display title and target extension. Public URLs do not depend on the display title and remain stable unless the secret is rotated or sharing is disabled.

This avoids coupling share addressability to mutable titles while still giving users friendly export filenames.

**Why this over alternatives**

- Over slug-based public URLs: title changes would destabilize links and leak more semantic information than necessary.

## Risks / Trade-offs

- [Stable `publicShareId` plus rotatable secret adds more share state to the transcript model] -> Keep the model small and well-scoped: enabled flag, stable public ID, active secret ID, and rotation timestamp if needed.
- [Client-side `pdf` and `docx` conversion can diverge visually] -> Use one parsed markdown pipeline on the frontend, keep the assembled export order identical across formats, and regression-test representative markdown fixtures against both compilers.
- [Public pages showing the latest canonical markdown means owner edits are immediately public] -> Keep sharing management visible to owners and allow disable/rotate actions to invalidate old links quickly.
- [Generic unavailable responses make debugging harder] -> Preserve detailed internal server logs for why a link failed while keeping public responses intentionally vague.
- [Read-only public pages without export may feel restrictive] -> Preserve a strict boundary between authenticated owner actions and public viewer access for privacy and scope control.

## Migration Plan

1. Extend transcript persistence to support stable public share IDs, active share secrets, and share-enabled state.
2. Add owner-scoped share enable/disable/rotate actions to transcript-management APIs and extend private library queries with share-state projection, sorting, and filtering.
3. Add the public read-only share route with privacy-minimal transcript projections and generic unavailable behavior.
4. Add authenticated export actions to transcript-management surfaces for completed owned transcripts.
5. Implement frontend conversion from canonical markdown into `md`, `txt`, `pdf`, and `docx` with the selected `unified` / `remark` export stack.
6. Add regression coverage for share invalidation, public-field minimization, and client-side export outputs.

Rollback strategy:

- disable share-management actions and the public share route without affecting transcript ownership or management
- disable export controls without affecting transcript viewing or editing
- preserve share state in Postgres even if public routing is temporarily disabled

## Open Questions

None are blocking for this change. Future work could add optional share expiration, revocation audit trails, or public export controls, but those are explicitly outside this change.
