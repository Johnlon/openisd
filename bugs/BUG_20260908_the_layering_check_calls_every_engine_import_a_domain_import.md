# The layering check calls every engine import a domain import, so it cannot tell them apart

Status: RESOLVED

## Symptom

`packages/ui/test/ui/architecture.test.ts` reports

```
ui/diagnostics->model: diagnostics/selftest.ts imports @openisd/design/engine
```

It says the import goes to `model`, when the import line plainly says `engine`. The list of
approved dependencies already allows diagnostics code to use the engine, so this file is doing
something permitted and being failed for something it did not do.

## Evidence

`specLayer` (`packages/ui/test/ui/architecture.test.ts:592`) tests the prefixes in the wrong
order:

```ts
if (spec.startsWith('@openisd/design')) return 'model';
if (spec.startsWith('@openisd/persistence')) return 'persistence';
if (spec.startsWith('@openisd/design/winisd')) return 'winisd';
if (spec.startsWith('@openisd/design/engine')) return 'engine';
```

`'@openisd/design/engine'.startsWith('@openisd/design')` is true, so the first line returns
`'model'` and the two specific lines below it are unreachable for every input.

## Cause

`packages/model`, `packages/engine` and `packages/winisd` were three packages with three
distinct specifiers, and prefix order did not matter. They are now three SUBPATHS of one
package, and the bare-package prefix is a prefix of the subpaths — so the general test must
come last. The merge moved the code and left the prefix order as it was.

The wrong label matters more than a wrong word: an engine import and a domain import now look
identical to the check, so the approved-dependency list cannot tell them apart, and any future
engine import is judged against the domain's rules instead of its own.

## Fix

Test the longest path first, so `@openisd/design/engine` is recognised as the engine and only a
plain `@openisd/design` counts as the domain.

## Verification

`npx vitest run packages/ui/test/ui/architecture.test.ts` — `selftest.ts` is no longer reported;
it now resolves to the ruled-legal `ui/diagnostics->engine`.

Made to fail on purpose: restoring the bare-package test to the top brought the mislabelled
`ui/diagnostics->model` offence straight back, which is the proof the ordering is what decides
it.
