## Context

The previous changes established the prerequisite layers for public transcript sharing:

- `bootstrap-meeting-recap-web-platform` defined the authenticated browser/API/worker topology.
- `add-web-meeting-processing` made the transcript record the durable product resource with canonical markdown fields and privacy-safe metadata.
- The workspace collaboration direction now makes the transcript record a workspace resource and authorization a membership-role concern.
- `add-transcript-management` is being retargeted to workspace-scoped library and detail surfaces while keeping transcript/recap editing markdown-first.
- `add-workspace-archival-lifecycle` owns archive-driven public-link availability, including the rule that public sharing is active only for active workspaces and does not resume after restore without fresh share management.

This change completes the public read-only sharing part of the remaining brief:

- public sharing by hard-to-guess URL

Because earlier changes already established canonical `transcriptMarkdown` and `recapMarkdown`, this change can render the public route from the current canonical record without introducing a second persisted content representation.

## Goals / Non-Goals

**Goals:**

- Define workspace role-managed public transcript sharing with enable, disable, and secret rotation for completed transcripts in active workspaces.
- Define a double-UUID public URL shape that does not expose internal transcript identifiers.
- Define how public sharing state appears as a workspace-scoped organization criterion in the private transcript library.
- Define privacy-minimal public transcript rendering with read-only behavior.
- Define access behavior for disabled, rotated, missing, or otherwise invalid public URLs in active workspaces, while relying on `add-workspace-archival-lifecycle` for archive-driven availability.
- Ensure the public share route never exposes private workspace metadata, management controls, or export actions.

**Non-Goals:**

- Changing transcript creation, retention, or management rules outside what sharing needs.
- Allowing public editing, public export, or public access to private workspace metadata.
- Adding analytics, view counters, access logs, or expiration policies for shares.
- Adding authenticated export generation or browser-side export conversion.
- Introducing HTML as a persisted backend representation.
- Redefining archive-driven public-link availability or post-restore reactivation behavior.

## Decisions

### Decision: Public sharing is workspace-managed by `member` and `admin`, and only available for completed transcripts in active workspaces

For a transcript record in an active workspace, any `member` or `admin` with access to that workspace can manage public sharing for that record. `read_only` members cannot manage sharing. Public sharing is available only when the transcript is in `completed` status, because only completed transcripts guarantee stable canonical markdown for both the recap and transcript sections.

Members and admins can:

- enable sharing
- disable sharing
- rotate the share secret

This keeps the public surface simple while matching the collaborative workspace authorization model instead of a creator-only one.

**Why this over alternatives**

- Over allowing public access to in-progress or failed records: those states are operational, not presentation-ready.
- Over limiting share controls to one transcript creator or other single-user authority: the transcript belongs to the workspace and sharing is managed collaboratively there.
- Over allowing `read_only` to manage sharing: export is treated as a read action, but changing public availability is a management action and should stay with edit-capable roles.

### Decision: Use a double-UUID URL with stable public ID and rotatable secret ID

The public share URL will use two UUIDs:

```text
/share/<publicShareId>/<shareSecretId>
```

Field roles:

- `publicShareId`: stable per transcript once the transcript becomes share-capable
- `shareSecretId`: active secret identifier used to authorize the public link and rotated when an authorized workspace user requests a new link

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

This satisfies the brief's double-UUID requirement while giving the workspace a stable public handle plus a revocable secret.
The public URL remains stable across title changes because it is derived only from the share identifiers, not from mutable transcript metadata.

**Why this over alternatives**

- Over using the transcript ID in the URL: it would leak internal record identity into the public surface.
- Over rotating both UUIDs every time: keeping the public share ID stable simplifies management while the secret UUID provides revocation.

### Decision: Public sharing state participates in workspace-scoped library organization

The authenticated transcript library and detail surfaces will expose whether each transcript visible in the current workspace is currently publicly shared. That workspace-private share state becomes part of the private organization model:

- library summary data includes `isPubliclyShared`
- server-side query controls support `shared-first` and `unshared-first` sort options
- server-side filters support `shared-only` and `unshared-only`

