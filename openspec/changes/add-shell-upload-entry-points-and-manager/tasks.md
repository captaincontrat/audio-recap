## 1. Workspace-keyed upload-manager store

- [ ] 1.1 Add a workspace-keyed client upload-manager store/provider owned by the private workspace product layer. The store keys are `workspaceSlug` and values are lists of tray items that carry both the local submission phase (`draft`, `preparing`, `uploading`, `finalizing`, `local error`) and the server transcript-processing phase (`queued`, `preprocessing`, `transcribing`, `generating_recap`, `generating_title`, `finalizing`, `retrying`, `completed`, `failed`).
- [ ] 1.2 Scope the store's public reads so any consumer inside the shared shell only sees items for the current workspace slug and never sees items from another workspace, even if both workspaces have active items in the same browser session.
- [ ] 1.3 Preserve store state across same-workspace navigation by mounting the store above the workspace-scoped routes inside the shared shell, so client-side React state survives intra-shell transitions.

## 2. Shell-level drop overlay and header upload control

- [ ] 2.1 Add a shell-level global drop overlay that is active anywhere inside the shared workspace shell and identifies the current workspace as the target while the user drags a supported file.
- [ ] 2.2 Add an explicit header upload control in the shell's thin header that activates the same drop-then-confirm handoff as a drop.
- [ ] 2.3 Ensure both entry points open exactly the same drop-then-confirm handoff associated with the current workspace, so there is only one confirmation surface regardless of entry point.
- [ ] 2.4 When the current workspace is archived or the current user has read-only access in the current workspace, the shell MUST NOT show an accepting drop target and MUST NOT present an active header upload control.

## 3. Drop-then-confirm handoff

- [ ] 3.1 Implement the drop-then-confirm handoff as the upload manager's `draft` state: the tray item shows the dropped or selected file, allows the user to optionally add notes, and requires explicit confirmation before any upload begins.
- [ ] 3.2 Cancellation before confirmation MUST discard the draft item without uploading the file and without creating queued transcript work.
- [ ] 3.3 Confirmation MUST transition the tray item from `draft` into the local submission phases (`preparing`, `uploading`, `finalizing`) using the same `submitMeeting()` orchestration used by the dedicated submission form.

## 4. Upload manager queue and lifecycle display

- [ ] 4.1 Implement the upload manager as a persistent bottom-right tray scoped to the current workspace. Each tray item MUST show its current state using the shared submission + transcript-processing vocabulary defined in Task 1.1.
- [ ] 4.2 Support multiple concurrent items in the same workspace. When the queue grows beyond a small number of visible items, collapse the tray into a compact header summary (count + current stage hint) while keeping the queue expandable on demand.
- [ ] 4.3 Allow dismissal of terminal items (`completed`, `failed`) from the tray. Failed items MUST remain pinned in the current workspace session until the user dismisses them. Dismissal MUST be client-only and MUST NOT delete the underlying transcript record.
- [ ] 4.4 Each non-draft item MUST offer a route into the transcript's dedicated private status or detail surface when that resource becomes available: while non-terminal the item links to the dedicated meeting-status page, after completion the item may link to the transcript detail page, after failure the item still offers a route into the dedicated meeting-status page for inspection.

## 5. Status polling and rehydration

- [ ] 5.1 After `submitMeeting()` returns a transcript id for a tray item, transition the item from the local submission phases into the server transcript-processing phases by polling the existing workspace-scoped meeting-status endpoint used by the dedicated status page. Do not introduce a new endpoint or a realtime transport in this change.
- [ ] 5.2 On shell mount for a workspace slug, rehydrate the upload-manager tray by reading the current workspace's non-terminal transcripts the user can access via the existing workspace transcript library read, and merge them with any client-side in-session items by transcript id.
- [ ] 5.3 Follow each rehydrated item through the same polling contract used for fresh submissions. Do not duplicate items between the in-session client store and the rehydrated set; the merge key is the transcript id.

## 6. Submission path consolidation

- [ ] 6.1 Refactor the dedicated meeting-submission form, the shell drop handoff, and the shell header upload control to share the same `submitMeeting()` orchestration and a common client-side submission item model. The dedicated page's redirect behavior to the dedicated status page on success MUST remain intact.
- [ ] 6.2 Rewire the workspace overview's start-upload CTA so it opens the shared shell's drop-then-confirm handoff for the current workspace instead of navigating to the dedicated submission page. The dedicated submission page MUST remain reachable through direct links.

## 7. Regression coverage

- [ ] 7.1 Add coverage for the shell drop-then-confirm flow from both the drag-and-drop target and the header upload control: both entry points open the same handoff, cancellation before confirmation does not upload or queue, confirmation uses `submitMeeting()` and transitions into the tray's lifecycle display.
- [ ] 7.2 Add coverage for multiple concurrent items in the same workspace, collapse-to-summary behavior when the queue is large, dismissal of terminal items, and failed items remaining pinned until dismissed.
- [ ] 7.3 Add coverage for same-workspace tray persistence across navigation inside the shell and for cross-workspace isolation: a shell mounted for `w/[slug-b]` MUST NOT show items created in `w/[slug-a]`.
- [ ] 7.4 Add coverage for upload-manager rehydration on shell mount: non-terminal transcripts the user can read appear in the tray without requiring a new shell submission, and rehydrated items are not duplicated with in-session client-side items.
- [ ] 7.5 Add coverage for archived-workspace and read-only shell behavior: no accepting drop target, no active header upload control, and no shell-level submission path is available.
- [ ] 7.6 Add coverage for the overview start-upload CTA: it opens the shell drop-then-confirm handoff and no longer navigates to the dedicated submission page.
