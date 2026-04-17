import "server-only";

import IORedis, { type Redis, type RedisOptions } from "ioredis";

import { getServerEnv } from "@/lib/server/env";

const BULLMQ_REQUIRED_OPTIONS: Pick<RedisOptions, "maxRetriesPerRequest" | "enableReadyCheck"> = {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
};

let connection: Redis | undefined;

export function getRedisConnection(): Redis {
  if (!connection) {
    const env = getServerEnv();
    connection = new IORedis(env.REDIS_URL, {
      ...BULLMQ_REQUIRED_OPTIONS,
      lazyConnect: false,
    });
  }
  return connection;
}

export async function closeRedisConnection(): Promise<void> {
  if (connection) {
    try {
      await connection.quit();
    } finally {
      connection = undefined;
    }
  }
}
