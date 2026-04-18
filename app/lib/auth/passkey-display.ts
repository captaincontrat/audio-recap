// Pure presentation helpers for enrolled passkey metadata. The Better Auth
// `/passkey/list-user-passkeys` endpoint returns rows that include a device
// type hint and a "backed up" flag (true when the credential syncs across
// the user's devices via a platform credential manager). The settings UI
// formats these into a single-line summary next to each row.

export type PasskeyDisplayRow = {
  name?: string | null;
  deviceType: string;
  backedUp: boolean;
  createdAt: string | Date | null | undefined;
};

export function describePasskeyName(row: Pick<PasskeyDisplayRow, "name">): string {
  const trimmed = typeof row.name === "string" ? row.name.trim() : "";
  return trimmed.length > 0 ? trimmed : "Unnamed passkey";
}

export function describePasskey(row: PasskeyDisplayRow): string {
  const sync = row.backedUp ? "synced" : "device-bound";
  const createdLabel = formatPasskeyCreatedAt(row.createdAt);
  return `${row.deviceType} · ${sync} · added ${createdLabel}`;
}

function formatPasskeyCreatedAt(createdAt: PasskeyDisplayRow["createdAt"]): string {
  if (!createdAt) {
    return "Unknown date";
  }
  const parsed = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown date";
  }
  // `toLocaleDateString()` without explicit options follows the host's
  // locale — fine for the UI, deterministic enough for tests that compare
  // to the same formatted string computed from a known Date.
  return parsed.toLocaleDateString();
}
