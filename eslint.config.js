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
  // dist-electron/ is the optional desktop shell's build output — same minified bundle as
  // dist/, so it is ignored for the same reason: it is emitted, not authored.
  { ignores: ['**/dist/**', '**/dist-electron/**', '**/node_modules/**', 'packages/ui/public/**', 'build/**', 'coverage/**'] },

  // ── typescript-eslint recommended (registers plugin + rules for .ts) ──────
  ...tseslint.configs.recommended,

  // ── Vue SFC files: use eslint-plugin-vue's flat/essential preset ─────────
  // This preset installs vue-eslint-parser and all essential Vue 3 rules.
  ...pluginVue.configs['flat/essential'],

  // ── Override: tighten rules for Vue components ───────────────────────────
  // EVERY package's SFCs, not just packages/ui's — a component is a component wherever it lives,
  // and a package added later should not silently arrive unlinted.
  {
    files: ['packages/**/*.vue'],
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

  // ── The Node-importable packages: design, model, persistence, winisd ──────
  // No console logging: these are libraries, and a library that prints has decided something
  // about its host that is not its to decide.
  //
  // `globals.node` rather than bare es2022 because these are ISOMORPHIC — they run in Node and
  // in the browser, and the platform features they use (`crypto.randomUUID`, `TextDecoder`,
  // `fetch`, `Blob`) are standard in both. What that does NOT admit is anything browser-ONLY:
  // `localStorage`, `document`, `window`, `FileSystemFileHandle`. Those belong to the two
  // platform directories called out below, and stay `no-undef` errors everywhere else.
  {
    files: [
      'packages/design/**/*.{js,ts}',
      'packages/model/**/*.{js,ts}',
      'packages/persistence/**/*.{js,ts}',
      'packages/winisd/**/*.{js,ts}',
    ],
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

  // ── The console IS the diagnostics channel, in exactly these files ───────
  // `faultLog.install()` REPLACES `console.error` — capturing the throw Vue swallows out of a
  // computed is the module's whole job, so it cannot be written without naming the console.
  {
    files: ['packages/ui/src/diagnostics/faultLog.ts'],
    rules: { 'no-console': 'off' },
  },
  // The restore boundary reports a payload it refuses through `console.error`/`console.info`,
  // which is the channel `faultLog` records into and the fault dialog then shows the user.
  // `console.log` stays banned here: a debug print is not a fault report.
  {
    files: [
      'packages/ui/src/logic/persist.ts',
      'packages/ui/src/logic/store.ts',
      // The repos are the same boundary on the other side of the move: each `console.error`
      // there reports a payload the reader REFUSED — a driver record that will not load, a
      // quarantined blob — which is a fault the user must be told about, not a debug print.
      'packages/persistence/src/repos/**/*.ts',
    ],
    rules: { 'no-console': ['warn', { allow: ['error', 'info'] }] },
  },

  // ── Those packages' TESTS: Node globals, and `console` is how a test reports ──────────────
  {
    files: [
      'packages/design/test/**/*.{mjs,js,ts}',
      'packages/model/test/**/*.{mjs,js,ts}',
      'packages/persistence/test/**/*.{mjs,js,ts}',
      'packages/winisd/test/**/*.{mjs,js,ts}',
    ],
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
      'no-console': 'off',
    },
  },

  // ── The platform directories: browser globals allowed, and ONLY here ───────────────────────
  // `packages/design/browser` is named for exactly this property (see its own header), and
  // `packages/persistence/src/storage` is the file/localStorage layer — reaching the browser is
  // its entire job. Everywhere else a browser-only global stays a `no-undef` error.
  {
    files: [
      'packages/design/browser/**/*.{js,ts}',
      'packages/persistence/src/storage/**/*.{js,ts}',
      'packages/persistence/src/repos/**/*.{js,ts}',
    ],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2022 },
    },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: { ...noUnusedVars, 'no-undef': 'error', 'no-console': 'error' },
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

  // ── The engine has ONE door ────────────────────────────────────────────────────────────────
  // `packages/design/engine/index.ts` exports the `Engine` class and the types its signatures
  // name. Reaching past it — a deep subpath, or the deleted `@openisd/engine` — gets at a
  // function meant to be internal. `packages/design/test/architecture-engine-boundary.test.ts`
  // is the thorough check (it resolves relative paths too); this is the fast one, in the editor.
  {
    files: ['packages/**/*.{js,ts,vue}'],
    ignores: ['packages/design/engine/**'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['@openisd/design/engine/*'],
            message: 'The engine has one door: import `@openisd/design/engine` and call a method on `Engine`. If Engine does not offer what you need, that is a missing method — add it there.',
          },
          {
            group: ['@openisd/engine', '@openisd/engine/*'],
            message: '`packages/engine` was deleted. Import `@openisd/design/engine` and use the `Engine` class.',
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
      // ── The fixture is mandatory, and this is what makes it unbypassable ──────
      // AGENTS.md §"Two suites, both required": every *.browser.spec.ts must take
      // `test`/`expect` from packages/ui/test/fixtures.ts, because that module's
      // `browserLog` auto-fixture is the ONLY thing asserting zero console errors,
      // Vue duplicate-key warnings, uncaught page errors and failed same-origin
      // requests. A spec importing them from '@playwright/test' still goes green on
      // a DOM assertion while the app throws in the console.
      //
      // This matches the SHAPE of the import statement (an AST node), never prose —
      // a comment or a string mentioning '@playwright/test' cannot trip it. Type-only
      // imports are legitimate and stay allowed: `import type { Page }` carries no
      // runtime binding, so it cannot bypass the fixture. A namespace import
      // (`import * as pw`) is reported by the rule, so it is not an escape hatch.
      '@typescript-eslint/no-restricted-imports': ['error', {
        paths: [{
          name: '@playwright/test',
          importNames: ['test', 'expect'],
          allowTypeImports: true,
          message: "Import { test, expect } from the project fixture instead (e.g. '../fixtures.js'). @playwright/test's test/expect skip the browserLog console + network assertions that every browser spec must run.",
        }],
      }],
    },
  },
];
