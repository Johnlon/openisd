# BUG_20260927_tests_are_outside_the_type_aware_lint

**Status:** RESOLVED

## Symptom

The type-aware lint rules run over `packages/*/src` and not over `packages/*/test`. A test can
cast, and can call through an `any`, where the code it tests cannot.

## Evidence

Measured 2026-09-27, the rules enabled everywhere, `npx eslint packages/`: 726 errors, of which
680 are in tests.

| Area | Errors |
|---|---|
| `packages/ui/test` | 423 |
| `packages/design/test` | 257 |
| `packages/ui/src` | 20 |
| `packages/persistence/src` | 16 |
| `packages/persistence/test` | 10 |

| Rule | Errors |
|---|---|
| `no-unsafe-member-access` | 240 |
| `no-unsafe-assignment` | 172 |
| `consistent-type-assertions` | 169 |
| `no-unsafe-call` | 62 |
| `no-unsafe-argument` | 34 |
| `no-unsafe-return` | 33 |
| `switch-exhaustiveness-check` | 16 |

Worst files: `packages/ui/test/ui/original-skin.browser.spec.ts` 158,
`packages/design/test/engine/golden.test.ts` 52, `packages/design/test/domain.test.ts` 49,
`packages/design/test/engine/gen-golden.ts` 42.

## Cause

Two different sources, not one.

The browser specs: `page.evaluate()` returns `any` unless its callback's return type is stated,
so every read off the result is an unsafe member access. 158 in one spec file is that one
pattern repeated, not 158 decisions.

The design tests: golden-file fixtures are read as parsed JSON and cast to the shape the test
expects, rather than parsed into it.

## Fix

Type the `page.evaluate()` callbacks, and parse the golden fixtures at the point they are read.
Then add `'packages/*/test/**/*.ts'` back to the `typeAware.files` list in `eslint.config.js` —
the line is commented there with a pointer to this record.

## Verification

`npx eslint packages/` is clean with tests in the list.

## Resolution (2026-09-29)

`'packages/*/test/**/*.ts'` is in `typeAware.files`; `npm run lint` and `npm run typecheck` are
clean over the whole repo. Four slices did the work (design engine, design rest, ui specs, ui
logic/persistence/hooks/fixtures).

- Casts became typed helpers, `.clear()` where a test had passed `null` to `set()`, and typed
  `page.evaluate()` callbacks.
- Golden fixtures are hoisted typed constants, not `as readonly WinIsdPlottedPoint[]` literals.
  `winisd_research/toys/plotted_fixture_ts.py:41` still emits the `as` form: regenerating a
  capture fixture reintroduces lint errors until that generator is changed.
- One source change: `driveSignal.ts` `rsOhm` is `computed<number, number | null>`, matching its
  setter, which already took null.
- Found on the way: `useApplicationIO.test.ts` read the generated sample project without generating
  it and passed only by other files' side effect. Fixed.
