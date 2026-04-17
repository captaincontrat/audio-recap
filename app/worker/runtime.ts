import { type Job, Worker } from "bullmq";

import { childLogger, jobLogger } from "@/lib/server/logger";
import { getRedisConnection } from "@/lib/server/queue/connection";

type BullWorker = Worker;

const workers: BullWorker[] = [];

export async function startWorkers(): Promise<void> {
  // Reduced-bootstrap scope does not define transcript-processing jobs yet.
  // The worker runtime exists now so follow-up changes only need to register
  // processors here without reopening platform-topology decisions.
  //
  // Keep the process alive even when no workers are registered so deployments
  // can boot the dyno independently of follow-up change rollouts.
  if (workers.length === 0) {
    childLogger({ component: "worker.runtime" }).info("no workers registered; worker runtime idle");
  }
}

export async function stopWorkers(): Promise<void> {
  const stopping = workers.map((worker) => worker.close());
  workers.length = 0;
  await Promise.all(stopping);
}

type JobProcessor<TData, TResult> = (job: Job<TData>) => Promise<TResult>;

export function registerWorker<TData, TResult>(queueName: string, processor: JobProcessor<TData, TResult>): BullWorker {
  const worker = new Worker<TData, TResult>(
    queueName,
    async (job) => {
      const log = jobLogger({ queue: queueName, jobName: job.name, jobId: job.id, attempt: job.attemptsMade });
      log.info("job started");
      try {
        const result = await processor(job);
        log.info("job completed");
        return result;
      } catch (err) {
        log.error({ err }, "job failed");
        throw err;
      }
    },
    {
      connection: getRedisConnection(),
      concurrency: 1,
    },
  );

  worker.on("error", (err) => childLogger({ component: "worker.runtime", queue: queueName }).error({ err }, "worker error"));
  workers.push(worker);
  return worker;
}
