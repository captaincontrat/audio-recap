// Next.js invokes `register` once per server boot in both the Node
// and Edge runtimes. The node-only work (logger, workspace bootstrap,
// anything that touches `node:crypto` or Postgres) lives in a
// dedicated `instrumentation-node.ts` file so the Edge bundler never
// walks that import graph. The `NEXT_RUNTIME === "nodejs"` check is a
// compile-time constant, which lets Next.js / Turbopack strip the
// dynamic import from the Edge bundle entirely.
// See: https://nextjs.org/docs/app/guides/instrumentation#importing-runtime-specific-code
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
