import { childLogger } from "@/lib/server/logger";
import { registerWorkspaceArchiveSideEffects } from "@/lib/server/workspaces/bootstrap";

// Next.js runs this module once per server boot in both the node and
// edge runtimes. We gate the workspace-capability registration on the
// node runtime because every downstream side effect touches the
// Postgres client, which only works under node.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }
  registerWorkspaceArchiveSideEffects();
  childLogger({ component: "instrumentation" }).debug("workspace archive side effects registered");
}
