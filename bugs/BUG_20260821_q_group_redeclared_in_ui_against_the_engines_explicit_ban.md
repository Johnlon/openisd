Status: OPEN

# `Q_GROUP` is redeclared in the UI, against the engine's explicit "never redeclare" instruction

## Symptom

Which fields form the Qts/Qes/Qms group is stated in two places. The engine derives it from its
own relation table and forbids copying; the UI hardcodes it as a literal.

## Evidence

`packages/engine/src/consistency.ts:107-112` — the source of truth, and the ban:

```ts
/**
 * §4 row 5's three Q members — the ONE source of truth for which fields form the Qts/Qes/Qms
 * group, reused by the Driver ADT's own group-staleness handling (QO13). Never redeclare this
 * list elsewhere.
 */
export const Q_GROUP_FIELDS: readonly string[] = RELATIONS.find(r => r.target === 'Qts')!.fields;
```

It is DERIVED — `RELATIONS.find(r => r.target === 'Qts')!.fields`, off the relation
`Qts = Qes·Qms/(Qes+Qms)` at `consistency.ts:80-81`. Change the relation and the list follows.

`packages/ui/src/logic/useDriverCells.ts:40` — the redeclaration:

```ts
export const Q_GROUP: readonly SpecField[] = ['Qts', 'Qes', 'Qms'];
```

A hand-typed literal. It cannot follow a change to the relation, and nothing detects the drift.

`useDriverCells.ts:7` also claims to be "the ONE place the E/C/N marks and the Q-group rule are
expressed" — false for the Q-group half, since the engine expresses it and says so.

## Cause

The rule was needed by two components (`DriverEditorModal.vue`, `OgTune.vue`) and was written
where the consumers are rather than sourced from where the knowledge lives. The engine's export
exists precisely to prevent this and was not used.

## Fix

Not fixed. `Q_GROUP` and `useQGroupIncomplete()` leave the UI:

- delete `useDriverCells.ts`'s `Q_GROUP`; consumers take `Q_GROUP_FIELDS` from `@openisd/engine`,
  or reach the rule through the domain object per the layering plan.
- `useQGroupIncomplete()` — "fewer than two Q members hold a usable value ⇒ the third cannot be
  solved" — is a DOMAIN rule, not presentation. It belongs beside the relation it depends on.

What legitimately stays in the UI file: `CellClass` (the `value-e`/`value-c`/`value-n` CSS
names) and `cellClassOf()`. `consistencyNote()` is borderline — the wording is presentation, the
rule it formats is not.

## Verification

N/A — open. Afterwards: `Qts`, `Qes` and `Qms` appear as a group in exactly one declaration
across the repo, and it is the derived one in `consistency.ts`.
