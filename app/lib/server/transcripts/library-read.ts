import "server-only";

import { isWorkspaceActive } from "@/lib/server/workspaces/archival-state";
import { WorkspaceAccessDeniedError, WorkspaceNotFoundError } from "@/lib/server/workspaces/errors";
import { resolveWorkspaceContextFromSlug } from "@/lib/server/workspaces/resolver";

import { LibraryReadRefusedError } from "./errors";
import { type ListTranscriptsForWorkspaceResult, listTranscriptsForWorkspace } from "./queries";
import { type LibraryQueryOptions, LibraryQueryParseError, type LibraryRawQuery, parseLibraryQueryOptions } from "./query-options";

// Library read service owned by `add-transcript-management`. The spec
// requires:
//   1. the library surface is scoped to the current workspace resolved
//      from the explicit URL slug (see `add-workspace-foundation`)
//   2. the workspace must be active (see
//      `add-workspace-archival-lifecycle`) -- archived workspaces are
//      refused with a distinct reason so the UI can render the lockout
//   3. any read-capable role (`read_only`, `member`, `admin`) can list
//      the workspace's transcript records
//   4. out-of-workspace records stay hidden via the same not-found
//      behavior that the workspace-access resolver already produces
//   5. invalid query controls (bad sort, status, cursor, or limit) are
//      rejected so the UI can surface a "reset your filters" hint

export type LibraryReadInputs = {
  workspaceSlug: string;
  userId: string;
  query: LibraryRawQuery;
};

export type LibraryReadResult = ListTranscriptsForWorkspaceResult & {
  options: LibraryQueryOptions;
};

export async function readTranscriptLibrary(inputs: LibraryReadInputs): Promise<LibraryReadResult> {
  const context = await resolveContextOrRefuse({ slug: inputs.workspaceSlug, userId: inputs.userId });

  if (!isWorkspaceActive(context.workspace)) {
    throw new LibraryReadRefusedError("workspace_archived");
  }

  const options = parseOptionsOrRefuse(inputs.query);
  const page = await listTranscriptsForWorkspace({ workspaceId: context.workspace.id, options });

  return { ...page, options };
}

async function resolveContextOrRefuse(args: { slug: string; userId: string }) {
  try {
    return await resolveWorkspaceContextFromSlug(args);
  } catch (error) {
    if (error instanceof WorkspaceNotFoundError) {
      throw new LibraryReadRefusedError("not_found");
    }
    if (error instanceof WorkspaceAccessDeniedError) {
      throw new LibraryReadRefusedError("access_denied");
    }
    throw error;
  }
}

function parseOptionsOrRefuse(query: LibraryRawQuery): LibraryQueryOptions {
  try {
    return parseLibraryQueryOptions(query);
  } catch (error) {
    if (error instanceof LibraryQueryParseError) {
      throw new LibraryReadRefusedError("invalid_query", error.message);
    }
    throw error;
  }
}
