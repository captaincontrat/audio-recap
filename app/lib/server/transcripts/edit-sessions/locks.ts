import "server-only";

import { getRedisConnection } from "@/lib/server/queue/connection";

import { SESSION_EXPIRY_MS } from "./constants";
import { generateLockToken } from "./ids";
import { sessionExpirySeconds } from "./session-decisions";

// Redis-backed primitives for transcript markdown edit locks. Lock
// state is intentionally ephemeral - Postgres remains the durable
// store for saved markdown and session history lives only for as long
// as the TTL allows.
//
// Each lock is serialized as a JSON blob under a transcript-scoped
// key. The value carries the tab identity, user id, lock token (the
// opaque bearer credential returned to the client), and the last
// heartbeat moment. Mutations are guarded by a Lua script so acquire
// and renew are atomic even under concurrent callers.

const LOCK_KEY_PREFIX = "transcript:edit-lock:";

// Workspace-scoped index key used by the archive side-effect to
// enumerate every active edit lock that needs releasing when the
// owning workspace is archived. We keep the full transcript key in a
// set so the archive flow can delete the lock records in bulk
// without scanning the entire Redis keyspace.
const WORKSPACE_INDEX_PREFIX = "transcript:edit-lock:workspace:";

function lockKeyFor(transcriptId: string): string {
  return `${LOCK_KEY_PREFIX}${transcriptId}`;
}

function workspaceIndexKeyFor(workspaceId: string): string {
  return `${WORKSPACE_INDEX_PREFIX}${workspaceId}`;
}

export type StoredLock = {
  transcriptId: string;
  workspaceId: string;
  userId: string;
  tabId: string;
  lockToken: string;
  acquiredAt: number;
  lastHeartbeatAt: number;
};

export type LockSnapshot = StoredLock;

// Acquire a fresh edit lock if nothing is currently holding it. Uses
// `SET key value NX EX ttl` for atomic "create-only" semantics so a
// concurrent caller cannot win the race. The workspace index is only
// updated when acquisition succeeds; callers should treat the absence
// of a returned snapshot as "another session already owns the lock".
export type AcquireInput = {
  transcriptId: string;
  workspaceId: string;
  userId: string;
  tabId: string;
  now: number;
};

export type AcquireResult = { kind: "acquired"; lock: StoredLock } | { kind: "conflict"; existing: StoredLock };

export async function acquireLock(input: AcquireInput): Promise<AcquireResult> {
  const redis = getRedisConnection();
  const lockToken = generateLockToken();
  const payload: StoredLock = {
    transcriptId: input.transcriptId,
    workspaceId: input.workspaceId,
    userId: input.userId,
    tabId: input.tabId,
    lockToken,
    acquiredAt: input.now,
    lastHeartbeatAt: input.now,
  };
  const key = lockKeyFor(input.transcriptId);
  const serialized = JSON.stringify(payload);
  const response = await redis.set(key, serialized, "PX", SESSION_EXPIRY_MS, "NX");
  if (response !== "OK") {
    const existing = await inspectLock(input.transcriptId);
    if (!existing) {
      // The lock was released between the conflicting `SET NX` and
      // the follow-up `GET`. Recursively retrying once is safe
      // because the TTL guarantees the lock cannot be stuck; but
      // staying non-recursive keeps control flow boring.
      return acquireLock(input);
    }
    return { kind: "conflict", existing };
  }
  await redis.sadd(workspaceIndexKeyFor(input.workspaceId), key);
  return { kind: "acquired", lock: payload };
}

// Read the current lock without mutating it. Returns `null` when no
// lock is active. Used by the session-entry decision to tell same-tab
// resume apart from cross-tab conflict, and by the archive side
// effect to collect lock owners for teardown.
export async function inspectLock(transcriptId: string): Promise<StoredLock | null> {
  const redis = getRedisConnection();
  const raw = await redis.get(lockKeyFor(transcriptId));
  if (!raw) return null;
  return parseLock(raw);
}

// Renew an existing lock's TTL and heartbeat timestamp - but only if
// the caller still presents the correct lock token. The compare-and-
// swap semantics are important: without them a zombie client could
// extend a lock that a new owner just acquired. Returns the updated
// snapshot on success and `null` when the caller no longer owns the
// lock. A `null` return should be treated as "session lost" by the
// caller.
export type RenewInput = {
  transcriptId: string;
  lockToken: string;
  now: number;
};

