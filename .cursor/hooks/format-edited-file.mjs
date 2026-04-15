#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";

const SUPPORTED_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".cts",
  ".js",
  ".json",
  ".jsonc",
  ".jsx",
  ".md",
  ".mdx",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
]);

const PACKAGE_ROOTS = [
  {
    prefix: "app",
    directory: "app",
  },
  {
    prefix: path.join("libs", "audio-recap"),
    directory: path.join("libs", "audio-recap"),
  },
];

async function readStdin() {
  const chunks = [];

  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

function isWithinDirectory(relativePath, prefix) {
  return relativePath === prefix || relativePath.startsWith(`${prefix}${path.sep}`);
}

function getPackageForFile(workspaceRoot, filePath) {
  const relativePath = path.relative(workspaceRoot, filePath);

  if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null;
  }

  return PACKAGE_ROOTS.find((pkg) => isWithinDirectory(relativePath, pkg.prefix)) ?? null;
}

function main(payload) {
  const workspaceRoot = path.resolve(process.env.CURSOR_PROJECT_DIR || process.cwd());
  const filePath = typeof payload?.file_path === "string" ? payload.file_path : "";

  if (!filePath) {
    return;
  }

  const extension = path.extname(filePath).toLowerCase();

  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    return;
  }

  const targetPackage = getPackageForFile(workspaceRoot, filePath);

  if (!targetPackage) {
    return;
  }

  const packageRoot = path.join(workspaceRoot, targetPackage.directory);
  const packageRelativePath = path.relative(packageRoot, filePath);

  if (!packageRelativePath || packageRelativePath.startsWith("..") || path.isAbsolute(packageRelativePath)) {
    return;
  }

  const result = spawnSync("pnpm", ["exec", "biome", "format", "--write", packageRelativePath], {
    cwd: packageRoot,
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.error) {
    console.error(`[format-edited-file] Failed to start formatter: ${result.error.message}`);
    return;
  }

  if (result.status !== 0 && result.stderr.trim()) {
    console.error(result.stderr.trim());
  }
}

const rawInput = await readStdin();

if (!rawInput.trim()) {
  process.exit(0);
}

try {
  main(JSON.parse(rawInput));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[format-edited-file] ${message}`);
}