Because transcript browsing is workspace-scoped, this organization dimension applies to the viewer's visible workspace transcript set rather than a personal transcript slice.
This completes the brief's organization criteria by making public sharing state a first-class private-library dimension without exposing extra metadata on the public route.

**Why this over alternatives**

- Over keeping share state visible only inside per-record controls: workspace users need to organize the collaborative library by whether records are shared.
- Over treating share state only as a filter: the brief calls for sorting by the organization criteria, so share state needs explicit sort behavior too.

### Decision: Invalid, disabled, missing, and rotated links all resolve to the same public-unavailable behavior

Within active workspaces, the public share surface must not reveal whether a transcript exists, used to be shared, or was recently rotated. Therefore, these cases all return the same public-unavailable behavior:

- nonexistent `publicShareId`
- wrong `shareSecretId`
- disabled share
- rotated old link
- deleted transcript

The user-facing result is a generic unavailable/not-found page. The server may log the specific reason internally, but that reason is never exposed in the public response.

Lifecycle-driven unavailability from `add-workspace-archival-lifecycle` should reuse the same public unavailable presentation, but the archive rule itself is defined there.

**Why this over alternatives**

- Over telling viewers that a link was rotated or disabled: that leaks private transcript-management state.

### Decision: Public rendering is read-only and privacy-minimal

The public share page renders only the minimum useful transcript content:

- display title
- canonical `recapMarkdown`
- canonical `transcriptMarkdown`

It does not expose:

- transcript identifiers
- workspace identifiers
- creator identity, workspace membership information, or account information
- tags
- important marker
- processing status
- failure information
- source media metadata
- notes metadata
- share-management metadata
- authenticated management controls
- export actions

The public page remains read-only even when the viewer is also signed in as a `member` or `admin` of the workspace. Share controls stay on the authenticated transcript-management surfaces, not on the share route.

**Why this over alternatives**

- Over exposing more transcript metadata for convenience: the brief's privacy posture favors minimal public disclosure.
- Over reusing the authenticated detail page directly: the public route has different safety and presentation rules.

### Decision: Public shares always render the latest canonical markdown

The public share page reads the current canonical `recapMarkdown`, `transcriptMarkdown`, and display title from the transcript record at request time. If an authorized workspace user later edits the transcript, recap, or title through transcript management, the public page reflects the updated canonical content automatically.

This avoids having to snapshot duplicate share content and keeps one source of truth for what is being shared.

**Why this over alternatives**

- Over snapshotting share content on enable: it would create drift between the shared content and the canonical transcript record.

## Risks / Trade-offs

- [Stable `publicShareId` plus rotatable secret adds more share state to the transcript model] -> Keep the model small and well-scoped: enabled flag, stable public ID, active secret ID, and rotation timestamp if needed.
- [Public pages showing the latest canonical markdown means workspace edits are immediately public] -> Keep sharing management visible to `member` and `admin` users and allow disable/rotate actions to invalidate old links quickly.
- [Generic unavailable responses make debugging harder] -> Preserve detailed internal server logs for why a link failed while keeping public responses intentionally vague.
- [Read-only public pages without export may feel restrictive] -> Preserve a strict boundary between authenticated workspace actions and public viewer access for privacy and scope control.

## Migration Plan

1. Extend transcript persistence to support stable public share IDs, active share secrets, and share-enabled state.
2. Add workspace-scoped share enable/disable/rotate actions to transcript-management APIs with `member`/`admin` role enforcement, and extend private library queries with share-state projection, sorting, and filtering.
3. Add the public read-only share route with privacy-minimal transcript projections plus generic unavailable behavior for invalid share access, while integrating public-route availability with `add-workspace-archival-lifecycle`.
4. Add regression coverage for role-based share authorization, share invalidation, and public-field minimization.

## Open Questions

None are blocking for this change. `add-workspace-archival-lifecycle` owns archive-driven public-link availability and post-restore reactivation policy. Future work could add optional share expiration, revocation audit trails, or public export controls, but those are explicitly outside this change.
