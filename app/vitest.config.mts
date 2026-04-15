import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: "./test/setup.ts",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
      exclude: ["**/*.test.{ts,tsx}", "test/**"],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
  },
});
