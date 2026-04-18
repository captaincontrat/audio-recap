// Thin HTTP client for the transcript edit-session routes. Keeps
// request/response shapes colocated with the route handlers so the
// React hook can focus on state machine logic rather than wire
// formats.

export type EditSessionContext = {
  transcriptId: string;
  lockToken: string;
  expiresAt: string;
  reconnectWindowMs: number;
  transcript: {
    id: string;
    workspaceId: string;
    transcriptMarkdown: string;
    recapMarkdown: string;
    updatedAt: string;
  };
};

export type EditSessionRefusalReason = "not_found" | "access_denied" | "workspace_archived" | "role_not_authorized" | "already_locked" | "session_expired";

export class EditSessionRefusedError extends Error {
  readonly reason: EditSessionRefusalReason;
  readonly status: number;
  constructor(reason: EditSessionRefusalReason, status: number, message: string) {
    super(message);
    this.name = "EditSessionRefusedError";
    this.reason = reason;
    this.status = status;
  }
}

export class EditSessionNetworkError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "EditSessionNetworkError";
    this.code = code;
  }
}

type EnterSessionInputs = {
  workspaceSlug: string;
  transcriptId: string;
  tabId: string;
};

type ResumeSessionInputs = EnterSessionInputs;

type AutosaveInputs = {
  workspaceSlug: string;
  transcriptId: string;
  tabId: string;
  lockToken: string;
  patch: Partial<Record<"transcriptMarkdown" | "recapMarkdown", string>>;
};

type ExitSessionInputs = {
  workspaceSlug: string;
  transcriptId: string;
  lockToken: string;
};

const REFUSAL_CODES: readonly EditSessionRefusalReason[] = [
  "not_found",
  "access_denied",
  "workspace_archived",
  "role_not_authorized",
  "already_locked",
  "session_expired",
];

function isRefusalCode(value: string): value is EditSessionRefusalReason {
  return (REFUSAL_CODES as readonly string[]).includes(value);
}

function sessionUrl(workspaceSlug: string, transcriptId: string, suffix = ""): string {
  return `/api/workspaces/${encodeURIComponent(workspaceSlug)}/transcripts/${encodeURIComponent(transcriptId)}/edit-session${suffix}`;
}

async function postJson<T>(url: string, body: unknown, method: "POST" | "DELETE" = "POST"): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new EditSessionNetworkError("network_error", err instanceof Error ? err.message : "Network request failed");
  }

  const payload = (await response.json().catch(() => null)) as
    | { ok: true; session?: EditSessionContext }
    | { ok: false; code?: string; message?: string }
    | null;

  if (!payload) {
    throw new EditSessionNetworkError("empty_response", "The server returned an empty response.");
  }

  if (payload.ok === false) {
    if (payload.code && isRefusalCode(payload.code)) {
      throw new EditSessionRefusedError(payload.code, response.status, payload.message ?? "Edit session refused");
    }
    throw new EditSessionNetworkError(payload.code ?? "unknown_error", payload.message ?? "The server refused the request");
  }
  return payload as unknown as T;
}

export async function enterEditSession(inputs: EnterSessionInputs): Promise<EditSessionContext> {
  const payload = await postJson<{ ok: true; session: EditSessionContext }>(sessionUrl(inputs.workspaceSlug, inputs.transcriptId), {
    intent: "enter",
    tabId: inputs.tabId,
  });
  return payload.session;
}

export async function resumeEditSession(inputs: ResumeSessionInputs): Promise<EditSessionContext> {
  const payload = await postJson<{ ok: true; session: EditSessionContext }>(sessionUrl(inputs.workspaceSlug, inputs.transcriptId), {
    intent: "resume",
    tabId: inputs.tabId,
  });
  return payload.session;
}

export async function autosaveEditSession(inputs: AutosaveInputs): Promise<EditSessionContext> {
  const payload = await postJson<{ ok: true; session: EditSessionContext }>(sessionUrl(inputs.workspaceSlug, inputs.transcriptId, "/autosave"), {
    tabId: inputs.tabId,
    lockToken: inputs.lockToken,
    patch: inputs.patch,
  });
  return payload.session;
}

export async function exitEditSession(inputs: ExitSessionInputs): Promise<void> {
  await postJson<{ ok: true }>(sessionUrl(inputs.workspaceSlug, inputs.transcriptId), { lockToken: inputs.lockToken }, "DELETE");
}
