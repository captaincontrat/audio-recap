## 1. Lifecycle State

- [ ] 1.1 Add team-workspace archive, restore, and scheduled-delete state while refusing archive for personal workspaces.
- [ ] 1.2 Implement archive eligibility checks for active upload and non-terminal audio-processing work.

## 2. Immediate Archive Side Effects

- [ ] 2.1 Gate workspace-private transcript surfaces, authenticated export, invitation acceptance, and public share resolution on archive state.
- [ ] 2.2 Release active markdown edit locks, cancel pending same-tab resume attempts, and reject archived-workspace autosaves during the archive transition.

## 3. Restore and Verification

- [ ] 3.1 Implement restore handling plus delayed permanent deletion after the 60-day window, including the rule that previously enabled public links stay inactive until fresh share management after restore.
- [ ] 3.2 Add automated coverage for archive refusal during processing, private-surface and export lockout, immediate link invalidation, post-restore public-link inactivity, edit-session termination, refusal of post-archive same-tab resume, and delayed deletion.
