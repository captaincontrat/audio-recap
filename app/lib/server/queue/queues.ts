import "server-only";

import { Queue } from "bullmq";

import { getRedisConnection } from "@/lib/server/queue/connection";

export const QUEUE_NAMES = {
  // Reserved for future transcript-processing work introduced by later changes.
  // Declaring the name here keeps producers and workers aligned on a single identifier.
  meetings: "meetings",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

const queues = new Map<QueueName, Queue>();

export function getQueue<TName extends QueueName>(name: TName): Queue {
  const existing = queues.get(name);
  if (existing) return existing;

  const queue = new Queue(name, {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: { age: 3_600, count: 1_000 },
      removeOnFail: { age: 24 * 3_600 },
    },
  });
  queues.set(name, queue);
  return queue;
}

export async function closeQueues(): Promise<void> {
  const closing = Array.from(queues.values()).map((queue) => queue.close());
  queues.clear();
  await Promise.all(closing);
}
