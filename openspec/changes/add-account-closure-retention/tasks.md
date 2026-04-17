## 1. Closure State, Access Suspension, and Reactivation

- [ ] 1.1 Replace the V1 permanent-delete path with a retained account-closure state plus a 30-day self-service reactivation window, expiry-driven permanent deletion, and recent-auth gating, including fresh second-factor verification when 2FA is enabled.
- [ ] 1.2 Suspend normal authenticated access for closed accounts, revoke active sessions, preserve retained account state during the reactivation window, and permanently delete expired closed accounts when that window elapses without reactivation.
- [ ] 1.3 Implement self-service account reactivation within 30 days through fresh sign-in and fresh second-factor verification when 2FA is enabled, without restoring revoked sessions or undoing workspace membership or admin changes made while the account was closed.
- [ ] 1.4 Remove remaining team-workspace memberships, delete the personal workspace, preserve other workspace-owned resources, and apply a generic deleted-user attribution fallback after permanent account deletion.

## 2. Workspace Guardrails

- [ ] 2.1 Enforce last-eligible-active-admin handoff before account closure for non-personal workspaces.
- [ ] 2.2 Preserve the personal workspace during the reactivation window, delete it during final permanent account deletion, and explicitly block transcript-transfer behavior from the V1 closure flow.

## 3. Retargeting and Verification

- [ ] 3.1 Retarget the existing account-security-hardening plan and UX copy from immediate permanent deletion to 30-day closure-and-reactivation plus expiry-driven deletion terminology, alongside recent-auth and fresh-2FA prerequisites.
- [ ] 3.2 Add automated coverage for recent-auth gating, fresh-second-factor gating, access suspension, successful reactivation within window, expired-window permanent deletion, membership cleanup, non-restoration of prior sessions or workspace changes, last-eligible-active-admin refusal, personal-workspace deletion, preserved workspace-owned resources, and generic deleted-user attribution fallback.
