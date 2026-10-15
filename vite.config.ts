import { defineConfig } from "vite-plus";

import oxfmtConfig from "./oxfmt.config.ts";
import oxlintConfig from "./oxlint.config.ts";

/**
 * Vite+ (`vp`) is the project toolchain: `vp check` (Oxfmt + Oxlint + tsgo
 * type-check), `vp test` (Vitest 5), and `vp fmt`/`vp lint`.
 *
 * Lint and format policy lives in `oxlint.config.ts` (Ultracite core + vitest
 * presets plus the vendored anti-slop plugins) and `oxfmt.config.ts`
 * (Ultracite style). Both files are also the canonical configs for running
 * the `oxlint`/`oxfmt` binaries directly; they are reused here so `vp`
 * enforces the identical policy.
 *
 * Alchemy owns deployment and bundles the Worker itself, so this config only
 * carries the Vite+ blocks — there is no client build here.
 */
export default defineConfig({
  fmt: oxfmtConfig,
  lint: {
    ...oxlintConfig,
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
  },
});
