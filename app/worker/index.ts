import "dotenv/config";

import { closeDb } from "@/lib/server/db/client";
import { childLogger } from "@/lib/server/logger";
import { closeRedisConnection } from "@/lib/server/queue/connection";
import { closeQueues } from "@/lib/server/queue/queues";
import { registerWorkspaceArchiveSideEffects } from "@/lib/server/workspaces/bootstrap";
import { startWorkers, stopWorkers } from "@/worker/runtime";

process.env.APP_RUNTIME = "worker";

const log = childLogger({ component: "worker.bootstrap" });

async function main() {
  log.info("worker starting");
  registerWorkspaceArchiveSideEffects();
  await startWorkers();
  log.info("worker ready");
}

async function shutdown(reason: string) {
  log.info({ reason }, "worker shutting down");
  try {
    await stopWorkers();
    await closeQueues();
    await closeRedisConnection();
    await closeDb();
  } catch (err) {
    log.error({ err }, "worker shutdown failure");
    process.exitCode = 1;
  }
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void shutdown(signal).finally(() => process.exit(process.exitCode ?? 0));
  });
}

main().catch((err) => {
  log.error({ err }, "worker bootstrap failure");
  void shutdown("bootstrap-error").finally(() => process.exit(1));
});
