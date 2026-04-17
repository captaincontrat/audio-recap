import "dotenv/config";

import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL must be set to generate or run Drizzle migrations.");
}

export default defineConfig({
  schema: "./lib/server/db/schema.ts",
  out: "./lib/server/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: databaseUrl },
  casing: "snake_case",
  strict: true,
  verbose: true,
});
