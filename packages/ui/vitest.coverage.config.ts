import {fileURLToPath} from 'node:url';
import {configDefaults, defineConfig} from 'vitest/config';

// UI TypeScript coverage, from the ui project's own unit tests (same tests as the 'ui' project in the root
// vitest.config.ts). The threshold is scripts/coverage-ratchet.mjs against coverage-baseline.json, not a number here.
// `npm run coverage:ui`. .vue files are not instrumented in the node environment, so only src/**/*.ts is measured.
export default defineConfig({
  test: {
    root: new URL('.', import.meta.url).pathname,
    environment: 'node',
    isolate: false,
    include: ['test/**/*.test.{mjs,ts}'],
    exclude: [...configDefaults.exclude, 'test/architecture/**/*.test.ts'],
    setupFiles: [fileURLToPath(new URL('../../scripts/test-setup/blocked-at.mjs', import.meta.url))],
    testTimeout: 0,
    unstubGlobals: true,
    restoreMocks: true,
    reporters: ['default', '../../scripts/test-reporters/no-skips-vitest.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        // The browser entry point: mounts the app on a DOM that the node environment does not have.
        'src/main.ts',
        // Types only: no runtime code to measure.
        'src/types.ts',
      ],
      // json-summary feeds the ratchet; `text` with skipFull lists only the short files.
      reporter: ['json-summary', 'text-summary', ['text', {skipFull: true}]],
      reportsDirectory: '../../build/coverage-ui',
    },
  },
});
