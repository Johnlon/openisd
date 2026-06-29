import pluginVue from 'eslint-plugin-vue';
import pluginPlaywright from 'eslint-plugin-playwright';
import globals from 'globals';

export default [
  // ── Ignore generated and dependency directories ──────────────────────────
  { ignores: ['dist/**', 'node_modules/**', 'public/**'] },

  // ── Vue SFC files: use eslint-plugin-vue's flat/essential preset ─────────
  // This preset installs vue-eslint-parser and all essential Vue 3 rules.
  ...pluginVue.configs['flat/essential'],

  // ── Override: tighten rules for Vue components ───────────────────────────
  {
    files: ['src/**/*.vue'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2022 },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-console': 'warn',
      // Flash.vue is a single-word legacy name — it predates the multi-word rule.
      'vue/multi-word-component-names': ['error', { ignores: ['Flash'] }],
    },
  },

  // ── Core modules: src/core/**/*.js ───────────────────────────────────────
  // Pure Node-importable modules — no browser globals or console logging.
  {
    files: ['src/core/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.es2022 },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-console': 'error',
    },
  },

  // ── Other source JS: src/*.js and src/utils/*.js ─────────────────────────
  {
    files: ['src/**/*.js'],
    ignores: ['src/core/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2022 },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-console': 'warn',
    },
  },

  // ── Unit tests: test/*.test.mjs ───────────────────────────────────────────
  {
    files: ['test/**/*.test.mjs', 'test/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.es2022 },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef': 'error',
    },
  },

  // ── Playwright tests: test/*.browser.spec.js ─────────────────────────────
  {
    ...pluginPlaywright.configs['flat/recommended'],
    files: ['test/**/*.browser.spec.js'],
    rules: {
      ...pluginPlaywright.configs['flat/recommended'].rules,
      'playwright/no-page-pause': 'error',
      'playwright/no-wait-for-timeout': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
];
