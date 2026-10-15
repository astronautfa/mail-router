import { defineConfig } from "vite-plus";

/**
 * Vite+ (`vp`) is the project toolchain: `vp check` (Oxfmt + Oxlint + tsgo
 * type-check), `vp test` (Vitest 5), and `vp fmt`/`vp lint`.
 *
 * Alchemy owns deployment and bundles the Worker itself, so this config only
 * carries the Vite+ blocks — there is no client build here.
 */
export default defineConfig({
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
  },
});
