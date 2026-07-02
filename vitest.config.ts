import { defineConfig } from 'vitest/config';

// Dedicated root — must NOT inherit vite.config.js's `root: packages/ui`, or the
// engine suite silently isn't discovered. One project per workspace package.
// golden.test.mjs is excluded here: it's still a standalone `node` script until
// Phase 3 converts it to a Vitest test (it runs via the `test` npm script).
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'engine',
          root: './packages/engine',
          environment: 'node',
          include: ['test/**/*.test.{mjs,ts}'],
          exclude: ['test/golden.test.mjs'],
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
