import { defineConfig } from "oxfmt";
import base from "ultracite/oxfmt";

export default defineConfig({
  ...base,
  ignorePatterns: [
    ...(base.ignorePatterns ?? []),
    ".vscode/**",
    // Vendored anti-slop plugin sources (see tools/oxlint/anti-slop/UPSTREAM.md).
    "tools/oxlint/anti-slop/**",
  ],
});
