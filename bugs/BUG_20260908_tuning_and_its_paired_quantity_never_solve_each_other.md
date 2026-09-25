# A box tuning and the quantity that produces it never solve each other

Status: DEFERRED — ruled (QO126), scheduled after the packages/model → packages/design migration lands

## Symptom

A tuning frequency and the physical quantity that produces it — vent length on a vented box,
added cone mass on a passive-radiator box — are one relation seen from two ends. The user may
state either and expect the other to follow.

Neither follows. Typing a tuning frequency changes nothing: the value is stored and no
calculation consumes it. Changing the vent length or the added mass does not update the tuning
field either. Both directions are declared, documented as a pair, and called by nothing.

The user sees a tuning field that accepts input and has no effect, beside a readout that ignores
what they typed.

## Evidence

**The passive-radiator box.** `packages/design/domain/openisdDomain.ts:182` declares the target
and the mass as writable handles, and the readout as a separate method:

```ts
export interface PassiveRadiatorBox {
    readonly tuning_hz: FieldHandle<number>;     // WinISD: Fp
    readonly addedMass_kg: FieldHandle<number>;
    systemTuning_hz(): number | null;
    addedMassForTuning_kg(fp_hz: number): number | null;
```

`systemTuning_hz()` reads the radiator and the volume; it never reads `tuning_hz`. Nothing calls
`addedMassForTuning_kg`, so nothing ever turns a stated target into a mass:

```
$ command grep -rn "addedMassForTuning_kg" packages/design/domain packages/ui/src
packages/design/domain/openisdDomain.ts:209    (the declaration)
packages/design/domain/openisdDomain.ts:569    (the implementation)
```

**The vented box.** The same shape, and its own comment states the intent
(`packages/design/domain/vent.ts:25`):

```ts
  /*  inverse of `tuningIn_hz()`. Both directions exist because the user may enter either, and */
  lengthForTuning_m(volume_m3: number | null, fb_hz: number): number | null;
```

Neither direction has a caller:

```
$ command grep -rn "lengthForTuning_m\|tuningIn_hz" packages/design/domain packages/ui/src
packages/design/domain/vent.ts:22          (declaration)
packages/design/domain/vent.ts:27          (declaration)
packages/design/domain/openisdDomain.ts:348 (implementation)
packages/design/domain/openisdDomain.ts:355 (implementation)
```

Four sites, all declaration or implementation. No call.

## Cause

The forward and inverse calculations were built as methods and left unconnected to the fields
they relate. `FieldHandle` is the read/write/calculated type and both members of each pair use
it, so the field types already anticipate a solved relation — what is missing is the relation
itself, the thing that would mark one member `entered` and derive the other as `calculated`.

The driver's own spec already works this way: Fs/Cms/Mms are peers, and stating some derives the
rest through the consistency solver. Neither box pair was joined to that mechanism.

## Fix

RULED, NOT YET BUILT. John, 2026-09-08: "Log as an inbox / bug and carry on with migration."
Deferred because the tree does not currently compile (`packages/ui` typecheck errors outstanding)
and this is a feature, not a migration blocker. The full ruling is QO126.

### The shape agreed

One pair of fields per box type, both read/write/calculated. Stating either derives the other,
the way the driver spec's peers already behave:

| user does | field states |
|---|---|
| types a tuning | tuning `entered`, paired quantity `calculated` |
| types the paired quantity | that `entered`, tuning `calculated` |
| states neither | both `not-available` |
| states both | the existing contradiction check applies |

Applies to BOTH pairs — the passive-radiator box's tuning ↔ added mass, and the vented box's
tuning ↔ vent length. One mechanism, not two.

### Marking, when a value cannot be produced

The derived field reads `not-available` — the driver's own `usable` rule, unchanged — and the
mark goes on the INPUT, never on the blank output. John: "a dq on a blank field is hard to
understand I think", and "b makes more sense by far".

Three cases, in precedence order:

| # | case | mark | precedent today |
|---|---|---|---|
| 1 | one input is bad ON ITS OWN — Sd ≤ 0, a zero volume, a Q of 0 | THAT input, as `invalid` | `consistency.ts` `usable()` detects it and says nothing — the gap |
| 2 | every input plausible alone, but together the target is unreachable | EVERY contributing input | none — new |
| 3 | stated peers contradict each other | every member equally | `ConsistencyIssue` — exists |

Case 1 outranks case 2 (John: "some inputs to a multi input may be obviously crap - so dont
ignore that"). Check each input's own validity first; fall through to the group mark only when
they all pass. Blaming innocent peers for one bad input would send the user to the wrong field.

Case 2 needs an issue kind the codebase does not have. The existing `ConsistencyIssue`
(`packages/design/engine/consistency.ts:52`) marks every member of a contradicting group equally
— "no member is more at fault than another" — which is right for case 3 and wrong here only in
that the DERIVED field must be excluded from the marking: it holds no value to be wrong.

The record's own quality vocabulary already has the shape case 1 needs —
`openisdSchema.ts:398-400` carries `fields_with_issues`, `missing` and `invalid`.

### Scope when it is picked up

1. The new issue kind, in `packages/design/engine/consistency.ts`.
2. The solve relation joining each pair, in `packages/design/domain/openisdDomain.ts`.
3. UI rendering: marks on input fields, blanks on derived fields
   (`packages/ui/src/logic/fields/fieldRegistry.ts` and the box panels).

## Interim state

Nothing is wired. `tuning_hz` remains a stored value no calculation consumes, on both box types,
and the forward/inverse methods remain uncalled. This is the state the app already shipped in, so
the deferral changes no behaviour.

`addedMassForTuning_kg` was corrected separately and is now safe to wire up when this is built —
see `BUG_20260908_addedMassForTuning_returns_total_mass_not_added_mass.md`. The vented box's
`lengthForTuning_m` has NOT been audited for the same total-vs-delta defect; do that before
wiring it.

FIXME markers are in the code at both pairs, naming this file.

### The tests blocked on it, and an unresolved rule conflict

`packages/ui/test/logic/vent-group.test.ts` holds five tests that each assert a vent field reads
CALCULATED, which cannot happen while nothing solves. They are `describe.skip`ped under this bug.
`packages/ui/test/logic/vent-target-reachability.test.ts` has three more in the same position.

That collides with the unit runner's own rule, which prints "a skip is a fail — make them run, or
delete them" and lists all eight. Neither option is available: they cannot run until this bug is
fixed, and deleting them would discard the specification of what the solver must do — the
behaviour is ruled, only the building is deferred.

The third option, loosening each assertion to match the stub, is the one deliberately NOT taken:
those tests would go green while describing behaviour the app does not have, which is worse than a
visible skip.

Needs a ruling from John: leave them skipped and accept the runner's complaint until this is
built, or something else. Not an agent's call — it is a conflict between two of his own rules.

## Verification

Not applicable — no fix applied.
