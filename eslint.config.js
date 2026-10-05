import pluginVue from 'eslint-plugin-vue';
import pluginPlaywright from 'eslint-plugin-playwright';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import {importX} from 'eslint-plugin-import-x';
import {createTypeScriptImportResolver} from 'eslint-import-resolver-typescript';

// Shared no-unused-vars config — the @typescript-eslint variant understands TS
// type constructs (the base rule misfires on them). Applied to .js too (the TS
// parser handles plain JS fine), so one rule covers the whole codebase.
const noUnusedVars = {
  'no-unused-vars': 'off',
  '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
};

// Type-aware rules need the type checker, which needs a project. `projectService` hands each
// file to the tsconfig that owns it, so the three packages' own tsconfigs are the source of
// truth here as they are for `npm run typecheck` — there is no second list of files to keep in
// step. It costs lint time; the rules below cannot be written any other way.
const typeAware = {
  files: ['packages/*/src/**/*.ts', 'packages/*/test/**/*.ts', 'packages/design/{domain,engine,fields,browser}/**/*.ts'],
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
  },
  plugins: { '@typescript-eslint': tseslint.plugin },
  rules: {
    // ── A switch over a sum type handles every variant, and the compiler proves it ──────────
    // The rule the codebase's own guardrail asks for: "matches on sum types must be exhaustive;
    // the compiler should fail when a new variant goes unhandled". A missing arm is the bug
    // that reads as `undefined` at runtime and as `any` in an editor that cannot resolve the
    // union. `allowDefaultCaseForExhaustiveSwitch: false` stops a `default:` being used to
    // silence it — a default arm answers for a variant nobody has thought about, which is the
    // thing being banned.
    '@typescript-eslint/switch-exhaustiveness-check': ['error', {
      allowDefaultCaseForExhaustiveSwitch: false,
      considerDefaultExhaustiveForUnions: false,
      requireDefaultForNonUnion: true,
    }],
    // ── No casts ───────────────────────────────────────────────────────────────────────────
    // `as` asserts what the checker could not prove. packages/design has an architecture test
    // for this; the rule extends it to every package and reports it in the editor instead of at
    // suite time. `as const` is not an assertion and stays allowed.
    '@typescript-eslint/consistent-type-assertions': ['error', {
      assertionStyle: 'never',
    }],
    // ── An `any` that leaks is an `any` that spreads ────────────────────────────────────────
    // `no-explicit-any` (already on, from recommended) only catches the word. These catch the
    // value: an `any` arriving from an untyped import or a loose generic, then being called,
    // read, passed or returned. That is how a type hole travels without anyone writing `any`.
    '@typescript-eslint/no-unsafe-argument': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',
  },
};

// `no-restricted-syntax` is ONE rule: when several config blocks match a file, the LAST block's
// selector list replaces every earlier one. So a file that several blocks match (a UI `.ts`
// file matches the re-export, Filter and UI blocks) is governed by the last block alone, and that
// block must spread in every selector list that should still apply.
const NO_REEXPORT_SELECTORS = [
  {
    selector: 'ExportAllDeclaration',
    message: 'No `export * from`: a module exports what it declares. Import from the declaring module.',
  },
  {
    selector: 'ExportNamedDeclaration[source]',
    message: 'No `export {x} from`: a module exports what it declares. Import from the declaring module.',
  },
];

const FILTER_EXTRACT_SELECTORS = [{
  selector: 'TSTypeReference[typeName.name="Extract"] > TSTypeParameterInstantiation > TSTypeReference:first-child[typeName.name="Filter"]',
  message: 'A Filter variant already has a name in packages/design/engine/types.ts (PassFilter, ShelfFilter, …). Use it.',
}];

