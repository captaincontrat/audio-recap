import "server-only";

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as schema from "@/lib/server/db/schema";
import { getServerEnv } from "@/lib/server/env";

type Database = PostgresJsDatabase<typeof schema>;

let sql: Sql | undefined;
let db: Database | undefined;

export function getSql(): Sql {
  if (!sql) {
    const env = getServerEnv();
    sql = postgres(env.DATABASE_URL, {
      max: env.NODE_ENV === "production" ? 10 : 4,
      idle_timeout: 20,
    });
  }
  return sql;
}

export function getDb(): Database {
  if (!db) {
    db = drizzle(getSql(), { schema });
  }
  return db;
}

export async function closeDb(): Promise<void> {
  if (sql) {
    await sql.end({ timeout: 5 });
    sql = undefined;
    db = undefined;
  }
}

export type { Database };
