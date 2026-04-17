// Coordination point that lets downstream capabilities plug their
// archive-time teardown logic into the workspace archival transition.
// Each registered side effect runs once per `archiveWorkspace` call with
// the archived workspace id and the archive moment. Registration is
// intentionally decoupled from the DB service so that:
//
// - `add-workspace-membership-and-invitations` can register invitation
//   invalidation without pulling the invitations module into archival,
// - `add-public-transcript-sharing` can mark already-active share links
//   suppressed without archival knowing the share schema,
// - `add-transcript-edit-sessions` can release markdown edit locks and
//   cancel any pending same-tab resume windows without archival owning
//   Redis lock state.
//
// Side effects run in registration order. Any rejected side effect
// surfaces a structured `ArchivalSideEffectError` that aggregates the
// individual failures, so the caller (archive admin action) can
// distinguish "the workspace is archived but a side effect failed" from
// "archive could not be committed at all".

export type ArchiveSideEffectContext = {
  workspaceId: string;
  archivedAt: Date;
};

export type ArchiveSideEffect = {
  id: string;
  run: (context: ArchiveSideEffectContext) => Promise<void>;
};

// Structured error aggregating per-side-effect failures. Callers can
// inspect `failures` to decide whether to retry a specific side effect
// or schedule a background reconciliation job.
export class ArchivalSideEffectError extends Error {
  readonly code = "archival_side_effect_failed" as const;
  readonly failures: ReadonlyArray<{ id: string; cause: unknown }>;
  constructor(failures: ReadonlyArray<{ id: string; cause: unknown }>) {
    super(`Archival side effects failed: ${failures.map((f) => f.id).join(", ")}`);
    this.name = "ArchivalSideEffectError";
    this.failures = failures;
  }
}

// Default registry holding the side effects the archival service invokes
// on every archive transition. Module-level storage keeps registration
// stable across imports. `registerArchiveSideEffect` replaces an
// existing entry with the same id so downstream modules can keep the
// API idempotent under hot reload.
const defaultRegistry: ArchiveSideEffect[] = [];

export function registerArchiveSideEffect(effect: ArchiveSideEffect): void {
  const existing = defaultRegistry.findIndex((entry) => entry.id === effect.id);
  if (existing === -1) {
    defaultRegistry.push(effect);
    return;
  }
  defaultRegistry[existing] = effect;
}

export function unregisterArchiveSideEffect(id: string): void {
  const index = defaultRegistry.findIndex((entry) => entry.id === id);
  if (index !== -1) {
    defaultRegistry.splice(index, 1);
  }
}

export function listRegisteredArchiveSideEffects(): ReadonlyArray<ArchiveSideEffect> {
  return defaultRegistry.slice();
}

// Run the provided side-effect collection sequentially and collect per-
// entry failures. Callers can swap in an explicit list (tests, targeted
// reconciliation) instead of relying on the module registry.
export async function runArchiveSideEffects(context: ArchiveSideEffectContext, effects: ReadonlyArray<ArchiveSideEffect> = defaultRegistry): Promise<void> {
  const failures: Array<{ id: string; cause: unknown }> = [];
  for (const effect of effects) {
    try {
      await effect.run(context);
    } catch (cause) {
      failures.push({ id: effect.id, cause });
    }
  }
  if (failures.length > 0) {
    throw new ArchivalSideEffectError(failures);
  }
}
