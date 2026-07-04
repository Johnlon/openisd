import { defineConfig } from 'vitest/config';

// Dedicated root — must NOT inherit vite.config.js's `root: packages/ui`, or the
// engine suite silently isn't discovered. One project per workspace package.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'engine',
          root: './packages/engine',
          environment: 'node',
          include: ['test/**/*.test.{mjs,ts}'],
        },
      },
      {
        test: {
          name: 'winisd',
          root: './packages/winisd',
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
