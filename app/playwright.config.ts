import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

const e2eEnv = {
  NODE_ENV: "test",
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "test-secret-test-secret-test-secret-test-secret",
  BETTER_AUTH_URL: baseURL,
  DATABASE_URL: process.env.DATABASE_URL ?? "postgres://summitdown:summitdown@127.0.0.1:5432/summitdown_test",
  REDIS_URL: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
  EMAIL_PROVIDER: "memory",
  EMAIL_FROM: "no-reply@test.summitdown.local",
  LOG_LEVEL: "error",
};

export default defineConfig({
  testDir: "./test",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm db:migrate && pnpm build && pnpm start",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180 * 1000,
    env: e2eEnv,
  },
});
