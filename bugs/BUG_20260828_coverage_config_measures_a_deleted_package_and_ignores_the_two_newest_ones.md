# Coverage measures a DELETED package and ignores the two newest ones

**Where:** `vitest.config.ts`, the `coverage.include` list and (until this change) `test.projects`.

**Status:** PARTLY FIXED 2026-08-28 — the missing test project is fixed; the coverage `include`
list and its thresholds need John's call, because changing them moves a build gate.

## Symptom

Config that reads as verification while verifying nothing.

`coverage.include` names four globs:

```
packages/engine/src/**/*.ts        <- package DELETED at 7bb1f55
packages/model/src/**/*.ts
packages/winisd/src/**/*.ts
packages/ui/src/**/*.{ts,vue}
```

- **`packages/engine` no longer exists.** Its physics moved to `packages/design/engine/`. The
  glob matches nothing and contributes nothing, while looking like the engine is measured.
- **`packages/design` is absent** — 25 test files, and it is the new central domain + engine
  package. None of its source is measured.
- **`packages/persistence` is absent** — repos and storage, the layer that parses everything
  arriving from disk. None of its source is measured.

### The `src/` trap, and why a PARTIAL fix is the dangerous one

`packages/design` has no `src/` at all, and its source is spread across FOUR roots (counted
2026-08-28, `.ts` outside `test/`):

| root | files |
|---|---|
| `app/` | 2 |
| `browser/` | 2 |
| `domain/` | 6 |
| `engine/` | 17 |
| **total** | **27** |

So copying the existing `packages/*/src/**` pattern matches nothing — inert, and at least
obvious once someone looks at a coverage report showing zero.

The worse outcome is a PLAUSIBLE partial fix. `packages/design/engine/**` alone measures 17 of
27 and produces real, believable numbers, while the entire `domain/` layer stays invisible —
and `domain/` is exactly where the VCCon wiring bug lived on 2026-08-28. That is this same
illness a fourth time, and harder to catch than the dead glob precisely because it reports
something rather than nothing.

**The fix is therefore not "add a glob" but "enumerate this package's source roots."**
`packages/design` is the one package where those roots are not guessable from convention.

Separately, and now fixed: `test.projects` declared an `engine` project for the deleted package
and had **no `persistence` project at all**, so any test written under
`packages/persistence/test/` silently never ran. That was found because a test written tonight
to prove a real fix would not have executed.

## Evidence

Measured 2026-08-28 by listing each package's test files against the declared projects:

| package | test files | vitest project | in coverage |
|---|---|---|---|
| design | 25 | yes | **no** |
| model | 14 | yes | yes |
| persistence | 1 | **was missing** | **no** |
| ui | 44 | yes | yes |
| ui-proposals | 0 | n/a | n/a |
| winisd | 14 | yes | yes |
| engine | **deleted** | **was declared** | **still listed** |

## Cause

The `packages/engine` deletion and the `packages/design`/`packages/persistence` extractions each
updated the code, and neither updated this config. Nothing fails when a coverage glob matches
nothing, and nothing fails when a package has no test project — both are silent by design.

## Fix

Done: `test.projects` gains `persistence`, loses the dead `engine` entry.

NOT done, needs John: `coverage.include` should drop `packages/engine/src/**` and add
`packages/design/{domain,engine}/**/*.ts` and `packages/persistence/src/**/*.ts`. That changes
which files the thresholds are computed over (`statements: 15.8, branches: 78.5, functions: 54.0,
lines: 15.8`), so the numbers will move and the gate may fail until they are re-set. Re-setting a
threshold is a decision about what the build enforces, not a config tidy.

## Verification

`test.projects`: full suite now reports 98 files / 2162 tests, up from 96 / 2148 — the
difference is the persistence project's tests, which were previously invisible.
`coverage.include`: unverified, unchanged.
