# Scope Ranking Conversation Context

This note preserves the earlier answer about large OpenSpec changes and adds the surrounding context that became visible afterward, so a later conversation can resume without redoing the same investigation.

## Original user question

Some changes in `@openspec` have large scopes and this will likely push agents to compress their context in order to fully implement them, thus diminishing the quality of implementations.

Identify the changes with large scopes and sort them by this metric.

## Original answer snapshot

Metric used:

`context-surface = proposal.md + design.md + tasks.md + all delta spec.md files`

Why this metric was used:

- It is a practical proxy for how much specification context an implementation agent has to keep loaded.
- It captures both breadth of scope and spec surface area, not just task count.

Original ranking produced before later split artifacts were examined:

| Rank | Change | Context surface | Tasks | Spec breadth | Why it felt large |
| --- | --- | ---: | ---: | --- | --- |
| 1 | `bootstrap-meeting-recap-web-platform` | 694 | 22 | 12 requirements / 36 scenarios | Platform bootstrap, shared pipeline reuse, auth system, passkeys, 2FA, Google/One Tap, localization, account deletion, worker/runtime foundations |
| 2 | `add-web-meeting-processing` | 481 | 15 | 12 requirements / 26 scenarios | Upload flow, presigned S3 uploads, browser normalization, worker lifecycle, retries, title/recap generation, timestamp normalization, retention cleanup |
| 3 | `add-transcript-sharing-and-exports` | 425 | 18 | 11 requirements / 19 scenarios | Public sharing model, double-UUID links, public rendering, share-state organization, plus 4 export formats and client-side conversion pipeline |
| 4 | `add-transcript-management` | 397 | 20 | 8 requirements / 22 scenarios | Private library, search/sort/filter/pagination, detail views, markdown editing, tags, important state, deletion, owner-scoped authz |

Original conclusion:

- `bootstrap-meeting-recap-web-platform` was the clearest outlier and most likely to force harmful context compression.
- `add-web-meeting-processing` was the next riskiest because it is highly cross-cutting even with fewer tasks.
- `add-transcript-sharing-and-exports` and `add-transcript-management` were still large, but less extreme.

## Important context discovered afterward

After the original answer, nearby artifacts showed that the oversized bootstrap change had already been split.

Key evidence:

- `openspec/split-audit/bootstrap-meeting-recap-web-platform-original/reconciliation.md`
- `.cursor/plans/split_bootstrap_change_7deb20d6.plan.md`

What those artifacts say:

- The original `bootstrap-meeting-recap-web-platform` scope was intentionally split.
- Reduced bootstrap remains in `openspec/changes/bootstrap-meeting-recap-web-platform/`.
- Federated/passwordless auth moved to `openspec/changes/add-federated-and-passwordless-auth/`.
- Account security hardening moved to `openspec/changes/add-account-security-hardening/`.
- Auth localization moved to `openspec/changes/add-auth-localization-foundation/`.
- Processing-coupled storage and pipeline reuse work moved to `openspec/changes/add-web-meeting-processing/`.
- The reconciliation artifact says no original functional requirement was silently dropped.

Implication:

- The original ranking is useful as a snapshot of why the monolithic bootstrap was risky.
- It is now partially stale because the current bootstrap change is materially smaller than the one ranked at 694.

## Current split-related signals in context

Recent file metadata and reads during this session showed:

- `openspec/changes/bootstrap-meeting-recap-web-platform/proposal.md`: 30 lines
- `openspec/changes/bootstrap-meeting-recap-web-platform/design.md`: 282 lines
- `openspec/changes/bootstrap-meeting-recap-web-platform/tasks.md`: 25 lines
- `openspec/changes/bootstrap-meeting-recap-web-platform/specs/core-account-authentication/spec.md`: 73 lines

This suggests the reduced bootstrap currently has a context-surface of:

- `30 + 282 + 25 + 73 = 410`

The still-large processing change currently reads as:

- `openspec/changes/add-web-meeting-processing/proposal.md`: 36 lines
- `openspec/changes/add-web-meeting-processing/design.md`: 274 lines
- `openspec/changes/add-web-meeting-processing/tasks.md`: 30 lines
- `openspec/changes/add-web-meeting-processing/specs/meeting-import-processing/spec.md`: 102 lines
- `openspec/changes/add-web-meeting-processing/specs/transcript-data-retention/spec.md`: 42 lines

Current processing context-surface:

- `36 + 274 + 30 + 102 + 42 = 484`

## Post-split quick ranking

Using artifact counts read during this session, the likely current ranking is:

| Rank | Change | Current context surface | Notes |
| --- | --- | ---: | --- |
| 1 | `add-web-meeting-processing` | 484 | Now the largest active change in the set that was examined |
| 2 | `add-transcript-sharing-and-exports` | 425 | Still large and cross-cutting across sharing plus export conversion |
| 3 | `bootstrap-meeting-recap-web-platform` | 410 | Smaller than before, but still sizable even after the split |
| 4 | `add-transcript-management` | 397 | Large management surface with query controls and editing flows |
| 5 | `add-federated-and-passwordless-auth` | 227 | Medium-sized follow-up auth change after the split |
| 6 | `add-account-security-hardening` | 177 | Focused security/destructive-action follow-up |
| 7 | `add-auth-localization-foundation` | 131 | Smallest of the split follow-up changes |

Line-count basis for the three new follow-up auth changes:

- `add-federated-and-passwordless-auth`: `29 + 103 + 29 + 66 = 227`
- `add-account-security-hardening`: `29 + 93 + 23 + 32 = 177`
- `add-auth-localization-foundation`: `29 + 70 + 15 + 17 = 131`

## Useful files to revisit next

- `openspec/split-audit/bootstrap-meeting-recap-web-platform-original/reconciliation.md`
- `.cursor/plans/split_bootstrap_change_7deb20d6.plan.md`
- `openspec/changes/bootstrap-meeting-recap-web-platform/design.md`
- `openspec/changes/add-web-meeting-processing/design.md`
- `openspec/changes/add-transcript-sharing-and-exports/design.md`
- `openspec/changes/add-transcript-management/design.md`

## Best next conversation starters

- Re-rank all active changes from scratch against the post-split seven-change set.
- Decide whether `add-web-meeting-processing` should be split further, since it is now the largest current change.
- Compare pre-split versus post-split context-surface to measure whether the split materially reduced agent-context risk.
