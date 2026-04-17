## 1. Membership Administration

- [ ] 1.1 Implement admin-only add, remove, and role-change flows for team workspaces.
- [ ] 1.2 Enforce last-eligible-active-admin preservation and personal-workspace membership restrictions in membership mutations.

## 2. Invitation Lifecycle

- [ ] 2.1 Add invitation persistence with normalized email, target role, expiration, token rotation, and status tracking.
- [ ] 2.2 Implement invite send, revoke, resend, and generic invalid-link behavior.
- [ ] 2.3 Implement acceptance flows for both existing-account and invite-first account-creation paths with matching-email checks.

## 3. Verification and Lifecycle Dependencies

- [ ] 3.1 Integrate invitation acceptance and management surfaces with archive state defined by `add-workspace-archival-lifecycle` without redefining archive-owned invitation invalidation policy in this change.
- [ ] 3.2 Add automated coverage for invitation issue, resend, revoke, accept, mismatch handling, personal-workspace refusal, and last-eligible-active-admin removal or downgrade refusal.
