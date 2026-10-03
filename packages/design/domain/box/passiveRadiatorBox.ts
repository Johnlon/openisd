import type { Calculatable, Calculated, Clearable, Entered, Precise, Readable, SimpleField, Unsolvable, Writable } from '../cell.js';
import type { SealedLosses } from '../losses.js';
import { OpenISDPassiveRadiatorEmbedded } from '../passiveRadiator/openISDPassiveRadiatorEmbedded.js';
import { OpenISDPassiveRadiatorStandalone } from '../passiveRadiator/openISDPassiveRadiatorStandalone.js';

export interface PassiveRadiatorBox {
    /** Mandatory: judged by `Engine.positiveValueIssue` on read, box-agnostic
     *  (BUG_20260927_box-volume-validity-decided-in-ui.md) — zero, negative or non-finite marks
     *  the field's own `.dq` rather than being coerced. No solve relation otherwise. */
    readonly volume_m3: Readable<number> & Entered & Writable<number>;
    readonly tuning_goal_hz: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;     // WinISD: Fp
    readonly count: SimpleField<number>;            // no solve relation, dimensionless
    readonly addedMass_kg: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly losses: SealedLosses;

    /** Selects or replaces the radiator this box holds — callable any time the user changes their
     *  choice, not once at setup. Takes an `OpenISDPassiveRadiator`, NOT an `OpenISDDriver`: the
     *  two are separate concepts with no shared ancestor, distinguished by which spec section
     *  their record carries, so a driver cannot be passed here and a radiator cannot be passed
     *  where a driver belongs. STANDALONE specifically — a radiator already embedded in some box
     *  is not a thing you choose from a library. Already validated, via
    readonly sealed: SealedBox;
     *  `passiveRadiatorFromConformingRecord()` — its own seam, enforcing its own shape. */
    configurePR(radiator: OpenISDPassiveRadiatorStandalone): void;

    readonly radiator: OpenISDPassiveRadiatorEmbedded;

    /** WinISD's "Fp" — the tuning this box and this radiator ACTUALLY produce together, which is
     *  a different thing from the `tuning_goal_hz` field above: that is the target the user asked for,
     *  this is what the chosen radiator delivers in this volume. Null until a radiator is chosen
     *  and the volume is set. An OUTPUT of the solved pair (S2-7d2) — entry-backed like every
     *  other C/E slot, written by the project cascade, never entered by a user.
     *  Carries the relation's DQ when the target is unreachable (an unattainable `tuning_goal_hz`). */
    readonly systemTuning_hz: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;

    /** The tuning mass this radiator needs to hit `fp_hz` in this box. Read-only WHAT-IF query —
     *  SUPERSEDED as a design entry point by the solved pair: committing a target is
     *  `tuning_goal_hz.set(fp)` and reading `addedMass_kg`. Negative — with DQ — above the bare-cone
     *  ceiling, since that asks for mass to be taken off a cone carrying none. */
    addedMassForTuning_kg(fp_hz: number): Readable<number | null> & Calculated;

    // RESOLVED (QO126): `tuning_goal_hz` is now the writable target end of the solved pair — set fp and
    // `addedMass_kg` reads the required mass (negative + DQ when unreachable); set mass and
    // `tuning_goal_hz` reads the achieved tuning. The pair is one relation seen from two ends, both
    // solver-written fields, stating either deriving the other. The volume stays the axiomatic input.

    /** The tuning this radiator gives this box with NO mass added to the cone: the Box pane's Fh
     *  readout. Mms, Cms are the radiator's own calculated figures (from its Fs, Qms, Vas, Sd). Null until a radiator is chosen and the volume is set. */
    readonly naturalTuning_hz: Readable<number | null> & Calculated;

    /** WinISD's "Fs (with added mass)" — the RADIATOR'S OWN resonance carrying whatever tuning
     *  mass is on its cone, with no box in it. A different quantity from `systemTuning_hz`,
     *  which is this radiator loaded by this box's air. Null until a radiator is chosen and
     *  states the mass and compliance the resonance is made of. An OUTPUT of the solved pair
     *  (S2-7d2), entry-backed like `systemTuning_hz`. Carries the relation's DQ when the pair is
     *  inconsistent (an unreachable target). */
    readonly resonanceWithAddedMass_hz: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
}
