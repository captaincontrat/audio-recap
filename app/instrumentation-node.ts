// Node-only side of the Next.js `instrumentation` convention. This
// module is imported dynamically from `instrumentation.ts` and only
// when `NEXT_RUNTIME === "nodejs"`, so it is safe to pull in Node
// built-ins (`node:crypto` via logger/workspaces) at the top level.
// Keeping the node-specific imports in a separate file ensures the
// Edge bundler never analyzes them, which would otherwise surface as
// "A Node.js module is loaded which is not supported in the Edge
// Runtime" warnings in dev.
// See: https://nextjs.org/docs/app/guides/instrumentation#importing-runtime-specific-code
import { childLogger } from "@/lib/server/logger";
import { registerWorkspaceArchiveSideEffects } from "@/lib/server/workspaces/bootstrap";

registerWorkspaceArchiveSideEffects();
childLogger({ component: "instrumentation" }).debug("workspace archive side effects registered");
