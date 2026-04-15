## Context

The previous changes established the prerequisite layers for transcript export:

- `bootstrap-meeting-recap-web-platform` defined the authenticated browser/API/worker topology and owner-scoped product model.
- `add-web-meeting-processing` made the transcript record the durable product resource with canonical markdown fields and privacy-safe metadata.
- `add-transcript-management` added owner-scoped library and detail surfaces and kept transcript/recap editing markdown-first.

This change completes the remaining authenticated export part of the brief:

- exports in `md`, `txt`, `pdf`, and `docx`

Because earlier changes already established canonical `transcriptMarkdown` and `recapMarkdown`, this change can preserve the rule that the backend always sends markdown to the frontend and keep all formatting conversions on the client.

## Goals / Non-Goals

**Goals:**

- Define authenticated export actions for owned transcripts in `md`, `txt`, `pdf`, and `docx`.
- Preserve the markdown-first backend-to-frontend contract for all export paths.
- Define one assembled export document order: display title, recap section, transcript section.
- Keep export actions owner-scoped and completed-only.
- Keep public share pages read-only and free of export controls.

**Non-Goals:**

- Changing transcript creation, retention, or management rules outside what export needs.
- Allowing public export from share links.
- Moving export generation to the backend.
- Introducing HTML as a persisted backend representation.
- Redefining public-sharing URL behavior, secret rotation, or invalid-link handling.

## Decisions

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

### Decision: Public share pages do not expose export actions

Export remains an authenticated owner action even after public sharing exists. A visitor viewing a public share page sees only the read-only shared transcript view and does not gain export affordances through that route.

This keeps the public surface privacy-minimal and prevents export controls from leaking onto a route that is intentionally separate from authenticated transcript-management behavior.

**Why this over alternatives**

- Over reusing authenticated transcript detail controls on the public route: the public share surface has a different trust boundary and presentation goal.

### Decision: Export filenames are derived from the display title

Downloads should use a sanitized filename derived from the current display title and target extension.

This gives users friendly download names without coupling export identity to hidden internal record IDs.

**Why this over alternatives**

- Over opaque IDs or timestamp-only filenames: title-based names are more understandable at the point of download.

## Risks / Trade-offs

- [Client-side `pdf` and `docx` conversion can diverge visually] -> Use one parsed markdown pipeline on the frontend, keep the assembled export order identical across formats, and regression-test representative markdown fixtures against both compilers.
- [Client-side conversion can fail on specific content or browser conditions] -> Surface user-visible export errors and keep transcript content unchanged when conversion fails.
- [Export could drift toward server-side shortcuts under schedule pressure] -> Keep the markdown-only backend contract explicit in the capability spec and regression coverage.

## Migration Plan

1. Add owner-scoped export entry points to transcript-management surfaces for completed transcripts.
2. Implement frontend export helpers that assemble canonical markdown into one document and run it through the selected `unified` / `remark` pipeline.
3. Add format-specific conversion, title-derived download naming, and client-side error handling.
4. Add automated coverage for export authorization, public-route non-exposure, and format conversion outputs.

## Open Questions

None are blocking for this change. Future work could add public export controls or alternative export formatting options, but those are explicitly outside this change.
