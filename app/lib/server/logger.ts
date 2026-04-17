import "server-only";

import { randomUUID } from "node:crypto";

import pino, { type Logger, type LoggerOptions } from "pino";

import { getServerEnv } from "@/lib/server/env";

type RuntimeName = "web" | "worker";

type CreateBaseLoggerOptions = {
  runtime: RuntimeName;
  overrides?: LoggerOptions;
};

function detectRuntime(): RuntimeName {
  return process.env.APP_RUNTIME === "worker" ? "worker" : "web";
}

function buildLoggerOptions(runtime: RuntimeName): LoggerOptions {
  const env = getServerEnv();

  const base: LoggerOptions = {
    level: env.LOG_LEVEL,
    base: {
      runtime,
      env: env.NODE_ENV,
    },
    redact: {
      paths: ["password", "*.password", "token", "*.token", "email", "*.email", "authorization", "*.authorization"],
      censor: "[redacted]",
    },
  };

  if (env.NODE_ENV === "development") {
    return {
      ...base,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:HH:MM:ss.l",
          singleLine: false,
          ignore: "pid,hostname,runtime,env",
        },
      },
    };
  }

  return base;
}

let rootLogger: Logger | undefined;

export function createBaseLogger(options: CreateBaseLoggerOptions = { runtime: detectRuntime() }): Logger {
  return pino({ ...buildLoggerOptions(options.runtime), ...(options.overrides ?? {}) });
}

export function getLogger(): Logger {
  if (!rootLogger) {
    rootLogger = createBaseLogger();
  }
  return rootLogger;
}

export function childLogger(bindings: Record<string, unknown>): Logger {
  return getLogger().child(bindings);
}

export type HttpRequestContext = {
  method: string;
  url: string | URL;
  headers?: Headers | Record<string, string | string[] | undefined>;
};

export function requestLogger(request: HttpRequestContext, extra: Record<string, unknown> = {}): Logger {
  const requestId = readHeader(request.headers, "x-request-id") ?? randomUUID();
  const url = typeof request.url === "string" ? request.url : request.url.toString();
  const parsedPath = safePath(url);
  return childLogger({
    component: "http",
    requestId,
    method: request.method.toUpperCase(),
    path: parsedPath,
    ...extra,
  });
}

export type JobContext = {
  queue: string;
  jobName: string;
  jobId?: string | number | null;
  attempt?: number;
};

export function jobLogger(context: JobContext, extra: Record<string, unknown> = {}): Logger {
  return childLogger({
    component: "queue",
    queue: context.queue,
    jobName: context.jobName,
    jobId: context.jobId ?? null,
    attempt: context.attempt ?? null,
    ...extra,
  });
}

export function resetLoggerForTests() {
  rootLogger = undefined;
}

function readHeader(headers: HttpRequestContext["headers"], name: string): string | undefined {
  if (!headers) return undefined;

  if (headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }

  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== target) continue;
    return Array.isArray(value) ? value[0] : value;
  }
  return undefined;
}

function safePath(url: string): string {
  try {
    return new URL(url, "http://local").pathname;
  } catch {
    return url;
  }
}