// Dates, times and counts a user sees go through `@openisd/design/fields` (`formatDateTime`,
// `formatDate`, `formatCount`), never the browser locale (John, 2026-10-05: "never never never
// use US style" dates).
const LOCALE_FORMAT_SELECTORS = [
  {
    selector: 'CallExpression[callee.property.name=/^toLocale(Date|Time)?String$/]',
    message: 'No locale formatting in the UI. Use formatDateTime / formatDate / formatCount from @openisd/design/fields.',
  },
  {
    selector: 'MemberExpression[object.name="Intl"][property.name="DateTimeFormat"]',
    message: 'No locale formatting in the UI. Use formatDateTime / formatDate from @openisd/design/fields.',
  },
];

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
  {
    files: ['packages/ui/src/logic/domEvents.ts', 'packages/ui/src/main.ts'],
    rules: { 'no-console': ['warn', { allow: ['error'] }] },
  },

  // ── The console IS the diagnostics channel, in exactly these files ───────
  // `faultLog.install()` REPLACES `console.error` — capturing the throw Vue swallows out of a
  // computed is the module's whole job, so it cannot be written without naming the console.
  {
    files: ['packages/ui/src/diagnostics/faultLog.ts'],
    rules: { 'no-console': 'off' },
  },

  // The compatibility suite is a command-line program: its report goes to stdout.
  {
    files: ['packages/design/compat/run.ts'],
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

  // ── No re-exports outside a package entry point ────────────────────────────────────────
  // QO86 (2026-08-23): "never a re-exported symbol"; John, 2026-09-28: "re-exporting generally
  // is an evil I'd like the linters to stop". A module exports what it declares. The barrels
  // that ARE a package's door (`index.ts`) are the one place a re-export is the point.
  {
    files: ['packages/**/*.ts'],
    ignores: ['**/index.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...NO_REEXPORT_SELECTORS],
    },
  },

  // ── A Filter variant has one name ──────────────────────────────────────────────────────
  // `packages/design/engine/types.ts` names every filter variant (`PassFilter`, `ShelfFilter`,
  // …) and every editor patch (`PassPatch`, …). `Extract<Filter, {type: 'lowpass' | …}>` is
  // that same type spelled out again at the call site — the third name for it, found in 24
  // Engine signatures, 8 private aliases and 8 editors (John, 2026-09-28: "the return types
  // aren't even consistent"). Name it once; use the name.
  {
    files: ['packages/**/*.{ts,vue}'],
    rules: {
      'no-restricted-syntax': ['error', ...FILTER_EXTRACT_SELECTORS],
    },
  },

  // ── UI: a hook is the panel's vocabulary; no maths, formatting or constants ────────────
  // Placed after the blocks above so its selector list (which spreads theirs) is the one in force.
  // A hook's interface is the panel's vocabulary, not a window onto the engine.
  // `updatePassFilter: Engine['updatePassFilter']` borrows an engine method's type into a hook's
  // API, and `engine.updatePassFilter.bind(engine)` hands the method itself through. Both make
  // the hook a proxy for the engine instead of a component that HOLDS it (John, 2026-09-28:
  // "there is no need for the hooks to refer to the engine that way at all — define your own
  // interface"). The engine is a constructor argument, kept private; each method says what the
  // panel does and calls the engine inside.
  {
    files: ['packages/ui/src/**/*.{ts,vue}'],
    rules: {
      'no-restricted-syntax': ['error',
        ...NO_REEXPORT_SELECTORS,
        ...FILTER_EXTRACT_SELECTORS,
        {
          selector: 'TSIndexedAccessType > TSTypeReference[typeName.name="Engine"]',
          message: "A hook declares its own method, in the panel's words, and calls the engine inside it. `Engine['x']` makes the hook a window onto the engine.",
        },
        {
          selector: 'CallExpression[callee.property.name="bind"][arguments.0.name="engine"]',
          message: 'Hand out a method of your own that calls the engine, not the engine\'s method itself.',
        },
        // The UI is display-only: pixel multiplication by canvas size and margins, nothing else.
        // Calculation, number formatting and physical constants live in packages/design
        // (`@openisd/design/chart`, `@openisd/design/fields`). `Math.min/max/abs/floor/round/ceil`
        // stay allowed for pixel clamping.
        {
          selector: 'MemberExpression[object.name="Math"][property.name=/^(log|log10|log2|exp|pow|sqrt|hypot|PI|sin|cos|tan|atan|atan2)$/]',
          message: 'No maths in the UI. Add the calculation to packages/design (an axis, field or chart class) and call it.',
        },
        {
          selector: 'CallExpression[callee.property.name="toFixed"]',
          message: 'No number formatting in the UI. Use `@openisd/design/chart` format functions or a NumberField.',
        },
        {
          selector: 'Literal[value=1.2041], Literal[value=343.235], Literal[value=343.2]',
          message: 'Air density and speed of sound are design constants. Read them from packages/design.',
        },
        ...LOCALE_FORMAT_SELECTORS,
      ],
    },
  },
  // Templates too: `{{ x.toLocaleString() }}` showed US dates ("10/5/2026, 11:32:00 PM").
  {
    files: ['packages/ui/src/**/*.vue'],
    rules: { 'vue/no-restricted-syntax': ['error', ...LOCALE_FORMAT_SELECTORS] },
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

  typeAware,
  // ── No import cycles ─────────────────────────────────────────────────────────────────────
  // A cycle makes module load order matter and lets a "lower" module reach a "higher" one.
  // Existing cycles are suppressed in eslint-suppressions.json (a ratchet: a new cycle fails, a
  // fixed one must be pruned with `npm run lint:prune`). `.vue` files are not parsed here, so a
  // cycle running through a component is not seen.
  {
    files: ['packages/**/*.ts'],
    plugins: { 'import-x': importX },
    settings: {
      // Without .ts here import-x never parses a TypeScript dependency and no-cycle finds nothing.
      'import-x/extensions': ['.ts', '.js'],
      'import-x/resolver-next': [createTypeScriptImportResolver({
        project: ['packages/design/tsconfig.json', 'packages/persistence/tsconfig.json', 'packages/ui/tsconfig.json'],
        noWarnOnMultipleProjects: true,
      })],
    },
    rules: { 'import-x/no-cycle': 'error' },
  },
  // ── The one file that imports a Vue SFC from TypeScript ──────────────────────────────────
  // `vue-tsc` resolves `./ui/App.vue` and `npm run typecheck` checks this file properly. ESLint's
  // TypeScript program cannot: an SFC is not a module it can parse, so `App` arrives error-typed
  // and every use of it reads as unsafe. The rules stay on for the rest of main.ts.
  {
    files: ['packages/ui/src/main.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },
];
