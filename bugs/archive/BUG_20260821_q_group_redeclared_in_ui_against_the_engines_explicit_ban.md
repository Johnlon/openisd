Status: RESOLVED — `packages/engine/src/consistency.ts:130-132` now exports
`qGroupIsIncomplete(usable: (field: string) => boolean): boolean`, filtering `Q_GROUP_FIELDS`
and applying the `< 2` threshold. `useDriverCells.ts:3` already imported `isQGroupField`;
`driverRepo.ts:227` now imports `qGroupIsIncomplete` from `@openisd/engine` and calls
`qGroupIsIncomplete(field => pos(field as SpecField))` in place of the hand-typed literal and
its own `qCount < 2` rule.

# `Q_GROUP` is redeclared in the UI, against the engine's explicit "never redeclare" instruction

## Symptom

Which fields form the Qts/Qes/Qms group is stated in two places. The engine derives it from its
own relation table and forbids copying; the UI hardcodes it as a literal.

## Evidence

State AT TIME OF FILING (the quoted code below is the evidence; `useDriverCells.ts:7`/`:40`
line numbers have since moved as this bug's own fix landed — see Fix below for where things
are now):

`packages/engine/src/consistency.ts:111-116` — the source of truth, and the ban:

```ts
/**
 * §4 row 5's three Q members — the ONE source of truth for which fields form the Qts/Qes/Qms
 * group, reused by the Driver ADT's own group-staleness handling (QO13). Never redeclare this
 * list elsewhere.
 */
export const Q_GROUP_FIELDS: readonly string[] = RELATIONS.find(r => r.target === 'Qts')!.fields;
```

It is DERIVED — `RELATIONS.find(r => r.target === 'Qts')!.fields`, off the relation
`Qts = Qes·Qms/(Qes+Qms)` at `consistency.ts:84-85`. Change the relation and the list follows.

`packages/ui/src/logic/useDriverCells.ts`, at time of filing — the redeclaration (this literal
is already deleted; the line number it lived at is not load-bearing):

```ts
export const Q_GROUP: readonly SpecField[] = ['Qts', 'Qes', 'Qms'];
```

A hand-typed literal. It cannot follow a change to the relation, and nothing detects the drift.

`useDriverCells.ts`, at time of filing, also claimed to be "the ONE place the E/C/N marks and
the Q-group rule are expressed" — false for the Q-group half, since the engine expresses it and
says so. That claim is gone from the file now (see Fix).

## Cause

The rule was needed by two components (`DriverEditorModal.vue`, `OgTune.vue`) and was written
where the consumers are rather than sourced from where the knowledge lives. The engine's export
exists precisely to prevent this and was not used.

## Fix

`useDriverCells.ts`'s `Q_GROUP` literal was already gone — the file imports `isQGroupField`
from `@openisd/engine` (`useDriverCells.ts:3`). This bug closed the remaining half:

- `packages/engine/src/consistency.ts:130-132` adds `qGroupIsIncomplete(usable: (field:
  string) => boolean): boolean`, the domain's "fewer than two Q members hold a usable value ⇒
  the third cannot be solved" rule, expressed over `Q_GROUP_FIELDS` (the same derived list
  `isQGroupField` already used) with a unit test in `packages/engine/test/consistency.test.ts`
  (`describe('qGroupIsIncomplete — the group needs two of three to solve the third', …)`, 4
  cases: zero/one/two/three usable members).
- `packages/ui/src/db/driverRepo.ts:3,227` imports `qGroupIsIncomplete` from
  `@openisd/engine` and replaced `(['Qts', 'Qes', 'Qms'] as const).filter(pos).length; ... qCount
  < 2` with `qGroupIsIncomplete(field => pos(field as SpecField))` — no local list, no local
  threshold.

What legitimately stays in the UI file: `CellClass` (the `value-e`/`value-c`/`value-n` CSS
names) and `cellClassOf()`. `consistencyNote()` formats the engine's `ConsistencyIssue`, no
domain rule of its own.

## Verification

`grep -rn "Qts.,.\{0,3\}Qes.,.\{0,3\}Qms" packages/*/src` — one hit, the engine's own
declaration:

```
packages/engine/src/consistency.ts:84:  { formula: 'Qts = Qes·Qms/(Qes+Qms)', target: 'Qts', fields: ['Qts', 'Qes', 'Qms'],
```

`grep -rn "'Qts', 'Qes', 'Qms'\|\"Qts\", \"Qes\", \"Qms\"" packages/` — the only non-test hit is
the same `consistency.ts:84` line; the remaining hits (`packages/ui/test/logic/persist.test.ts`,
`packages/winisd/test/winisd-parity.test.ts`, `driver-editor-mandatory.browser.spec.ts`,
`whatif-panel-shots.browser.spec.ts`, `packages/engine/test/added-mass.test.ts`) are test
fixtures iterating a wider field list, not a group-rule declaration.

`npx vitest run packages/engine/test/consistency.test.ts` — 15 passed (1 file), including the
new `qGroupIsIncomplete` `describe` block.
`npx vitest run packages/ui/test/db/driver-has-dq-issues.test.ts` — a new test file exercising
`driverHasDqIssues` itself (the function this bug's fix changed): the Fs/Re presence checks,
the Sd||Vas branch, the Q-group threshold on both sides of 2, and the federated-row fallback
path, all with data built inline per test.
`npx vue-tsc -p packages/ui --noEmit` — clean, no output.