export async function renewLock(input: RenewInput): Promise<StoredLock | null> {
  const redis = getRedisConnection();
  const key = lockKeyFor(input.transcriptId);
  const existing = await inspectLock(input.transcriptId);
  if (!existing) return null;
  if (existing.lockToken !== input.lockToken) return null;
  const updated: StoredLock = { ...existing, lastHeartbeatAt: input.now };
  // Use a Lua script to re-check the token immediately before the
  // write so a race that replaces the lock between `GET` and `SET`
  // cannot accidentally revive the previous owner's session.
  const serialized = JSON.stringify(updated);
  const result = await redis.eval(RENEW_LOCK_SCRIPT, 1, key, input.lockToken, serialized, String(SESSION_EXPIRY_MS));
  if (result !== 1) return null;
  return updated;
}

// Release a lock unconditionally when the caller can prove ownership,
// or forcibly when the archival side effect tears down the session.
// Returning a boolean lets callers know whether they actually removed
// state (useful for metrics / idempotency reporting).
export type ReleaseInput = {
  transcriptId: string;
  // When present, the lock is only released if the stored token
  // matches. The archival teardown passes `force: true` to release
  // whichever lock happens to exist without having to know the token.
  lockToken?: string;
  force?: boolean;
};

export async function releaseLock(input: ReleaseInput): Promise<boolean> {
  const redis = getRedisConnection();
  const key = lockKeyFor(input.transcriptId);
  const existing = await inspectLock(input.transcriptId);
  if (!existing) return false;
  if (!input.force) {
    if (!input.lockToken || existing.lockToken !== input.lockToken) return false;
  }
  // The Lua script ensures the compare-and-delete is atomic under
  // concurrent callers. Force releases pass the sentinel `*` to skip
  // the token check.
  const token = input.force ? "*" : (input.lockToken as string);
  const deleted = await redis.eval(RELEASE_LOCK_SCRIPT, 1, key, token);
  if (deleted === 1) {
    await redis.srem(workspaceIndexKeyFor(existing.workspaceId), key);
    return true;
  }
  return false;
}

// Enumerate every transcript id whose lock currently belongs to the
// provided workspace. Used by the archival side effect to release all
// in-flight edit sessions in lockstep with the workspace transition.
export async function listActiveLocksForWorkspace(workspaceId: string): Promise<ReadonlyArray<StoredLock>> {
  const redis = getRedisConnection();
  const indexKey = workspaceIndexKeyFor(workspaceId);
  const keys: string[] = await redis.smembers(indexKey);
  const locks: StoredLock[] = [];
  const stale: string[] = [];
  for (const key of keys) {
    const raw = await redis.get(key);
    if (!raw) {
      stale.push(key);
      continue;
    }
    const parsed = parseLock(raw);
    if (parsed) locks.push(parsed);
  }
  if (stale.length > 0) {
    await redis.srem(indexKey, ...stale);
  }
  return locks;
}

// Release every lock held by the archived workspace. Returns the
// number of locks that were actually removed so the archive side
// effect can emit a structured metric.
export async function releaseAllLocksForWorkspace(workspaceId: string): Promise<{ released: number }> {
  const locks = await listActiveLocksForWorkspace(workspaceId);
  let released = 0;
  for (const lock of locks) {
    const removed = await releaseLock({ transcriptId: lock.transcriptId, force: true });
    if (removed) released += 1;
  }
  const redis = getRedisConnection();
  await redis.del(workspaceIndexKeyFor(workspaceId));
  return { released };
}

function parseLock(raw: string): StoredLock | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as Record<string, unknown>;
    const { transcriptId, workspaceId, userId, tabId, lockToken, acquiredAt, lastHeartbeatAt } = obj;
    if (
      typeof transcriptId !== "string" ||
      typeof workspaceId !== "string" ||
      typeof userId !== "string" ||
      typeof tabId !== "string" ||
      typeof lockToken !== "string" ||
      typeof acquiredAt !== "number" ||
      typeof lastHeartbeatAt !== "number"
    ) {
      return null;
    }
    return { transcriptId, workspaceId, userId, tabId, lockToken, acquiredAt, lastHeartbeatAt };
  } catch {
    return null;
  }
}

// Re-export the TTL helper so API handlers that want to advertise the
// server-authoritative expiry (for UI countdowns) do not need to
// re-derive it.
export { sessionExpirySeconds };

// Atomic compare-and-write renewal. Returns 1 when the caller's token
// still matches, 0 otherwise.
const RENEW_LOCK_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then
  return 0
end
local stored = cjson.decode(raw)
if stored.lockToken ~= ARGV[1] then
  return 0
end
redis.call('SET', KEYS[1], ARGV[2], 'PX', tonumber(ARGV[3]))
return 1
`;

// Atomic compare-and-delete release. ARGV[1] equals `*` for forced
// archival-triggered releases and the lock token otherwise.
const RELEASE_LOCK_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then
  return 0
end
if ARGV[1] == '*' then
  redis.call('DEL', KEYS[1])
  return 1
end
local stored = cjson.decode(raw)
if stored.lockToken ~= ARGV[1] then
  return 0
end
redis.call('DEL', KEYS[1])
return 1
`;
