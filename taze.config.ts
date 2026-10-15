import { defineConfig } from "taze";

export default defineConfig({
  ignorePaths: ["**/node_modules/**", "**/dist/**", "**/.alchemy/**"],
  // Exact-pinned deps (e.g. `@cloudflare/workers-types`, `oxlint`) are
  // skipped by default — include them so `bun run update` really sees everything.
  includeLocked: true,
  // Scan subdirectories for package.json so this keeps working if the repo
  // grows into a multi-package monorepo (run via `taze -r` scripts below).
  recursive: true,
});
