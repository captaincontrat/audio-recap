// Pure helpers for reasoning about account-closure retention state owned
// by the `account-closure-retention` capability. The user row exposes two
// durable timestamps (`closedAt`, `scheduledDeleteAt`). Every downstream
// capability that gates behavior on whether an account is "active" or
// "closed" should derive its decision from these predicates instead of
// re-implementing the rules.
//
// The helpers are intentionally shape-only — they accept the two fields
// directly so the same logic works for full user rows, API projections,
// and in-memory simulations in tests.

// The self-service reactivation window is fixed at 30 days by the
// `account-closure-retention` spec. Helpers that need to compute the
// scheduled-delete moment from a closure moment go through
// `computeScheduledAccountDeleteAt` so the constant has a single source
// of truth.
export const REACTIVATION_WINDOW_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1_000;

// Timestamp surface consumed by every predicate in this module. Callers
// typically pass the relevant subset of a `UserRow`, but the shape stays
// independent of Drizzle so tests and non-DB callers can construct it
// directly.
export type AccountClosureTimestamps = {
  closedAt: Date | null;
  scheduledDeleteAt: Date | null;
};

// Derived lifecycle state. "active" is the default; "closed_reactivable"
// and "closed_past_reactivation_window" split the closed state so callers
// that want to distinguish "can still reactivate" from "eligible for
// permanent deletion" can branch without recomputing the window math.
export type AccountClosureState = "active" | "closed_reactivable" | "closed_past_reactivation_window";

// Compute the exact moment when a closed account will exit its 30-day
// reactivation window. Keeping the computation here means callers never
// open-code the arithmetic.
export function computeScheduledAccountDeleteAt(closedAt: Date): Date {
  return new Date(closedAt.getTime() + REACTIVATION_WINDOW_DAYS * MS_PER_DAY);
}

// Is the account currently active? Active means `closedAt` is null.
// Downstream guards read this to refuse normal authenticated access for
// closed accounts, refuse session revival, and refuse collaborative
// actions until the account is either reactivated or permanently deleted.
export function isAccountActive(row: AccountClosureTimestamps): boolean {
  return row.closedAt === null;
}

export function isAccountClosed(row: AccountClosureTimestamps): boolean {
  return row.closedAt !== null;
}

// Has a closed account outlived its reactivation window? Returns false
// for active accounts so the permanent-deletion sweep never mistakes an
// active account for a delete candidate.
export function isPastReactivationWindow(row: AccountClosureTimestamps, now: Date): boolean {
  if (row.closedAt === null) return false;
  if (row.scheduledDeleteAt === null) return false;
  return now.getTime() >= row.scheduledDeleteAt.getTime();
}

// Derive the tri-state lifecycle label. Centralizing this keeps the
// state machine pinned to the two timestamps: anything that reasons about
// "where is this account in the closure lifecycle" should go through
// `deriveAccountClosureState`.
export function deriveAccountClosureState(row: AccountClosureTimestamps, now: Date): AccountClosureState {
  if (row.closedAt === null) return "active";
  if (isPastReactivationWindow(row, now)) return "closed_past_reactivation_window";
  return "closed_reactivable";
}

// Is the account inside its reactivation window? The sign-in flow uses
// this to decide whether the user can still self-service reactivate
// through a fresh sign-in plus fresh second factor when 2FA is enabled,
// or whether the closure has expired and the account should be treated
// as a permanent-delete candidate instead.
export function isWithinReactivationWindow(row: AccountClosureTimestamps, now: Date): boolean {
  if (row.closedAt === null) return false;
  return !isPastReactivationWindow(row, now);
}
