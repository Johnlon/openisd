import { defineConfig } from 'vitest/config';

// Dedicated root — must NOT inherit vite.config.js's `root: packages/ui`, or the
// engine suite silently isn't discovered. One project per workspace package.
export default defineConfig({
  test: {
    // A SKIP IS A FAIL — see scripts/test-reporters/no-skips-vitest.ts.
    reporters: ['default', './scripts/test-reporters/no-skips-vitest.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'packages/ui/src/**/*.{ts,vue}',
      ],
      exclude: [
        'packages/ui/src/main.ts',
        'packages/ui/src/types.ts',
      ],
      thresholds: {
        statements: 15.8,
        branches: 78.5,
        functions: 54.0,
        lines: 15.8,
      },
    },
    projects: [
      {
        test: {
          name: 'persistence',
          root: './packages/persistence',
          environment: 'node',
          include: ['test/**/*.test.{mjs,ts}'],
        },
      },
      {
        test: {
          name: 'design',
          root: './packages/design',
          environment: 'node',
          include: ['test/**/*.test.{mjs,ts}'],
        },
      },
      {
        test: {
          name: 'ui',
          root: './packages/ui',
          environment: 'node',
          include: ['test/**/*.test.{mjs,ts}'],
        },
      },
    ],
  },
});
