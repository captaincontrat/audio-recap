import { jsonResponse, serverError } from "@/lib/auth/api-response";
import { evaluateProtectedApiRequest } from "@/lib/auth/guards";
import { LIBRARY_DEFAULT_PAGE_SIZE, libraryReadRefusalToHttpStatus, LibraryReadRefusedError, readTranscriptLibrary } from "@/lib/server/transcripts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Library list endpoint used by "Load more" pagination and any client
// that needs to re-fetch the library after a filter change. The
// authoritative first page is also produced by the server component,
// so this endpoint mirrors the same projection shape.
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const guard = await evaluateProtectedApiRequest(request.headers);
  if (!guard.ok) {
    return jsonResponse({ ok: false, code: guard.code, message: guard.message }, { status: guard.status });
  }

  const { slug } = await context.params;
  const url = new URL(request.url);
  const query = {
    search: url.searchParams.get("search"),
    sort: url.searchParams.get("sort"),
    status: url.searchParams.get("status"),
    cursor: url.searchParams.get("cursor"),
    limit: url.searchParams.get("limit"),
  };

  try {
    const result = await readTranscriptLibrary({
      workspaceSlug: slug,
      userId: guard.context.user.id,
      query,
    });
    return jsonResponse({
      ok: true,
      items: result.items,
      nextCursor: result.nextCursor,
      pageSize: result.options.limit,
      defaultPageSize: LIBRARY_DEFAULT_PAGE_SIZE,
    });
  } catch (error) {
    if (error instanceof LibraryReadRefusedError) {
      return jsonResponse({ ok: false, code: error.reason, message: error.message }, { status: libraryReadRefusalToHttpStatus(error.reason) });
    }
    console.error("[transcripts.library] read failed", error);
    return serverError("Could not load the transcript library.");
  }
}
