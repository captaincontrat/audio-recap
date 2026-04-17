import "server-only";

import { registerInvitationArchiveSideEffect } from "./invitation-archive-effect";

// Single call site where every workspace capability registers its
// archive side effects. Called from Next.js `instrumentation.ts` and
// from the worker bootstrap so both runtimes share one code path.
//
// Kept here (rather than at module-import time) so tests can run
// against an empty registry by default and opt into the production
// wiring via `registerWorkspaceArchiveSideEffects()`.
export function registerWorkspaceArchiveSideEffects(): void {
  registerInvitationArchiveSideEffect();
}
