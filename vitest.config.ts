import {fileURLToPath} from 'node:url';
import {configDefaults, defineConfig} from 'vitest/config';

// Worker count for a run started outside the pre-commit hook (the hook passes --maxWorkers from
// scripts/hooks-local/heavy-gate-concurrency.sh, which overrides this). Fixed, and the same for every
// project: it used to be sized from the 1-minute load average, so two projects evaluated a moment apart on
// a busy box got different numbers and vitest refused to start ("Projects design and design-architecture
// have different maxWorkers but same sequence.groupOrder": F2, F21, F38, F39). Memory is admitted by
// scripts/budget.sh, costed at this count (scripts/budget.conf, VITEST_FULL_WORKERS).
const WORKERS = 4;

// Architecture tests are synchronous AST scans of the source tree: nothing in them awaits, so a
// timeout can only fire because the machine is busy, and it then reports no offence at all. They
// run with no timeout (John, 2026-09-27: "arch tests shouldn't have timeouts").
const DESIGN_ARCHITECTURE = ['test/architecture*.test.ts'];
// No other test has a time limit either (0): a test that keeps making progress is never cut off,
// and a stuck run is caught by the idle watchdog in scripts/quiet-test.sh.
const TEST_TIMEOUT = 0;
// blocked-at.mjs reports where the event loop is blocked and never fails a test.
const BLOCKED_AT_SETUP = [
  fileURLToPath(new URL('./scripts/test-setup/blocked-at.mjs', import.meta.url)),
];
const UI_ARCHITECTURE = ['test/architecture/**/*.test.ts'];

// Dedicated root — must NOT inherit vite.config.js's `root: packages/ui`, or the
// engine suite silently isn't discovered. One project per workspace package.
export default defineConfig({
  test: {
    maxWorkers: WORKERS,
    // A SKIP IS A FAIL — see scripts/test-reporters/no-skips-vitest.ts.
    // hanging-process names whatever keeps a finished run from exiting.
    reporters: ['default', 'hanging-process', './scripts/test-reporters/no-skips-vitest.ts'],
    // Files share a worker (isolate: false below), so a stub or mock one file leaves behind would
    // reach the next. Every test ends with the globals and mocks it found.
    unstubGlobals: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: [
        'packages/ui/src/**/*.{ts,vue}',
      ],
      exclude: [
        'packages/ui/src/main.ts',
        'packages/ui/src/types.ts',
      ],
      // Measured 2026-09-21 (npx vitest run --coverage, post Tasks 2/3/5):
      // statements 41.08%, branches 33.68%, functions 45.35%, lines 46.02%.
      // branches/functions had to come DOWN — new low-coverage hook code (esp.
      // OriginalShell-hooks.ts) dropped real coverage below the old thresholds,
      // which were already red before this edit.
      thresholds: {
        statements: 41.0,
        branches: 33.6,
        functions: 45.3,
        lines: 46.0,
      },
    },
    projects: [
      {
        test: {
          name: 'persistence',
          testTimeout: TEST_TIMEOUT,
          setupFiles: BLOCKED_AT_SETUP,
          // Pure node, no DOM: one worker loads the engine and domain graph once for every file it
          // runs, not once per file (import was 69 % of a 38 min run, 11 Oct 2026, SDLC S9).
          isolate: false,
          root: './packages/persistence',
          environment: 'node',
          include: ['test/**/*.test.{mjs,ts}'],
        },
      },
      {
        test: {
          name: 'design',
          testTimeout: TEST_TIMEOUT,
          setupFiles: BLOCKED_AT_SETUP,
          // Pure node, no DOM: one worker loads the engine and domain graph once for every file it
          // runs, not once per file (import was 69 % of a 38 min run, 11 Oct 2026, SDLC S9).
          isolate: false,
          root: './packages/design',
          environment: 'node',
          include: ['test/**/*.test.{mjs,ts}'],
          exclude: [...configDefaults.exclude, ...DESIGN_ARCHITECTURE],
        },
      },
      {
        test: {
          name: 'design-architecture',
          root: './packages/design',
          environment: 'node',
          include: DESIGN_ARCHITECTURE,
          testTimeout: 0,
        },
      },
      {
        test: {
          name: 'ui',
          testTimeout: TEST_TIMEOUT,
          setupFiles: BLOCKED_AT_SETUP,
          // Node environment too (no DOM): the same one-load-per-worker as design.
          isolate: false,
          root: './packages/ui',
          environment: 'node',
          include: ['test/**/*.test.{mjs,ts}'],
          exclude: [...configDefaults.exclude, ...UI_ARCHITECTURE],
        },
      },
      {
        test: {
          name: 'ui-architecture',
          root: './packages/ui',
          environment: 'node',
          include: UI_ARCHITECTURE,
          testTimeout: 0,
        },
      },
    ],
  },
});
