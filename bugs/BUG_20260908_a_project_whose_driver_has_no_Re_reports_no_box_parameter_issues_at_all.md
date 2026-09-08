# A project whose driver states no Re reports no box-parameter issues at all

Status: RESOLVED

## Symptom

A project with a zero box volume raises no `Vb` error, and an unsized project raises no
precondition issue of any kind. Probed 2026-09-08 through the store's own seam:

```
boxType sealed
volume {"value":0,"state":"entered"}
driveVoltage null
validateParams []
paramIssues []
```

The box volume is zero and stated, and the validation layer returns an empty list.

## Evidence

`OpenISDProject.validateParams` (`packages/design/domain/openisdDomain.ts:2262`) only validates
when it can build sweep parameters:

```ts
validateParams(P: FrequencyGrid): DriverError[] {
    const box = this.#engineBoxType();
    const params = box ? this.#sweepParams(P) : null;
    return box && params ? this.#engine.validateParams(box, params) : [];
}
```

`#sweepParams` (line 2131) bails on a null drive voltage, before Vb is looked at:

```ts
const Vb = this.#boxVolume_m3();
const eg = this.driveVoltage_V();
if (Vb === null || eg === null) return null;
```

and `driveVoltage_V()` (line 2021) is null whenever the driver states no `Re`:

```ts
const Re_ohm = this.driver.solveConsistencyGroup().Re_ohm;
return power_W === null || Re_ohm === undefined ? null : this.#engine.driveVoltage(power_W, Re_ohm);
```

A new project opens with a blank driver, so `Re` is absent and every parameter issue is
suppressed from the moment the project exists.

## Cause

Two separate preconditions — "can this design be swept?" and "are its enclosure parameters
valid?" — share one guard. The drive voltage is needed for the SWEEP; it is not needed to
notice that a box volume is zero. Routing the validation through `#sweepParams` makes an
unrelated missing value silence the check.

The effect is worst exactly where the check matters most: a project the user has not finished
filling in is the one whose enclosure parameters are most likely to be wrong, and it is the one
guaranteed to report nothing.

## Fix

The two preconditions are separated. `validateParams` now takes only the fields it reads:

```ts
export type EnclosureParams = Partial<Pick<SweepParams, 'Vb' | 'Vf' | 'Sp' | 'prSd' | 'prCms' | 'prMmd'>>;
```

`OpenISDProject.validateParams` builds that from the box's own stated geometry via a new
`#enclosureParams()`, instead of routing through `#sweepParams` and inheriting its drive-voltage
guard. An unstated volume is passed through as absent rather than short-circuiting the check,
because "you have not sized the box" is the complaint, not a reason to stay silent.

No cast: the parameter is typed as what it is, so a caller cannot hand `validateParams` a
half-built sweep.

A second defect surfaced in the tests themselves — all five configured `box.vented.*` on a
project that opens SEALED, so they were writing to dormant fields. They now set
`box.boxType.set('vented')` first. This was invisible while the check returned `[]` regardless.

## Verification

`npx vitest run packages/ui/test/logic/store-issue-channel.test.ts` — 5/5 green, including "a
fully specified design is clean", so the split raises no false positive on a complete design.

Made to fail on purpose: with the positivity guard in `params.ts` short-circuited
(`if (true) continue`), four of the five go red and the clean-design test stays green. Restored.
