// Shared configuration for the Better Auth `twoFactor` plugin and the
// application-layer recent-auth rules that sit on top of it. The constants
// below are the single source of truth — both the plugin registration in
// `instance.ts` and the client UX (timers, help copy) read from this file
// so windows never drift between layers.

// How long the user has to finish a second-factor challenge after reaching
// a valid first factor. Matches the default of Better Auth's `twoFactor`
// plugin (10 minutes). The plugin issues a short-lived cookie during the
// challenge; once that cookie expires the user must restart from sign-in.
export const TWO_FACTOR_COOKIE_MAX_AGE_SECONDS = 10 * 60;

// How long a device stays trusted after the user successfully completes
// 2FA and asks to "trust this device". Thirty days balances the UX cost
// of frequent prompts against the security cost of a long-lived trust
// cookie, and matches the plugin's default.
export const TRUST_DEVICE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

// Lifetime of a single email-OTP second factor code, expressed in
// minutes because that is what Better Auth's plugin expects. Three
// minutes keeps the window tight enough to limit brute-force attempts
// while still allowing for email delivery latency.
export const TWO_FACTOR_OTP_PERIOD_MINUTES = 3;

// Digits in the email OTP code. Six digits stays compatible with the
// widely-used OTP UX (copy/paste, autofill) while keeping the keyspace
// large enough for the rate-limited challenge path.
export const TWO_FACTOR_OTP_DIGITS = 6;

// Lifetime of the recent-auth marker on a session. Sensitive
// auth-management actions (managing 2FA settings, regenerating backup
// codes, revoking trusted devices) require this marker to be recent. Five
// minutes keeps the prompt usable for a focused settings flow without
// leaving stale elevation open indefinitely.
export const RECENT_AUTH_MAX_AGE_SECONDS = 5 * 60;
