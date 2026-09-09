# Three tests check a deleted file, so they crash instead of checking anything

Status: OPEN

## Symptom

Three tests in `packages/ui/test/ui/architecture.test.ts` try to open a file that is not there:

```
Error: ENOENT: no such file or directory, open
  '/home/john/work/winisd/openisd/packages/ui/src/logic/managedProject.ts'
```

The three are:

- "the draft exemption names a file that still exists and still holds a draft"
- "managedProject.ts itself is the one file that constructs an OpenISDDriver"
- "ManagedProject never hands an OpenISDDriver out — every public member returns data"

## What these three were protecting

One rule, in three parts: only ONE place in the app is allowed to create an `OpenISDDriver`, and
it must never hand that object out to anyone else — callers get plain data instead. That kept the
driver object from leaking across the app, where any component could then hold and mutate it.

`DriverEditorModal.vue` had a written exemption from this, because it holds a working copy while
you edit a driver.

While these three crash, none of that rule is checked. Nothing currently stops a second file
creating an `OpenISDDriver`, or a method returning one.

## Evidence

`packages/ui/src/logic/managedProject.ts` does not exist.

Searched 2026-09-08: the name `ManagedProject` survives in `packages/ui/src` only inside
comments — `appState.ts:47`, `liveProject.ts:11`, `urlAppState.ts:3`, `useApplicationIO.ts:139`,
`App.vue:42`, `DriverEditorModal.vue:39`, `environment.ts:3` — and in
`packages/design/domain/openisdDomain.ts:58`. There is no class and no module.

Two test files still carry the name: `packages/ui/test/logic/managedProjectFilters.test.ts` and
`packages/ui/test/logic/managedProjectBoxFields.test.ts`.

## Cause

`ManagedProject` was folded into `OpenISDProject` when `packages/model` became
`packages/design`. The class moved; these three tests still name the old file path, so they fail
at the point of opening it — before they check anything.

## Fix

Needs John's decision, because the question is which object owns the rule now, not which path to
type:

- if `OpenISDProject` (`packages/design/domain/openisdDomain.ts`) took over the job, point the
  three tests at it and restate "only one place creates a driver" and "never hand one out"
  against its methods;
- if this is now the design package's own business rather than a UI rule, move the three tests
  into `packages/design/test/`.

Deleting them quietly is not an option — that drops a live rule.

## Verification

None yet — recorded, not fixed.
