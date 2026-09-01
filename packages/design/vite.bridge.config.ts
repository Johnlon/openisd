/**
 * Builds `packages/design/dist/openisd-bridge.js` — the single-file IIFE embedded-V8 bridge
 * `winisd_tools` loads into mini-racer (DESIGN.md §12.5). Vite library mode is used instead
 * of adding a new bundler because vite ^8.0.16 is already a root devDependency and its
 * production build path is Rollup, which is what a single-entry, no-externals, IIFE library
 * needs — no new devDependency, no second bundler to keep in sync with the rest of the repo's
 * build.
 *
 * `rollupOptions.external` is left empty deliberately: the `yaml` npm package
 * (`winisd/driverYmlToOpenisdAndWdr.ts`) MUST be inlined, not left as a runtime
 * import, because mini-racer's V8 has no module loader.
 */
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // `keepNames` preserves function names through the transform so a V8 stack trace crossing
  // mini-racer says `at toWinISDDriver (...)`, not `at t (...)` — crash diagnosability is
  // part of the bridge contract (QT69 notes).
  esbuild: { keepNames: true },
  build: {
    outDir: join(ROOT, 'dist'),
    emptyOutDir: false,
    target: 'es2020',
    // Minified: strips comments (including every inlined dependency's own), which is what
    // makes a mechanical "no real reference to a banned global" scan possible without a
    // false positive on a doc comment that merely NAMES one of these words — this file's own
    // docstrings do, deliberately, to explain the contract. The auditable form is the
    // TypeScript source (winisd/bridge.ts) and this config, both checked in; the dist artifact
    // is a build output like any other.
    // Terser, not esbuild, for the minify pass: `drop_console` must strip the console CALLS
    // from the INLINED `yaml` dependency too, and vite's `esbuild.drop` applies only to the
    // transform of the project's own sources. Runtime `logLevel: 'error'` silences the calls;
    // this deletes them, so the bundle's no-console property is true of the BYTES and the
    // property test can assert it mechanically. `keep_fnames` carries the keepNames guarantee
    // through this pass as well.
    minify: 'terser',
    terserOptions: { compress: { drop_console: true, drop_debugger: true }, mangle: { keep_fnames: true } },
    lib: {
      entry: join(ROOT, 'winisd', 'bridge.ts'),
      formats: ['iife'],
      name: 'OpenisdBridge',
      fileName: () => 'openisd-bridge.js',
    },
    rollupOptions: {
      external: [],
      output: {
        // No exports cross the IIFE wrapper — the bridge publishes its function by assigning
        // `globalThis.openisdYamlToWdr` itself (src/bridge.ts), not via the IIFE's own return
        // value, so nothing needs to read `window.OpenisdBridge`.
        extend: false,
      },
    },
  },
});
