import {defineConfig} from 'vitest/config';

// Engine and domain coverage, from the design package's own unit tests alone: UI tests also
// reach this code, so the root config's run cannot prove it. `npm run coverage:design`.
export default defineConfig({
  test: {
    root: new URL('.', import.meta.url).pathname,
    environment: 'node',
    include: ['test/**/*.test.{mjs,ts}'],
    // v8 instrumentation slows the source-scanning architecture tests past the 5 s default.
    testTimeout: 30000,
    reporters: ['default', '../../scripts/test-reporters/no-skips-vitest.ts'],
    coverage: {
      provider: 'v8',
      include: ['engine/**/*.ts', 'domain/**/*.ts'],
      reporter: ['text-summary'],
      reportsDirectory: '../../build/coverage-design',
      thresholds: {perFile: true, statements: 100, branches: 100, functions: 100, lines: 100},
    },
  },
});
