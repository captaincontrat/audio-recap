## 1. Locking Primitives

- [ ] 1.1 Implement Redis-backed transcript markdown lock acquisition, renewal, release, and conflict detection.
- [ ] 1.2 Scope lock enforcement to `transcriptMarkdown` and `recapMarkdown` only.

## 2. Editor and Autosave Flow

- [ ] 2.1 Add client edit-session entry flow that only allows workspace `member` and `admin` users in the current workspace and blocks second-session attempts, including same-user multi-tab conflicts while still permitting same-tab refresh resume of the existing session.
- [ ] 2.2 Implement a tab-scoped edit-session identity and same-tab refresh resume within an approximately 10-second reconnection window, reloading the last successfully saved markdown on resume.
- [ ] 2.3 Implement autosave with an approximately one-second debounce and a 20-minute expiry window from the last successful save.
- [ ] 2.4 Force exit from edit mode on lock loss with an explicit expired-session message and no temporary local draft recovery.

## 3. Integration and Verification

- [ ] 3.1 Integrate the `add-workspace-archival-lifecycle` active-workspace requirement into edit-session entry, same-tab resume, and autosave eligibility without re-owning archive-triggered lock release or autosave rejection.
- [ ] 3.2 Add automated coverage for role-based and active-workspace session entry, session-entry conflicts, same-tab refresh resume, failed reconnect exit, autosave renewal, timeout exit, and post-expiry save rejection.
