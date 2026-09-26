# addedMassForTuning_kg returns the radiator's TOTAL moving mass, not the mass to add

Status: RESOLVED

## Symptom

`PassiveRadiatorBox.addedMassForTuning_kg(fp_hz)` answers "how much tuning mass must go on this
radiator's cone to reach `fp_hz`". It returns the radiator's total moving mass at that tuning
instead — `Mmd + Madd`, not `Madd`. A user who applies the answer over-weights the cone by the
radiator's own `Mms`, and the box tunes far below the frequency they asked for.

A second defect sits in the same method: an unreachable target returns a plausible number rather
than reporting that it cannot be reached. The highest tuning this box and radiator can reach is
the one they produce with NO added mass; a target above that needs NEGATIVE added mass, and mass
cannot be taken off a cone that carries none. The arithmetic happily returns the smaller total
mass, which reads as a valid answer.

(The ceiling is the SYSTEM tuning at zero added mass, not the radiator's free-air Fs — the box's
air stiffens the radiator, so the system tunes ABOVE free air. For the SB23PACS fixture used in
`domain.test.ts` — Mms 0.09 kg, Cms 0.0009 m/N, Sd 0.025 m² in 0.03 m³ — free-air Fs is 17.68 Hz
while the system tunes at 33.83 Hz with no added mass.)

## Evidence

`packages/design/engine/boxDesign.ts:123` — the engine formula, whose own docstring says it
returns the required moving mass:

```ts
/**
 * PR moving mass required to achieve a target fp.
 * Inverts prTuning(): Map = 1/((2π·fp)²·Cpar),  Mmp = Map·prSd²
 */
export function prMassForFp(P: PRParams, fp: number): number {
  const Cab  = P.Vb / (refRho() * refC() * refC());
  const Cap  = P.prCms! * P.prSd! * P.prSd!;
  const Cpar = (Cab * Cap) / (Cab + Cap);
  const Map  = 1 / ((2 * Math.PI * fp) ** 2 * Cpar);
  return Map * P.prSd! * P.prSd!;
}
```

`prTuning` at the same file's line 110 confirms which quantity that inverts — its `Map` is built
from `P.prMmd! + P.prMadd!`, the TOTAL:

```ts
const Map  = (P.prMmd! + P.prMadd!) / (P.prSd! * P.prSd!);
```

So `prMassForFp` inverts to `Mmd + Madd`. `packages/design/domain/openisdDomain.ts:569` then
returns that value unchanged as the ADDED mass:

```ts
addedMassForTuning_kg: (fp_hz: number) => {
    const P = ...;
    return P === null || !(fp_hz > 0) ? null : engine.prMassForFp(P, fp_hz);
},
```

Nothing subtracts `Mms`, and nothing checks the result is positive.

## Cause

`prMassForFp` is named for the mass it solves for (the total moving mass in the Helmholtz
relation) while `addedMassForTuning_kg` is named for the mass the USER adds. The two differ by
the radiator's own `Mms`. The domain method adopted the engine's return value as if the two
names meant the same quantity.

The unreachable-target half has the same root: the formula is a bare algebraic inversion with no
domain constraint on its output, and the domain wrapper added none.

## Fix

`packages/design/domain/openisdDomain.ts`, `addedMassForTuning_kg`:

```ts
const P = this.#prParams(prVolume.get(), prAddedMass.get().value, radiator);
if (P === null || !(fp_hz > 0)) return null;
// The engine answers with the TOTAL moving mass the tuning needs, since that is
// what `prTuning()` takes; what goes ON the cone is that less the radiator's own.
const added_kg = engine.prMassForFp(P, fp_hz) - P.prMmd;
// A tuning above the one this radiator reaches with a bare cone needs mass taken
// OFF it, which is not a smaller answer — it is no answer.
return added_kg < 0 ? null : added_kg;
```

The engine formula is untouched: `prMassForFp` correctly inverts `prTuning`, and total moving
mass is the right answer to the question it asks. The domain method now converts that into the
quantity its own name promises.

## Verification

Two tests in `packages/design/test/domain.test.ts`, both watched failing first.

The quantity is checked by its defining PROPERTY rather than a literal — apply the answer and the
box must actually reach the target — so the test does not depend on the engine's air constants:

```ts
const added = p.box.passiveRadiator.addedMassForTuning_kg(15);
p.box.passiveRadiator.addedMass_kg.set(added!);
expect(p.box.passiveRadiator.systemTuning_hz()).toBeCloseTo(15, 6);
```

Before the fix that assertion read 13.712533249297078 Hz for a requested 15 Hz — the cone
over-weighted by the radiator's own 0.09 kg Mms.

The unreachable case, whose ceiling is read from the box itself rather than assumed:

```ts
const ceiling = p.box.passiveRadiator.systemTuning_hz()!;   // mass 0
expect(p.box.passiveRadiator.addedMassForTuning_kg(ceiling * 1.5)).toBeNull();
expect(p.box.passiveRadiator.addedMassForTuning_kg(ceiling)).toBeCloseTo(0, 9);
```

Before the fix the first returned 0.039999999999999994 kg. The second pins that the ceiling
itself stays reachable, so the null guard cannot be satisfied by rejecting everything.

`npx vitest run packages/design/test/domain.test.ts` — 62 passed.

## Note

Both tests set `p.box.passiveRadiator.volume_m3` explicitly: the shared fixture project is
sealed-built, so the passive-radiator box's own volume starts at 0 and every PR calculation
reports null until it is set. An earlier draft of these tests passed while everything was null —
green, and evidence of nothing.
