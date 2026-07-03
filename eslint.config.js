import pluginVue from 'eslint-plugin-vue';
import pluginPlaywright from 'eslint-plugin-playwright';
import tseslint from 'typescript-eslint';
import globals from 'globals';

// Shared no-unused-vars config — the @typescript-eslint variant understands TS
// type constructs (the base rule misfires on them). Applied to .js too (the TS
// parser handles plain JS fine), so one rule covers the whole codebase.
const noUnusedVars = {
  'no-unused-vars': 'off',
  '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
};

export default [
  // ── Ignore generated and dependency directories ──────────────────────────
  { ignores: ['**/dist/**', '**/node_modules/**', 'packages/ui/public/**'] },

  // ── typescript-eslint recommended (registers plugin + rules for .ts) ──────
  ...tseslint.configs.recommended,

  // ── Vue SFC files: use eslint-plugin-vue's flat/essential preset ─────────
  // This preset installs vue-eslint-parser and all essential Vue 3 rules.
  ...pluginVue.configs['flat/essential'],

  // ── Override: tighten rules for Vue components ───────────────────────────
  {
    files: ['packages/ui/src/**/*.vue'],
    languageOptions: {
      // vue-eslint-parser stays the outer parser; delegate <script lang="ts"> to
      // the TS parser so TypeScript in SFCs is understood.
      parserOptions: { parser: tseslint.parser },
      globals: { ...globals.browser, ...globals.es2022 },
    },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      ...noUnusedVars,
      'no-undef': 'error',
      'no-console': 'warn',
      // Flash.vue is a single-word legacy name — it predates the multi-word rule.
      'vue/multi-word-component-names': ['error', { ignores: ['Flash'] }],
    },
  },

  // ── Engine package: packages/engine/src/*.{js,ts} ────────────────────────
  // Pure Node-importable modules — no browser globals or console logging.
  {
    files: ['packages/engine/src/**/*.{js,ts}'],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.es2022 },
    },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      ...noUnusedVars,
      'no-undef': 'error',
      'no-console': 'error',
    },
  },

  // ── UI source JS/TS: packages/ui/src/**/*.{js,ts} ────────────────────────
  {
    files: ['packages/ui/src/**/*.{js,ts}'],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2022 },
    },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      ...noUnusedVars,
      'no-undef': 'error',
      'no-console': 'warn',
    },
  },

  // ── Engine tests: packages/engine/test/*.{mjs,js,ts} ─────────────────────
  {
    files: ['packages/engine/test/**/*.{mjs,js,ts}'],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.es2022 },
    },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      ...noUnusedVars,
      'no-undef': 'error',
    },
  },

  // ── UI unit tests: packages/ui/test/*.{mjs,js,ts} ─────────────────────────
  {
    files: ['packages/ui/test/**/*.test.{mjs,js,ts}', 'packages/ui/test/**/*.{mjs,ts}'],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.es2022 },
    },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      ...noUnusedVars,
      'no-undef': 'error',
    },
  },

  // ── Engine boundary — only store and selftest may call raw physics ──────────
  // deriveDriver / sweep / maxCurves must go through store (which wraps them
  // with error handling). selftest is exempt — it tests the raw engine bundle.
  {
    files: ['packages/ui/src/components/**', 'packages/ui/src/utils/**'],
    ignores: ['packages/ui/src/utils/selftest.js', 'packages/ui/src/utils/selftest.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['@openisd/engine'],
            importNamePattern: '^deriveDriver$',
            message: 'Use driver from store — the store wraps deriveDriver with error handling.',
          },
          {
            group: ['@openisd/engine'],
            importNamePattern: '^(sweep|maxCurves)$',
            message: 'Use curvesData/maxData from store — the store wraps sweep/maxCurves with error handling.',
          },
        ],
      }],
    },
  },

  // ── Playwright tests: packages/ui/test/*.browser.spec.ts ─────────────────
  {
    ...pluginPlaywright.configs['flat/recommended'],
    files: ['packages/ui/test/**/*.browser.spec.ts'],
    languageOptions: {
      parser: tseslint.parser,
      // Specs run in Node, but page.evaluate/waitForFunction callbacks reference
      // browser globals (window, localStorage, document) analysed statically.
      globals: { ...globals.node, ...globals.browser, ...globals.es2022 },
    },
    plugins: { ...pluginPlaywright.configs['flat/recommended'].plugins, '@typescript-eslint': tseslint.plugin },
    rules: {
      ...pluginPlaywright.configs['flat/recommended'].rules,
      'playwright/no-page-pause': 'error',
      'playwright/no-wait-for-timeout': 'error',
      ...noUnusedVars,
    },
  },
];
