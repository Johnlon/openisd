# Master Architectural Strategy & Implementation Blueprint: `openisdDomain.ts`

> **Architectural Invariant**: `.get()` NEVER does a calculation. All fields are computable if mathematically possible via N-way directed graph solvers. State updates fire eagerly on human stimulus (`.set()`), write both `E` and `C` into the JSON backing store/browser store, and `C` is omitted only when exporting to `openisd.yml`.

```typescript

import { driverSectionProblems, radiatorSectionProblems, ProjectBuilder } from './openisdTransforms.js';
// HUMAN RULING (2026-08-26): GEOMETRY IS IN. ACOUSTICS IS OUT.
// IN: pure geometry (e.g., Vent.area_m2).
// OUT: anything involving air, compliance, resonance, or frequency. Engine handles all acoustics.
// TEST: If two implementers could disagree on the model, it belongs in the engine.

import {
    OpenISDDeviceJson,
// [x] STRATEGY (type DriverSpecsSection):
//     ROLE: Domain type definition supporting schema validation and type soundness.
//     STATUS: GOOD AS-IS. Strict compile-time boundary.
    type DriverSpecsSection,
// [x] STRATEGY (type PassiveRadiatorSpecsSection):
//     ROLE: Domain type definition supporting schema validation and type soundness.
//     STATUS: GOOD AS-IS. Strict compile-time boundary.
    type PassiveRadiatorSpecsSection,
// [x] STRATEGY (type VentJson):
//     ROLE: Domain type definition supporting schema validation and type soundness.
//     STATUS: GOOD AS-IS. Strict compile-time boundary.
    type VentJson,
// [x] STRATEGY (type SealedLossesJson):
//     ROLE: Domain type definition supporting schema validation and type soundness.
//     STATUS: GOOD AS-IS. Strict compile-time boundary.
    type SealedLossesJson,
// [x] STRATEGY (type VentedLossesJson):
//     ROLE: Domain type definition supporting schema validation and type soundness.
//     STATUS: GOOD AS-IS. Strict compile-time boundary.
    type VentedLossesJson,
// [x] STRATEGY (type CoupledSealedLossesJson):
//     ROLE: Domain type definition supporting schema validation and type soundness.
//     STATUS: GOOD AS-IS. Strict compile-time boundary.
    type CoupledSealedLossesJson,
// [x] STRATEGY (type CoupledVentedLossesJson):
//     ROLE: Domain type definition supporting schema validation and type soundness.
//     STATUS: GOOD AS-IS. Strict compile-time boundary.
    type CoupledVentedLossesJson,
// [x] STRATEGY (type CoupledVentedChamberJson):
//     ROLE: Domain type definition supporting schema validation and type soundness.
//     STATUS: GOOD AS-IS. Strict compile-time boundary.
    type CoupledVentedChamberJson,
// [x] STRATEGY (type OpenISDBoxJson):
//     ROLE: Domain type definition supporting schema validation and type soundness.
//     STATUS: GOOD AS-IS. Strict compile-time boundary.
    type OpenISDBoxJson,
// [x] STRATEGY (type OpenISDEnvironmentJson):
//     ROLE: Domain type definition supporting schema validation and type soundness.
//     STATUS: GOOD AS-IS. Strict compile-time boundary.
    type OpenISDEnvironmentJson,
// [x] STRATEGY (type OpenISDProjectJson):
//     ROLE: Domain type definition supporting schema validation and type soundness.
//     STATUS: GOOD AS-IS. Strict compile-time boundary.
    type OpenISDProjectJson,
// [x] STRATEGY (type OpenISDProjectSessionJson):
//     ROLE: Domain type definition supporting schema validation and type soundness.
//     STATUS: GOOD AS-IS. Strict compile-time boundary.
    type OpenISDProjectSessionJson,
    openISDProjectSessionJsonSchema,
    VoiceCoilWiring,
    wiringFromRecord,
    calcVCCon,
    calcNumVC,
    enteredWiring,
    enteredEntry,
    winningValue,
} from './openisdSchema.js';
import {
    createCell,
    focus,
    nullableField,
    requiredField,
    Field,
// [x] STRATEGY (type Lens):
//     ROLE: Domain type definition supporting schema validation and type soundness.
//     STATUS: GOOD AS-IS. Strict compile-time boundary.
    type Lens,
// [x] STRATEGY (type RawField):
//     ROLE: Domain type definition supporting schema validation and type soundness.
//     STATUS: GOOD AS-IS. Strict compile-time boundary.
    type RawField,
} from './cell.js';
import {newUuid} from './newUuid.js';
import {type Air, type AirConstantProvider, Engine, LossMode} from '../engine/index.js';
import { solveDriverConsistencyGroup as solveConsistencyGroup, solveVentConsistencyGroup, checkVentConsistency, solvePrConsistencyGroup, checkPrConsistency } from '../engine/solver.js';
// The DEFINING modules, never `../winisd/index.js`: the barrel also re-exports these two
// converter modules, so importing it here would pull them in whichever name was asked for.
import {openIsdDriverToWinIsdDriver, winIsdDriverTextToOpenIsdDriver} from './driverYmlToOpenisdAndWdr.js';
import {openIsdProjectToWinIsdProject, winIsdProjectToOpenIsdProject} from './openIsdProjectToWinIsdProject.js';
import type {
    BoxType, SimulatableBoxType, ConsistencyIssue, DriverError, Filter,
    EnclosureParams, MaxCurvesResult, Result, SweepParams, SweepResult, DriverSolverQuantities,
} from '../engine/index.js';

import type {Vent, VentShape} from './vent.js';
import type {
    SealedLosses,
    VentedLosses,
    CoupledSealedLosses,
    CoupledVentedLosses,
} from './losses.js';

// The domain declares its state here. JSON shapes live in `openisdSchema.ts`.
// Internal JSON types are never re-exported from `domain/index.ts`.
//
// A module-scoped WeakMap bridge (`notifyProject`/`subscribeToProject`) lets
// `ManagedProject` observe internal `OpenISDProject` changes without exposing
// state publicly.

// [x] STRATEGY (type MetaFieldName):
//     ROLE: Domain type definition supporting schema validation and type soundness.
//     STATUS: GOOD AS-IS. Strict compile-time boundary.
type MetaFieldName =
    'brand' | 'model' | 'manufacturer' | 'provided_by' | 'comment' | 'added';

/** The names of `DriverSpecsSection`'s spec-entry fields. */
// [x] STRATEGY (type PassiveRadiatorFieldName):
//     ROLE: Domain type definition supporting schema validation and type soundness.
//     STATUS: GOOD AS-IS. Strict compile-time boundary.
type PassiveRadiatorFieldName = keyof PassiveRadiatorSpecsSection;


// A package-private WeakMap bridge lets a wrapper read a component's internal
// JSON record without exposing it via a public `toJson()` method.
// This preserves encapsulation while allowing necessary internal state copies.
// ---------------------------------------------------------------------------------------------
// THE BOX — its public shape, then the window that implements it.
// ---------------------------------------------------------------------------------------------

// Box types are imported from engine (engine/types.ts).
// Note: 'bandpass6' and 'abc' are valid WinISD box types (see BUG_20260824),
// but lack circuit models in the engine (`simulatableBoxType()`).
//
// Types are named `...Box` (topology), NOT `...Alignment` (tuning curve).
// Each box type has its own distinct interface rather than relying on index access.

/** A chamber with both a volume and a tuning of its own — bandpass6's and ABC's. */
/** The frequency grid a sweep runs over — the only thing about a sweep `OpenISDProject` does not
 *  already know about itself; everything else `SweepParams` needs comes off the project's own
 *  record. */
// [x] STRATEGY (interface FrequencyGrid):
//     ROLE: Sweep frequency parameter envelope (fmin, fmax, N).
//     STATUS: GOOD AS-IS. Pure data carrier for acoustics sweep execution; no state or derivation.
export interface FrequencyGrid {
    fmin?: number;
    fmax?: number;
    N?: number;
}

// [x] STRATEGY (interface VentedChamber):
//     ROLE: Reusable chamber shape for dual-chamber topologies (bandpass6, ABC).
//     STATUS: GOOD AS-IS. volume_m3 and tuning_hz are Field<number> wired to solver; losses is CoupledVentedLosses.
export interface VentedChamber {
    // [x] STRATEGY (volume_m3):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly volume_m3: Field<number>;
    // [x] STRATEGY (tuning_hz):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly tuning_hz: Field<number>;
    // [x] STRATEGY (losses):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly losses: CoupledVentedLosses;
}

// [ ] STRATEGY (interface SealedBox):
//     ROLE: Sealed enclosure topology contract.
//     STATUS: UPGRADE.
//     DECISION: volume_m3 upgraded to Field<number>; resonance_hz upgraded from method to N-way Field<number>.
//     MECHANICS: Setting resonance_hz solves required volume_m3 via sealedVolumeForResonance(). Pure read on .get().
export interface SealedBox {
    // [ ] STRATEGY (volume_m3):
    //     ROLE: Chamber acoustic net air volume in cubic meters.
    //     STATUS: UPGRADE from RawField<number> to Field<number>.
    //     MECHANICS: Becomes an N-way solvable node in the graph so target resonance/tuning can back-calculate chamber volume.
    readonly volume_m3: RawField<number>;

    /** The resulting system Fc, calculated from the volume and the driver — null when either is
     *  not yet known. A CALCULATION, not a stored field, so a plain method, not a handle. */
    // [ ] STRATEGY (resonance_hz):
    //     ROLE: Closed-box system resonant frequency (Fc / Frc) in Hz.
    //     STATUS: UPGRADE from method to N-way Field<number>.
    //     MECHANICS: .get() reads precomputed Fc from graph. .set(fc) calculates required chamber volume_m3 and updates it.
    resonance_hz(): number | null;

    // [x] STRATEGY (losses):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly losses: SealedLosses;
}

// [x] STRATEGY (interface VentedBox):
//     ROLE: Ported enclosure topology contract.
//     STATUS: GOOD AS-IS.
//     DECISION: volume_m3 and tuning_hz are Field<number> solved bidirectionally with vent geometry via solveVentConsistencyGroup.
export interface VentedBox {
    // [x] STRATEGY (volume_m3):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly volume_m3: Field<number>;
    /** WinISD: Fb — the target frequency, which drives `vent`'s dimensions (or vice versa). */
    // [x] STRATEGY (tuning_hz):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly tuning_hz: Field<number>;
    // [x] STRATEGY (vent):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly vent: Vent;
    // [x] STRATEGY (losses):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly losses: VentedLosses;
}

// Chambers and vents (ports) are two SEPARATE, sibling groupings — never one bundled into the
// other. `chambers.rear`/`chambers.front` carry ONLY volume/tuning/losses, never a vent; every
// port is a flat sibling under `vents` instead, matching the Vents tab's own three-column
// layout ("Rear chamber"/"Front chamber"/"Intrachamber").
// [ ] STRATEGY (interface Bandpass4Box):
//     ROLE: 4th-order bandpass topology contract.
//     STATUS: UPGRADE.
//     DECISION: chambers.rear.resonance_hz upgraded to Field<number> (solves rear volume_m3); chambers.front.volume_m3 upgraded to Field<number>.
export interface Bandpass4Box {
    // [x] STRATEGY (chambers):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly chambers: {
        /** rear = the chamber the driver protrudes into, SEALED — no port, so no `vents.rear`, and
         *  a read-only calculated `resonance_hz()` (WinISD's "Frc") instead of a tuning to enter. */
        // [x] STRATEGY (rear):
        //     ROLE: Internal member of enclosure/device/project.
        //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
        readonly rear: {
            // [x] STRATEGY (volume_m3):
            //     ROLE: Internal member of enclosure/device/project.
            //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
            readonly volume_m3: Field<number>;
            // [ ] STRATEGY (resonance_hz):
            //     ROLE: Closed-box system resonant frequency (Fc / Frc) in Hz.
            //     STATUS: UPGRADE from method to N-way Field<number>.
            //     MECHANICS: .get() reads precomputed Fc from graph. .set(fc) calculates required chamber volume_m3 and updates it.
            resonance_hz(): number | null;
            // [x] STRATEGY (losses):
            //     ROLE: Internal member of enclosure/device/project.
            //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
            readonly losses: CoupledSealedLosses;
        };
        /** front = vented; its volume (`Vf`) has exactly one home — RAW, no Entered/Calculated
         *  distinction, unlike `tuning_hz`, which is part of a solved relation. */
        // [x] STRATEGY (front):
        //     ROLE: Internal member of enclosure/device/project.
        //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
        readonly front: {
            // [ ] STRATEGY (volume_m3):
            //     ROLE: Chamber acoustic net air volume in cubic meters.
            //     STATUS: UPGRADE from RawField<number> to Field<number>.
            //     MECHANICS: Becomes an N-way solvable node in the graph so target resonance/tuning can back-calculate chamber volume.
            readonly volume_m3: RawField<number>;
            // [x] STRATEGY (tuning_hz):
            //     ROLE: Internal member of enclosure/device/project.
            //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
            readonly tuning_hz: Field<number>;
            // [x] STRATEGY (losses):
            //     ROLE: Internal member of enclosure/device/project.
            //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
            readonly losses: CoupledVentedLosses;
        };
    };
    // [x] STRATEGY (vents):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly vents: {
        // [x] STRATEGY (front):
        //     ROLE: Internal member of enclosure/device/project.
        //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
        readonly front: Vent;
    };
}

/** UNLIKE bandpass4: BOTH chambers are vented and independently tunable. */
// [x] STRATEGY (interface Bandpass6Box):
//     ROLE: Enclosure topology shape.
//     STATUS: GOOD AS-IS. Follows dormant-data rule and strict structural typing.
export interface Bandpass6Box {
    // [x] STRATEGY (chambers):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly chambers: {
        // [x] STRATEGY (rear):
        //     ROLE: Internal member of enclosure/device/project.
        //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
        readonly rear: VentedChamber;
        // [x] STRATEGY (front):
        //     ROLE: Internal member of enclosure/device/project.
        //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
        readonly front: VentedChamber;
    };
    // [x] STRATEGY (vents):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly vents: {
        // [x] STRATEGY (rear):
        //     ROLE: Internal member of enclosure/device/project.
        //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
        readonly rear: Vent;
        // [x] STRATEGY (front):
        //     ROLE: Internal member of enclosure/device/project.
        //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
        readonly front: Vent;
    };
}

/**
 * "Aperiodic BI-Chamber" — TWO chambers (rear, front — same shape as bandpass6's, no vent nested
 * in either), THREE ports: rear's own port to outside air, front's own port to outside air, and
 * a third port CONNECTING the two chambers directly (`vents.intra`) — a flat sibling of
 * `vents.rear`/`vents.front`, owned by neither chamber (no `chambers.intra`, no third air
 * volume).
 *
 * The connecting port has NO losses of its own here, deliberately. An earlier cut carried an
 * `intraLosses` field, inferred from the `Qiclfr`/`Qiclfc`/`Qiclcr` names in WinISD's own `.wpr`
 * format — but inference is not evidence: no WinISD screen shows losses for that port, and the
 * live probe (BUG_20260824) never captured an Advanced popup for it, if one even exists. A
 * field with no evidence behind it is a fabrication, so it is gone until a probe finds one.
 */
// [x] STRATEGY (interface AbcBox):
//     ROLE: Enclosure topology shape.
//     STATUS: GOOD AS-IS. Follows dormant-data rule and strict structural typing.
export interface AbcBox {
    // [x] STRATEGY (chambers):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly chambers: {
        // [x] STRATEGY (rear):
        //     ROLE: Internal member of enclosure/device/project.
        //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
        readonly rear: VentedChamber;
        // [x] STRATEGY (front):
        //     ROLE: Internal member of enclosure/device/project.
        //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
        readonly front: VentedChamber;
    };
    // [x] STRATEGY (vents):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly vents: {
        // [x] STRATEGY (rear):
        //     ROLE: Internal member of enclosure/device/project.
        //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
        readonly rear: Vent;
        // [x] STRATEGY (front):
        //     ROLE: Internal member of enclosure/device/project.
        //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
        readonly front: Vent;
        // [x] STRATEGY (intra):
        //     ROLE: Internal member of enclosure/device/project.
        //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
        readonly intra: Vent;
    };
}

// [ ] STRATEGY (interface PassiveRadiatorBox):
//     ROLE: Passive radiator enclosure topology contract.
//     STATUS: UPGRADE.
//     DECISION: volume_m3 upgraded to Field<number>; systemTuning_hz and addedMassForTuning_kg upgraded to precomputed Field models, eradicating lazy getter closures.
export interface PassiveRadiatorBox {
    // [ ] STRATEGY (volume_m3):
    //     ROLE: Chamber acoustic net air volume in cubic meters.
    //     STATUS: UPGRADE from RawField<number> to Field<number>.
    //     MECHANICS: Becomes an N-way solvable node in the graph so target resonance/tuning can back-calculate chamber volume.
    readonly volume_m3: RawField<number>;        // no solve relation
    // [x] STRATEGY (tuning_hz):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly tuning_hz: Field<number>;     // WinISD: Fp
    // [x] STRATEGY (count):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly count: RawField<number>;            // no solve relation, dimensionless
    // [x] STRATEGY (addedMass_kg):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly addedMass_kg: Field<number>;
    // [x] STRATEGY (losses):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly losses: SealedLosses;

    /** Selects or replaces the radiator this box holds — callable any time the user changes their
     *  choice, not once at setup. Takes an `OpenISDPassiveRadiator`, NOT an `OpenISDDriver`: the
     *  two are separate concepts with no shared ancestor, distinguished by which spec section
     *  their record carries, so a driver cannot be passed here and a radiator cannot be passed
     *  where a driver belongs. STANDALONE specifically — a radiator already embedded in some box
     *  is not a thing you choose from a library. Already validated, via
    // [x] STRATEGY (sealed):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly sealed: SealedBox;
     *  `passiveRadiatorFromConformingRecord()` — its own seam, enforcing its own shape. */
    // [x] STRATEGY (configurePR):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    configurePR(radiator: OpenISDPassiveRadiatorStandalone): void;

    // [x] STRATEGY (radiator):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly radiator: OpenISDPassiveRadiatorEmbedded;

    /** WinISD's "Fp" — the tuning this box and this radiator ACTUALLY produce together, which is
     *  a different thing from the `tuning_hz` field above: that is the target the user asked for,
     *  this is what the chosen radiator delivers in this volume. Null until a radiator is chosen
     *  and the volume is set. A CALCULATION, so a method, not a handle. */
    // [x] STRATEGY (systemTuning_hz):
    //     ROLE: Actual delivered passive radiator system tuning (Fp) in Hz for the chosen radiator and volume.
    //     STATUS: GOOD AS-IS on interface.
    //     TYPE: ReadOnlyCalculatedField<number>. Read-only by nature because it reflects what the chosen radiator
    //           physically delivers, as opposed to tuning_hz which is the target dialled in by the user.
    readonly systemTuning_hz: ReadOnlyCalculatedField<number>;

    /** The tuning mass this radiator needs to hit `fp_hz` in this box — the inverse of
     *  `systemTuning_hz()`, and the number a PR design is actually dialled in with. Null on the
     *  same terms, and null when `fp_hz` is above the tuning a bare cone already reaches, since
     *  that asks for mass to be taken off a cone carrying none. */
    // [ ] STRATEGY (addedMassForTuning_kg):
    //     ROLE: Parameterized query for cone mass required to hit target fp in current box.
    //     STATUS: UPGRADE from ReadOnlyCalculatedField factory to N-way Field factory.
    //     MECHANICS: Captured closure over fp. .get() reads mass. .set(mass) solves and updates radiator addedMass_kg.
    addedMassForTuning_kg(fp_hz: number): ReadOnlyCalculatedField<number>;

    // FIXME(QO126): `tuning_hz` above is a stored value NOTHING consumes, and neither this method
    // nor `systemTuning_hz()` is called by anything — so typing a target changes no design.
    // `tuning_hz` and `addedMass_kg` are one relation seen from two ends and must become a solved
    // pair, both read/write/calculated, stating either deriving the other. Ruled and scoped in
    // bugs/BUG_20260908_tuning_and_its_paired_quantity_never_solve_each_other.md; deferred until
    // the packages/model → packages/design migration lands.

    /** WinISD's "Fs (with added mass)" — the RADIATOR'S OWN resonance carrying whatever tuning
     *  mass is on its cone, with no box in it. A different quantity from `systemTuning_hz()`,
     *  which is this radiator loaded by this box's air. Null until a radiator is chosen and
     *  states the mass and compliance the resonance is made of. */
    // [ ] STRATEGY (resonanceWithAddedMass_hz):
    //     ROLE: Radiator free-air resonance carrying current added cone mass in Hz.
    //     STATUS: REVISE.
    //     MECHANICS: Eradicate lazy evaluation closure. Directly read precomputed value pushed by PR solver.
    readonly resonanceWithAddedMass_hz: ReadOnlyCalculatedField<number>;
}

/** The enclosure: which box type is active, and every box type's own fields. All six are
 *  present at once and dormant unless `boxType` names them — the dormant-data rule expressed in
 *  the type, rather than left to callers to honour. */
// [x] STRATEGY (interface Box):
//     ROLE: Enclosure topology shape.
//     STATUS: GOOD AS-IS. Follows dormant-data rule and strict structural typing.
export interface Box {
    // [x] STRATEGY (boxType):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly boxType: RawField<BoxType>;
    // [x] STRATEGY (sealed):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly sealed: SealedBox;
    // [x] STRATEGY (vented):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly vented: VentedBox;
    // [x] STRATEGY (bandpass4):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly bandpass4: Bandpass4Box;
    // [x] STRATEGY (bandpass6):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly bandpass6: Bandpass6Box;
    // [x] STRATEGY (abc):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly abc: AbcBox;
    // [x] STRATEGY (passiveRadiator):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly passiveRadiator: PassiveRadiatorBox;
}

// ---------------------------------------------------------------------------------------------
// THE BOX WINDOW — the implementation of the shapes above, over the stored record.
// ---------------------------------------------------------------------------------------------

/** A sealed chamber's two loss factors, over its stored `SealedLossesJson` — no port, so no
 *  `Qp`; no coupling to another chamber, so no `Qicl` (BUG_20260824's live-confirmed shape). */
// [x] STRATEGY (class SealedLossesWindow):
//     ROLE: Core domain model implementation class for SealedLossesWindow.
//     STATUS: MAINTAIN & ENHANCE. Encapsulates state over immutable JSON records.
class SealedLossesWindow implements SealedLosses {
    // [x] STRATEGY (Ql):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Ql: RawField<number>;
    // [x] STRATEGY (Qa):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Qa: RawField<number>;

    constructor(lens: Lens<SealedLossesJson>) {
        // A `Lens` already IS a `RawField` — same two methods, same meaning — so each loss factor
        // is simply its own lens, with no wrapper in between.
        this.Ql = focus(lens, 'Ql');
        this.Qa = focus(lens, 'Qa');
    }
}

/** A standalone vented chamber's three loss factors, over its stored `VentedLossesJson` — has a
 *  port (`Qp`), no coupling to another chamber (no `Qicl`). */
// [x] STRATEGY (class VentedLossesWindow):
//     ROLE: Core domain model implementation class for VentedLossesWindow.
//     STATUS: MAINTAIN & ENHANCE. Encapsulates state over immutable JSON records.
class VentedLossesWindow implements VentedLosses {
    // [x] STRATEGY (Ql):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Ql: RawField<number>;
    // [x] STRATEGY (Qa):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Qa: RawField<number>;
    // [x] STRATEGY (Qp):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Qp: RawField<number>;

    constructor(lens: Lens<VentedLossesJson>) {
        this.Ql = focus(lens, 'Ql');
        this.Qa = focus(lens, 'Qa');
        this.Qp = focus(lens, 'Qp');
    }
}

/** A sealed chamber coupled to another (bandpass4's rear), over its stored
 *  `CoupledSealedLossesJson` — no port (no `Qp`), coupled to the other chamber (`Qicl`). */
// [x] STRATEGY (class CoupledSealedLossesWindow):
//     ROLE: Core domain model implementation class for CoupledSealedLossesWindow.
//     STATUS: MAINTAIN & ENHANCE. Encapsulates state over immutable JSON records.
class CoupledSealedLossesWindow implements CoupledSealedLosses {
    // [x] STRATEGY (Ql):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Ql: RawField<number>;
    // [x] STRATEGY (Qa):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Qa: RawField<number>;
    // [x] STRATEGY (Qicl):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Qicl: RawField<number>;

    constructor(lens: Lens<CoupledSealedLossesJson>) {
        this.Ql = focus(lens, 'Ql');
        this.Qa = focus(lens, 'Qa');
        this.Qicl = focus(lens, 'Qicl');
    }
}

/** A vented chamber coupled to another (bandpass4's front, bandpass6's and ABC's rear/front),
 *  over its stored `CoupledVentedLossesJson` — has a port AND a coupling, all four factors. */
// [x] STRATEGY (class CoupledVentedLossesWindow):
//     ROLE: Core domain model implementation class for CoupledVentedLossesWindow.
//     STATUS: MAINTAIN & ENHANCE. Encapsulates state over immutable JSON records.
class CoupledVentedLossesWindow implements CoupledVentedLosses {
    // [x] STRATEGY (Ql):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Ql: RawField<number>;
    // [x] STRATEGY (Qa):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Qa: RawField<number>;
    // [x] STRATEGY (Qp):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Qp: RawField<number>;
    // [x] STRATEGY (Qicl):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Qicl: RawField<number>;

    constructor(lens: Lens<CoupledVentedLossesJson>) {
        this.Ql = focus(lens, 'Ql');
        this.Qa = focus(lens, 'Qa');
        this.Qp = focus(lens, 'Qp');
        this.Qicl = focus(lens, 'Qicl');
    }
}

/** One port. `area_m2()` follows `shape` — a round vent's area comes from its diameter, a
 *  slotted one's from width × height — so switching shape changes the answer without any stored
 *  value having to be recomputed or migrated. */
// [x] STRATEGY (class VentWindow):
//     ROLE: Core domain model implementation class for VentWindow.
//     STATUS: MAINTAIN & ENHANCE. Encapsulates state over immutable JSON records.
class VentWindow implements Vent {
    // [x] STRATEGY (#lens):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly #lens: Lens<VentJson>;
    // [x] STRATEGY (#engine):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly #engine: Engine;
    // [x] STRATEGY (shape):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly shape: RawField<VentShape>;
    // [x] STRATEGY (endCorrection_m):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly endCorrection_m: RawField<number>;

    // [x] STRATEGY (diameter_m):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly diameter_m: Field<number>;
    // [x] STRATEGY (width_m):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly width_m: Field<number>;
    // [x] STRATEGY (height_m):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly height_m: Field<number>;
    // [x] STRATEGY (length_m):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly length_m: Field<number>;

    constructor(lens: Lens<VentJson>, engine: Engine, ventContext?: { getVb: () => number | null; getTuningHz: () => number | null; clearTuningHz?: () => void }) {
        this.#lens = lens;
        this.#engine = engine;
        this.shape = focus(lens, 'shape');
        this.endCorrection_m = focus(lens, 'endCorrection_m');
        this.diameter_m = nullableField(lens, 'diameter_m');
        this.width_m = nullableField(lens, 'width_m');
        this.height_m = nullableField(lens, 'height_m');
        const rawLengthLens = focus(lens, 'length_m');
        this.length_m = new Field<number>(
            () => {
                const rawL = rawLengthLens.get();
                const ventContextFb = ventContext?.getTuningHz() ?? null;
                const ventContextVb = ventContext?.getVb() ?? null;
                const solved = solveVentConsistencyGroup({
                    tuning_hz: ventContextFb ?? undefined,
                    length_m: rawL ?? undefined,
                    Vb_m3: ventContextVb ?? undefined,
                    area_m2: this.area_m2() ?? undefined,
                    endCorrection_m: this.endCorrection_m.get(),
                });
                const issues = checkVentConsistency(solved);
                const issue = issues.find(i => i.fields.includes('length_m') || i.fields.includes('tuning_hz'));
                const dq = issue ? issue.formula : null;

                if (rawL !== null) {
                    return createCell<number>('', rawL, 'entered', dq ? [dq] : undefined);
                }
                if (solved.length_m != null) {
                    return createCell<number>('', solved.length_m, 'calculated', dq ? [dq] : undefined);
                }
                return createCell<number>('', null, 'not-available');
            },
            (v) => {
                rawLengthLens.set(v);
            },
            () => rawLengthLens.set(null),
        );
    }

    /** Cross-sectional area of the port opening.
     *
     *  PLAIN GEOMETRY, and that is why it is allowed to live here (John 2026-08-26: "simple
     *  geometric calc like pi r squared are ok in the domain"). The line the domain must not cross
     *  is ACOUSTICS — anything involving air, compliance, resonance or an end correction. The area
     *  of a circle involves none of those and has no parity question: πr² is πr² in every model.
     *
     *  Null rather than 0 (a real, if absurd, port area) or NaN — absence is spelled ONE way in
     *  this domain, the same `null` a `Cell` carries. */
    // [ ] STRATEGY (area_m2):
    //     ROLE: Port cross-sectional opening area in square meters.
    //     STATUS: UPGRADE from method to N-way Field<number>.
    //     MECHANICS: Pure read on .get(). .set(area) derives round diameter or solves slotted rectangular dimensions (preserving aspect ratio or defaulting to square).
    area_m2(): number | null {
        const v = this.#lens.get();
        if (v.shape === 'round') {
            return v.diameter_m === null ? null : Math.PI * (v.diameter_m / 2) ** 2;
        }
        return v.width_m === null || v.height_m === null ? null : v.width_m * v.height_m;
    }

    /** Acoustic length — the physical length plus the end correction, which is what the sweep's
     *  port model actually resonates (`SweepParams.Leff`).
     *
     *  The end correction models how air outside the port behaves, so it is ACOUSTICS and the
     *  engine owns it. The domain supplies the port's own geometry — its length and its area, both
     *  of which it legitimately knows — and reports what comes back. */
    // [ ] STRATEGY (effectiveLength_m):
    //     ROLE: Port acoustic length including end-corrections in meters.
    //     STATUS: UPGRADE from method to N-way Field<number>.
    //     MECHANICS: Pure read of Leff on .get(). .set(leff) sets physical length_m = leff - endCorrection.
    effectiveLength_m(): number | null {
        const length_m = this.length_m.get().value;
        const Sp = this.area_m2();
        if (length_m === null || Sp === null) return null;
        return this.#engine.ventEffectiveLength(length_m, Sp, this.#lens.get().endCorrection_m);
    }

    // [ ] STRATEGY (tuningIn_hz):
    //     ROLE: Parameterized port tuning query for a given chamber volume.
    //     STATUS: UPGRADE from method returning number|null to Field factory returning Field<number>.
    //     MECHANICS: Captured closure over Vb. .get() returns tuning in Vb. .set(fb) solves required port length_m in Vb and updates length_m.
    tuningIn_hz(volume_m3: number | null): number | null {
        const length_m = this.length_m.get().value;
        const Sp = this.area_m2();
        if (volume_m3 === null || !(volume_m3 > 0) || length_m === null || Sp === null) return null;
        return this.#engine.tuningFromLength(volume_m3, length_m, Sp, this.#lens.get().endCorrection_m);
    }

    // [ ] STRATEGY (lengthForTuning_m):
    //     ROLE: Parameterized physical port length query for a given Vb and target Fb.
    //     STATUS: UPGRADE from method returning number|null to Field factory returning Field<number>.
    //     MECHANICS: Captured closure over Vb, Fb. .get() returns length. .set(len) solves required port area_m2 and updates dimensions.
    lengthForTuning_m(volume_m3: number | null, fb_hz: number): number | null {
        const Sp = this.area_m2();
        if (volume_m3 === null || !(volume_m3 > 0) || !(fb_hz > 0) || Sp === null) return null;
        return this.#engine.ventLength(volume_m3, fb_hz, Sp, this.#lens.get().endCorrection_m);
    }
}

/** A chamber with both a volume and a tuning of its own — bandpass6's and ABC's, and the shape
 *  `VentedChamber` names in `box.ts`. */
// [x] STRATEGY (class VentedChamberWindow):
//     ROLE: Core domain model implementation class for VentedChamberWindow.
//     STATUS: MAINTAIN & ENHANCE. Encapsulates state over immutable JSON records.
class VentedChamberWindow {
    // [x] STRATEGY (volume_m3):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly volume_m3: Field<number>;
    // [x] STRATEGY (tuning_hz):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly tuning_hz: Field<number>;
    // [x] STRATEGY (losses):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly losses: CoupledVentedLosses;

    constructor(lens: Lens<CoupledVentedChamberJson>) {
        this.volume_m3 = requiredField(lens, 'volume_m3', 'volume_m3');
        this.tuning_hz = nullableField(lens, 'tuning_hz');
        this.losses = new CoupledVentedLossesWindow(focus(lens, 'losses'));
    }
}

/** One field of an embedded radiator's section. */
// [x] STRATEGY (function prSpec):
//     ROLE: Domain helper / constructor.
//     STATUS: GOOD AS-IS. Pure function operating over lenses and records.
function prSpec(
    lens: Lens<OpenISDDeviceJson>,
    key: PassiveRadiatorFieldName,
): Field<number> {
    return new Field<number>(
        () => {
            const spec = lens.get().specs['passive-radiator'];
            // A key ABSENT from the section means the radiator does not state that parameter.
            const v = winningValue(spec?.[key]);
            return createCell('', v, v === null ? 'not-available' : 'entered');
        },
        (v) => {
            const json = lens.get();
            const spec = json.specs['passive-radiator'] ?? {};
            lens.set({
                ...json,
                specs: {...json.specs, 'passive-radiator': {...spec, [key]: enteredEntry(v)}},
            });
        },
        () => {
            const json = lens.get();
            const spec = json.specs['passive-radiator'];
            if (!spec) return;
            const {[key]: _removed, ...rest} = spec;
            lens.set({
                ...json,
                specs: {...json.specs, 'passive-radiator': rest},
            });
        },
    );
}

/** A T/S field of the chosen passive radiator, out of its own `passive-radiator` spec section.
 *  Same not-chosen handling as `prMeta`, plus the section invariant `OpenISDPassiveRadiator`
 *  already guarantees: a record that reached `configurePR()` came through that class, which
 *  refuses to construct without the section, so it is present whenever a component is. */

/** The parameters required to solve passive radiator tuning and mass. */
// [x] STRATEGY (interface PrEngineParams):
//     ROLE: Domain helper / constructor.
//     STATUS: GOOD AS-IS. Pure function operating over lenses and records.
export interface PrEngineParams {
    Vb: number;
    prMmd: number;
    prMadd: number;
    prSd: number;
    prCms: number;
}

/**
 * The box, as a window onto its slice of the project record — AND holding a reference to the
 * containing `OpenISDProject` itself.
 *
 * The project reference is what lets a component answer a question that spans siblings. Fc is
 * the case in point: it depends on the box's volume AND on the driver's Fs/Sd/Cms, and the box
 * cannot see the driver on its own. An earlier version had the project inject a
 * `SealedResonanceFn` callback instead — one bespoke hole punched for one calculation, which
 * would need another hole for the next cross-component question (a vent's air mass needs the
 * environment; a PR's tuning needs the box volume it sits in). Holding the project answers all
 * of them at once.
 *
 * A box is ALWAYS part of a project, so the reference is mandatory and never null. That is not
 * true of a driver — one can be standalone (a My Drivers entry, a bundle row, a `detach()`ed
 * copy) — which is why `OpenISDDriver` does NOT take a project. Making it take one would force
 * every standalone driver to invent a project it is not part of.
 *
 * The box reaches the driver through its PUBLIC surface (`project.driver.Fs_hz.get()`), never
 * through the record — the privacy rule holds inside the module too.
 */
// [x] STRATEGY (class OpenISDBox):
//     ROLE: Core domain model implementation class for OpenISDBox.
//     STATUS: MAINTAIN & ENHANCE. Encapsulates state over immutable JSON records.
class OpenISDBox implements Box {
    // [x] STRATEGY (boxType):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly boxType: RawField<BoxType>;

    // [x] STRATEGY (sealed):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly sealed: SealedBox;
    // [x] STRATEGY (vented):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly vented: VentedBox;
    // [x] STRATEGY (bandpass4):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly bandpass4: Bandpass4Box;
    // [x] STRATEGY (bandpass6):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly bandpass6: Bandpass6Box;
    // [x] STRATEGY (abc):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly abc: AbcBox;
    // [x] STRATEGY (passiveRadiator):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly passiveRadiator: PassiveRadiatorBox;

    /** The driver this box loads, read through its PUBLIC field surface — never its record. A
     *  chamber's resonance depends on the driver, and this is the only thing the box needs it for. */
    // [x] STRATEGY (#driver):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly #driver: OpenISDDriverEmbedded;
    /** The one calculation surface. Injected, never constructed here. */
    // [x] STRATEGY (#engine):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly #engine: Engine;
    /** The project's own air, resolved at CALL time so a chamber follows the environment the user
     *  states rather than whichever one happened to be current at construction. */
    // [x] STRATEGY (#environment):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly #environment: () => OpenISDEnvironmentJson;

    private constructor(
        lens: Lens<OpenISDBoxJson>,
        driver: OpenISDDriverEmbedded,
        engine: Engine,
        environment: () => OpenISDEnvironmentJson,
    ) {
        this.#driver = driver;
        this.#engine = engine;
        this.#environment = environment;
        this.boxType = focus(lens, 'boxType');

        const sealedLens = focus(lens, 'sealed');
        const sealedVolume = focus(sealedLens, 'volume_m3');
        const sealedLosses = new SealedLossesWindow(focus(sealedLens, 'losses'));
        this.sealed = {
            volume_m3: sealedVolume,
            resonance_hz: () => this.#sealedResonance_hz(sealedVolume.get(), sealedLosses),
            losses: sealedLosses,
        };

        const ventedLens = focus(lens, 'vented');
        const ventedChamber = focus(ventedLens, 'chamber');
        const rawVentedTuningLens = focus(ventedChamber, 'tuning_hz');
        const rawVentLengthLens = focus(focus(ventedLens, 'vent'), 'length_m');
        const ventWindow = new VentWindow(focus(ventedLens, 'vent'), engine, {
            getVb: () => this.vented.volume_m3.get().value,
            getTuningHz: () => rawVentedTuningLens.get(),
            clearTuningHz: () => rawVentedTuningLens.set(null),
        });
        const ventedTuning = new Field<number>(
            () => {
                const rawFb = rawVentedTuningLens.get();
                const rawL = rawVentLengthLens.get();
                const Vb = this.vented.volume_m3.get().value;
                const solved = solveVentConsistencyGroup({
                    tuning_hz: rawFb ?? undefined,
                    length_m: rawL ?? undefined,
                    Vb_m3: Vb ?? undefined,
                    area_m2: ventWindow.area_m2() ?? undefined,
                    endCorrection_m: ventWindow.endCorrection_m.get(),
                });
                const issues = checkVentConsistency(solved);
                const issue = issues.find(i => i.fields.includes('tuning_hz') || i.fields.includes('length_m'));
                const dq = issue ? issue.formula : null;

                if (rawFb !== null) {
                    return createCell<number>('', rawFb ?? undefined, 'entered', dq ? [dq] : undefined);
                }
                if (solved.tuning_hz != null) {
                    return createCell<number>('', solved.tuning_hz, 'calculated', dq ? [dq] : undefined);
                }
                return createCell<number>('', null, 'not-available');
            },
            (v) => {
                rawVentedTuningLens.set(v);
            },
            () => rawVentedTuningLens.set(null),
        );
        this.vented = {
            volume_m3: requiredField(ventedChamber, 'volume_m3', 'vented.volume_m3'),
            tuning_hz: ventedTuning,
            vent: ventWindow,
            losses: new VentedLossesWindow(focus(ventedChamber, 'losses')),
        };

        const bp4 = focus(lens, 'bandpass4');
        const bp4Rear = focus(bp4, 'rear');
        const bp4RearLosses = new CoupledSealedLossesWindow(focus(bp4Rear, 'losses'));
        const bp4Front = focus(bp4, 'front');
        this.bandpass4 = {
            chambers: {
                // rear is SEALED — no port, so no `vents.rear`, and a read-only calculated
                // `resonance_hz()` (WinISD's "Frc") stands in for the tuning it cannot be given.
                rear: {
                    volume_m3: requiredField(bp4Rear, 'volume_m3', 'bandpass4.rear.volume_m3'),
                    // LOSSLESS here, unlike the plain sealed box above, because that is what
                    // WinISD itself writes for a bandpass4 rear chamber. Two goldens written by
                    // the same winisd.exe 89 seconds apart with the identical driver, identical
                    // Vr=0.02 and identical Qlr/Qar, differing only in BType: sealed-small.wpr
                    // carries the LOSSY Fr=61.267…, bandpass4.wpr the LOSSLESS Fr=58.3392371416399
                    // (= Fs·√(1+Vas/Vr), matched to 13 significant figures). The rear chamber's
                    // damping is already carried by Qlr/Qar in the bandpass circuit.
                    resonance_hz: () => this.#sealedResonance_hz(
                        // [x] STRATEGY (focus):
                        //     ROLE: Internal member of enclosure/device/project.
                        //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
                        focus(bp4Rear, 'volume_m3').get(), bp4RearLosses, LossMode.Lossless),
                    losses: bp4RearLosses,
                },
                // front's volume is RAW — it has exactly one home and is not part of a solved
                // relation, unlike its tuning.
                front: {
                    volume_m3: focus(bp4Front, 'volume_m3'),
                    tuning_hz: nullableField(bp4Front, 'tuning_hz'),
                    losses: new CoupledVentedLossesWindow(focus(bp4Front, 'losses')),
                },
            },
            vents: {front: new VentWindow(focus(bp4, 'frontVent'), engine)},
        };

        const bp6 = focus(lens, 'bandpass6');
        this.bandpass6 = {
            chambers: {
                rear: new VentedChamberWindow(focus(bp6, 'rear')),
                front: new VentedChamberWindow(focus(bp6, 'front')),
            },
            vents: {
                rear: new VentWindow(focus(bp6, 'rearVent'), engine),
                front: new VentWindow(focus(bp6, 'frontVent'), engine),
            },
        };

        const abc = focus(lens, 'abc');
        this.abc = {
            chambers: {
                rear: new VentedChamberWindow(focus(abc, 'rear')),
                front: new VentedChamberWindow(focus(abc, 'front')),
            },
            // Three ports, flat siblings: rear's and front's own ports to outside air, plus the
            // connecting port between the chambers — owned by neither, which is why it sits here and
            // not inside a chamber.
            vents: {
                rear: new VentWindow(focus(abc, 'rearVent'), engine),
                front: new VentWindow(focus(abc, 'frontVent'), engine),
                intra: new VentWindow(focus(abc, 'intraVent'), engine),
            },
        };

        const pr = focus(lens, 'passiveRadiator');
        const prSlot = focus(pr, 'component');
        const getRadiator = (): OpenISDPassiveRadiatorEmbedded => {
            let component = prSlot.get();
            if (!component) {
                component = {
                    uuid: { value: 'blank-pr', origin: 'UI' },
                    quality: {
                        confirmed_fields: [],
                        fields_with_issues: [],
                        missing: [],
                        invalid: [],
                        parse_errors: [],
                        cross_source_only: [],
                    },
                    manufacturer: { value: 'Blank', origin: 'UI' },
                    brand: { value: 'Blank', origin: 'UI' },
                    model: { value: 'Passive Radiator', origin: 'UI' },
                    sku: { value: 'blank-pr', origin: 'UI' },
                    driver_type: { value: 'Passive Radiator', origin: 'UI' },
                    data_sources: { value: {}, origin: 'UI' },
                    authoritative: { value: 'UI', origin: 'UI' },
                    specs: { 'passive-radiator': {} }
                } as any;
                prSlot.set(component);
            }
            return new OpenISDPassiveRadiatorEmbedded({ get: () => prSlot.get() as OpenISDDeviceJson, set: v => prSlot.set(v) }, engine);
        };
        const prVolume = focus(pr, 'volume_m3');
        const rawPrAddedMassLens = focus(pr, 'addedMass_kg');
        const rawPrTuningLens = focus(pr, 'tuning_hz');
        const prAddedMass = new Field<number>(
            () => {
                const rawMass = rawPrAddedMassLens.get();
                const rawTuning = rawPrTuningLens.get();
                const Vb = prVolume.get() || this.vented.volume_m3.get().value;
                const solved = solvePrConsistencyGroup({
                    tuning_hz: rawTuning ?? undefined,
                    addedMass_kg: rawMass ?? undefined,
                    Vb_m3: Vb ?? undefined,
                    prMmd_kg: getRadiator()?.spec.Mms_kg.get().value ?? undefined,
                    prSd_m2: getRadiator()?.spec.Sd_m2.get().value ?? undefined,
                    prCms_m_per_N: getRadiator()?.spec.Cms_m_per_N.get().value ?? undefined,
                    prNum: focus(pr, 'count').get(),
                });
                const issues = checkPrConsistency(solved);
                const issue = issues.find(i => i.fields.includes('addedMass_kg') || i.fields.includes('tuning_hz'));
                const dq = issue ? issue.formula : null;

                if (rawMass !== null) {
                    return createCell<number>('', rawMass ?? undefined, 'entered', dq ? [dq] : undefined);
                }
                if (solved.addedMass_kg != null) {
                    return createCell<number>('', solved.addedMass_kg, 'calculated', dq ? [dq] : undefined);
                }
                return createCell<number>('', null, 'not-available');
            },
            (v) => {
                const cur = pr.get();
                pr.set({ ...cur, addedMass_kg: v, tuning_hz: null });
            },
            () => rawPrAddedMassLens.set(null),
        );
        const prTuning = new Field<number>(
            () => {
                const rawTuning = rawPrTuningLens.get();
                const rawMass = rawPrAddedMassLens.get();
                const Vb = prVolume.get() || this.vented.volume_m3.get().value;
                const solved = solvePrConsistencyGroup({
                    tuning_hz: rawTuning ?? undefined,
                    addedMass_kg: rawMass ?? undefined,
                    Vb_m3: Vb ?? undefined,
                    prMmd_kg: getRadiator()?.spec.Mms_kg.get().value ?? undefined,
                    prSd_m2: getRadiator()?.spec.Sd_m2.get().value ?? undefined,
                    prCms_m_per_N: getRadiator()?.spec.Cms_m_per_N.get().value ?? undefined,
                    prNum: focus(pr, 'count').get(),
                });
                const issues = checkPrConsistency(solved);
                const issue = issues.find(i => i.fields.includes('tuning_hz') || i.fields.includes('addedMass_kg'));
                const dq = issue ? issue.formula : null;

                if (rawTuning !== null) {
                    return createCell<number>('', rawTuning ?? undefined, 'entered', dq ? [dq] : undefined);
                }
                if (solved.tuning_hz != null) {
                    return createCell<number>('', solved.tuning_hz, 'calculated', dq ? [dq] : undefined);
                }
                return createCell<number>('', null, 'not-available');
            },
            (v) => {
                const cur = pr.get();
                pr.set({ ...cur, tuning_hz: v, addedMass_kg: null });
            },
            () => rawPrTuningLens.set(null),
        );
        this.passiveRadiator = {
            volume_m3: prVolume,
            tuning_hz: prTuning,
            count: focus(pr, 'count'),
            addedMass_kg: prAddedMass,
            losses: new SealedLossesWindow(focus(pr, 'losses')),
            // The embedded radiator adopts the chosen one — a radiator reading another radiator's
            // record, legal because both derive from the class that declares `slot`.
            configurePR: (chosen: OpenISDPassiveRadiatorStandalone) => {
                const current = prSlot.get();
                const cloned = chosen.clonePassiveRadiator();
                if (!current) {
                    prSlot.set(cloned);
                } else {
                    prSlot.set({ ...current, ...cloned });
                }
            },
            // [x] STRATEGY (radiator):
            //     ROLE: Internal member of enclosure/device/project.
            //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
            get radiator() {
                return getRadiator();
            },
            // [ ] STRATEGY (systemTuning_hz):
            //     ROLE: Actual delivered PR system tuning (Fp) in Hz.
            //     STATUS: REVISE.
            //     MECHANICS: Eradicate lazy getter closure. Pure read of precomputed solver graph. .set(fp) updates target tuning_hz.
            get systemTuning_hz() {
                return new ReadOnlyCalculatedField<number>(() => {
                    const Vb = prVolume.get() || this.vented.volume_m3.get().value;
                    const r = getRadiator();
                    const solved = solvePrConsistencyGroup({
                        addedMass_kg: rawPrAddedMassLens.get() ?? undefined,
                        Vb_m3: Vb ?? undefined,
                        prMmd_kg: r.spec.Mms_kg.get().value ?? undefined,
                        prSd_m2: r.spec.Sd_m2.get().value ?? undefined,
                        prCms_m_per_N: r.spec.Cms_m_per_N.get().value ?? undefined,
                        prNum: focus(pr, 'count').get(),
                    });
                    const issues = checkPrConsistency(solved);
                    const issue = issues.find(i => i.fields.includes('tuning_hz'));
                    const dq = issue ? issue.formula : null;
                    if (solved.systemTuning_hz != null) {
                        return createCell('systemTuning_hz', solved.systemTuning_hz, 'calculated', dq ? [dq] : undefined);
                    }
                    return createCell('systemTuning_hz', null, 'not-available');
                });
            },
            addedMassForTuning_kg: (fp_hz: number) => {
                return new ReadOnlyCalculatedField<number>(() => {
                    const Vb = prVolume.get() || this.vented.volume_m3.get().value;
                    const r = getRadiator();
                    const solved = solvePrConsistencyGroup({
                        tuning_hz: fp_hz > 0 ? fp_hz : undefined,
                        Vb_m3: Vb ?? undefined,
                        prMmd_kg: r.spec.Mms_kg.get().value ?? undefined,
                        prSd_m2: r.spec.Sd_m2.get().value ?? undefined,
                        prCms_m_per_N: r.spec.Cms_m_per_N.get().value ?? undefined,
                        prNum: focus(pr, 'count').get(),
                    });
                    const issues = checkPrConsistency(solved);
                    const issue = issues.find(i => i.fields.includes('addedMass_kg'));
                    const dq = issue ? issue.formula : null;
                    if (solved.addedMass_kg != null) {
                        return createCell('addedMassForTuning_kg', solved.addedMass_kg, 'calculated', dq ? [dq] : undefined);
                    }
                    return createCell('addedMassForTuning_kg', null, 'not-available');
                });
            },
            // [ ] STRATEGY (resonanceWithAddedMass_hz):
            //     ROLE: Radiator free-air resonance carrying current added cone mass in Hz.
            //     STATUS: REVISE.
            //     MECHANICS: Eradicate lazy evaluation closure. Directly read precomputed value pushed by PR solver.
            get resonanceWithAddedMass_hz() {
                return new ReadOnlyCalculatedField<number>(() => {
                    const r = getRadiator();
                    const solved = solvePrConsistencyGroup({
                        addedMass_kg: rawPrAddedMassLens.get() ?? undefined,
                        prMmd_kg: r.spec.Mms_kg.get().value ?? undefined,
                        prCms_m_per_N: r.spec.Cms_m_per_N.get().value ?? undefined,
                    });
                    if (solved.resonanceWithAddedMass_hz != null) {
                        return createCell('resonanceWithAddedMass_hz', solved.resonanceWithAddedMass_hz, 'calculated');
                    }
                    return createCell('resonanceWithAddedMass_hz', null, 'not-available');
                });
            },
        };
    }

    /** Takes the lens onto the project's `box` slot. The project owns that slot and builds the
     *  lens, so the box needs no reference back to the project. */
    // [x] STRATEGY (wrap):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    static wrap(
        slot: Lens<OpenISDBoxJson>,
        driver: OpenISDDriverEmbedded,
        engine: Engine,
        environment: () => OpenISDEnvironmentJson,
    ): OpenISDBox {
        return new OpenISDBox(slot, driver, engine, environment);
    }

    /**
     * A sealed chamber's resonance, through the INJECTED engine and in the PROJECT'S OWN air.
     *
     * Null whenever the driver has not stated what the calculation needs, or the volume is not
     * set — absence is `null` here as everywhere, never 0 and never a throw.
     *
     * The domain does none of the physics: it hands over the driver's stored values, the volume,
     * the chamber's losses and the environment, and the engine derives Vas and the resonance.
     *
     * LOSSLESS, and NOT by preference — `DriverSpecsSection` stores no `Qts`, and both lossy models need
     * it (the lossless `Fsc` is the one figure that does not). So this is the only resonance the
     * domain's own driver record can express today.
     *
     * That matters for parity: WinISD displays and saves the LOSSY figure — measured, `Fr` moves
     * 5.8 Hz for a `Ql` change at fixed volume (`winisd_research` FINDING-007). Matching it needs
     * `Qts` in the driver record, which is a decision about the record, not about this method.
     */
    // [x] STRATEGY (#sealedResonance_hz):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    #sealedResonance_hz(volume_m3: number | null, losses: SealedLosses,
                        mode: LossMode = LossMode.Default): number | null {
        const spec = this.#driver.spec[this.#driver.section];
        const Fs_hz = spec.Fs_hz.get().value;
        const Sd_m2 = spec.Sd_m2.get().value;
        const Cms = spec.Cms_m_per_N.get().value;
        if (volume_m3 === null || Fs_hz === null || Sd_m2 === null || Cms === null) return null;

        const env = this.#environment();
        const air = this.#engine.airFor({
            tempK: env.temperature_K ?? undefined,
            humidityPct: env.humidity_pct ?? undefined,
            pressurePa: env.pressure_Pa ?? undefined,
        });
        const Qts = spec.Qts.get().value;
        if (Qts === null) return null;
        // `LossMode.Default` IS `WinisdLossy` — John 2026-08-27: "default is winisd = Lossy". WinISD
        // displays and saves the LOSSY figure, and it MOVES with the chamber's losses: measured, `Fr`
        // shifts 5.8 Hz for a `Ql` change at fixed volume (winisd_research FINDING-007).
        return this.#engine.sealedResonanceFromCompliance(
            mode,
            {Fs_hz, Qts, Sd_m2, Cms_m_per_N: Cms, volume_m3, Ql: losses.Ql.get(), Qa: losses.Qa.get()},
            air,
        );
    }


}

// ---------------------------------------------------------------------------------------------
// THE DRIVER, THE PROJECT, AND THE LAYERS OVER THEM.
// ---------------------------------------------------------------------------------------------

// The main domain models are declared together in this file to share the package-private
// `notifyProject`/`subscribeToProject` WeakMap bridge for reactivity.
// Record shapes are defined in `storage.ts` to share between driver and box logic.

/**
 * A real, playable driver — its record has a `woofer` or `tweeter` section.
 *
 * ABSTRACT, with two concrete kinds, because "a driver in a project" and "a driver on its own"
 * are genuinely different things and the type should say so rather than one class carrying a
 * nullable project:
 *   - `OpenISDDriverEmbedded` — part of an `OpenISDProject`, holds a reference to it, and can be
 *     REPLACED wholesale via `update()`.
 *   - `OpenISDDriverStandalone` — a My Drivers entry, a bundle row, or a detached copy. No
 *     project, because it is not in one.
 * Both are WINDOWS onto a record living wherever their owner keeps it — never an internal copy.
 *
 * Neither constructs from a record with no woofer/tweeter section: a record that incomplete
 * never becomes a driver at all, it is rejected before a window is opened onto it. (Flagging
 * such a record in the driver list and refusing selection is the app's job, outside this
 * package — this refusal is the safety net that check relies on, not a duplicate of it.) So
 * every field below can assume its spec section exists for the instance's whole lifetime.
 *
 * Every `Field` is built ONCE, eagerly, in the constructor, not lazily per getter access — a
 * lazy `get Fs_hz()` allocates a new `Field` per access, so `driver.Fs_hz !== driver.Fs_hz`,
 * which breaks object-identity-based reactivity by making every read look like a change.
 * Building once makes the identity stable for the instance's lifetime, while `.get()` still
 * reads live off `read()` every call — the closures capture `this` and dereference at CALL
 * time, never a json snapshot, which is what makes eager construction safe even though
 * `write()` REASSIGNS the record.
 */
/**
 * Window onto a single `DriverSpecsSection` of a driver record.
 * 
 * Field names carry their unit suffix (e.g. `Fs_hz`, `Rms_kg_per_s`) to report the stored SI unit.
 * Dimensionless parameters (`Qts`, `Qes`, etc.) have no suffix.
 * 
 * Fields are constructed eagerly to preserve object identity for reactivity.
 */
// [x] STRATEGY (class OpenIsdDriverSpec):
//     ROLE: Core domain model implementation class for OpenIsdDriverSpec.
//     STATUS: MAINTAIN & ENHANCE. Encapsulates state over immutable JSON records.
export class OpenIsdDriverSpec {
    // Thiele/Small.
    // [x] STRATEGY (Fs_hz):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Fs_hz: Field<number>;
    // [x] STRATEGY (Re_ohm):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Re_ohm: Field<number>;
    // [x] STRATEGY (Le_H):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Le_H: Field<number>;
    // [x] STRATEGY (fLe_hz):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly fLe_hz: Field<number>;
    /** `Le·√(2π·fLe)` — the Vanderkooy lossy-inductance coefficient (`WINISD_PARITY.md:1009`,
     *  `GHIDRA_FINDINGS.md:1039`). Henries times the square root of hertz; not dimensionless. */
    // [x] STRATEGY (KLe_H_sqrtHz):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly KLe_H_sqrtHz: Field<number>;
    // [x] STRATEGY (Znom_ohm):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Znom_ohm: Field<number>;
    // [x] STRATEGY (Qts):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Qts: Field<number>;
    // [x] STRATEGY (Qes):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Qes: Field<number>;
    // [x] STRATEGY (Qms):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Qms: Field<number>;
    // [x] STRATEGY (Vas_m3):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Vas_m3: Field<number>;
    // [x] STRATEGY (Sd_m2):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Sd_m2: Field<number>;
    // [x] STRATEGY (BL_Tm):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly BL_Tm: Field<number>;
    // [x] STRATEGY (Mms_kg):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Mms_kg: Field<number>;
    // [x] STRATEGY (Cms_m_per_N):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Cms_m_per_N: Field<number>;
    // [x] STRATEGY (Rms_kg_per_s):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Rms_kg_per_s: Field<number>;
    // [x] STRATEGY (Xmax_m):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Xmax_m: Field<number>;
    // [x] STRATEGY (Xlim_m):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Xlim_m: Field<number>;
    // [x] STRATEGY (SPL_dB):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly SPL_dB: Field<number>;
    // [x] STRATEGY (Pe_W):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Pe_W: Field<number>;
    // [x] STRATEGY (Dd_m):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Dd_m: Field<number>;
    // [x] STRATEGY (EBP_hz):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly EBP_hz: Field<number>;
    // [x] STRATEGY (numVC):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly numVC: Field<number>;
    /** How the coils are wired. A NAME, not WinISD's 1/2 — see `VoiceCoilWiring`. */
    // [x] STRATEGY (VCCon):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly VCCon: Field<VoiceCoilWiring>;
    // Ordinarily derived, but WinISD lets a human type any of them, and an entered value is a fact.
    // [x] STRATEGY (Dia_m):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Dia_m: Field<number>;
    // [x] STRATEGY (Vd_m3):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Vd_m3: Field<number>;
    // [x] STRATEGY (no):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly no: Field<number>;
    // [x] STRATEGY (SPLmax_dB):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly SPLmax_dB: Field<number>;
    // [x] STRATEGY (SPLmaxLF_dB):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly SPLmaxLF_dB: Field<number>;
    // [x] STRATEGY (USPL_dB):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly USPL_dB: Field<number>;
    // [x] STRATEGY (alfaVC_per_K):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly alfaVC_per_K: Field<number>;
    // [x] STRATEGY (Rt_K_per_W):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Rt_K_per_W: Field<number>;
    // [x] STRATEGY (Ct_J_per_K):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Ct_J_per_K: Field<number>;
    /** `Bxl/Mms` — the acceleration factor, acceleration per ampere. NOT dimensionless: WinISD's
     *  own UI prints `N/(A*kg)`, which is the same dimension as cfuttrup's `m/(s²·A)`. */
    // [x] STRATEGY (gamma_m_per_s2_A):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly gamma_m_per_s2_A: Field<number>;
    // [x] STRATEGY (Rme_kg_per_s):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Rme_kg_per_s: Field<number>;
    /** `Bxl/√Re` — the motor power factor, newtons per square-root watt. */
    // [x] STRATEGY (Mpow_N_per_sqrtW):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Mpow_N_per_sqrtW: Field<number>;
    /** `Rme·(1 + Xmax/min(Hc, Hg))` — the motor COST factor: how powerful the motor is, penalised
     *  by how far the coil is overhung or underhung. It IS meant as an indicator of what the driver
     *  costs to build, but the unit is not currency — the ratio is dimensionless, so the figure
     *  carries `Rme`'s kg/s. WinISD's own help: "an indicator on the price of the driver, but
     *  please forget about the unit". (Formula decompiled and reproduced exactly on 10 live WinISD
     *  runs: `winisd_research/GHIDRA_FINDINGS.md` §"Four advanced-panel formulas".) */
    // [x] STRATEGY (Mcost_kg_per_s):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Mcost_kg_per_s: Field<number>;
    // [x] STRATEGY (Gloss):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Gloss: Field<number>;
    /** The air THIS DRIVER states — the conditions its own figures were measured or computed at.
     *  Not the environment a simulation runs on; `OpenISDEnvironment` on the project is that. */
    // [x] STRATEGY (c_m_per_s):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly c_m_per_s: Field<number>;
    // [x] STRATEGY (roo_kg_per_m3):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly roo_kg_per_m3: Field<number>;
    // Descriptive and dimensional.
    // [x] STRATEGY (Vcd_m):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Vcd_m: Field<number>;
    // [x] STRATEGY (Hg_m):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Hg_m: Field<number>;
    // [x] STRATEGY (Hc_m):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Hc_m: Field<number>;
    // [x] STRATEGY (freq_low_hz):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly freq_low_hz: Field<number>;
    // [x] STRATEGY (freq_high_hz):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly freq_high_hz: Field<number>;
    // [x] STRATEGY (power_peak_W):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly power_peak_W: Field<number>;
    // [x] STRATEGY (weight_kg):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly weight_kg: Field<number>;
    // [x] STRATEGY (Thick_m):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Thick_m: Field<number>;
    // [x] STRATEGY (Depth_m):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Depth_m: Field<number>;
    // [x] STRATEGY (MagDepth_m):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly MagDepth_m: Field<number>;
    // [x] STRATEGY (Magnet_m):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Magnet_m: Field<number>;
    // [x] STRATEGY (Basket_m):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Basket_m: Field<number>;
    // [x] STRATEGY (Outer_m):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Outer_m: Field<number>;
    // [x] STRATEGY (OuterX_m):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly OuterX_m: Field<number>;
    // [x] STRATEGY (OuterY_m):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly OuterY_m: Field<number>;
    // [x] STRATEGY (DVol_m3):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly DVol_m3: Field<number>;

    constructor(
        record: Lens<OpenISDDeviceJson>,
        section: 'woofer' | 'tweeter',
        engine: Engine,
        airProvider: () => AirConstantProvider,
    ) {
        /** The wiring field. Its own builder because it carries a NAME, not a number, so it is not
         *  one of `SpecFieldName`'s numeric keys and cannot go through `f()`. */
        const wiring = (): Field<VoiceCoilWiring> => new Field<VoiceCoilWiring>(
            () => {
                const wiring = wiringFromRecord(winningValue(record.get().specs[section]?.VCCon));
                return wiring === null
                    ? createCell('', calcVCCon(), 'calculated')
                    : createCell('', wiring, 'entered');
            },
            (v) => {
                const json = record.get();
                const spec = json.specs[section] ?? {};
                record.set({
                    ...json,
                    specs: {...json.specs, [section]: {...spec, VCCon: enteredWiring(v)}},
                });
            },
            () => {
                const json = record.get();
                const spec = json.specs[section] ?? {};
                const {VCCon: _removed, ...rest} = spec;
                record.set({
                    ...json,
                    specs: {...json.specs, [section]: rest},
                });
            },
        );

        /** Everything this section's STATED values imply, and nothing it does not.
         *
         *  Memoised against the record's current value, because a solve is a full fixpoint over
         *  every relation and `get()` is called per field, per render. The cache is a pure
         *  function of the record, so a `record.set` anywhere — including one from another window
         *  onto the same driver — invalidates it by identity, and nothing has to remember to.
         *
         *  Nothing here writes back: the record holds what was stated, and a derived value is
         *  reported at the getter and never stored (John, 2026-09-08, QO127 — "NOTHING is supposed
         *  to call the solver independently and write to the domain"). */
        let solvedFor: OpenISDDeviceJson | null = null;
        let solved: Readonly<DriverSolverQuantities> = {};
        const solvedNow = (): Readonly<DriverSolverQuantities> => {
            const json = record.get();
            if (json === solvedFor) return solved;
            const stated = json.specs[section];
            const statedValue = (k: keyof DriverSpecsSection): number | undefined =>
                (stated === undefined ? null : winningValue(stated[k])) ?? undefined;
            const air = engine.airFor(airProvider());
            solved = solveConsistencyGroup({
                Fs_hz: statedValue('Fs_hz'), Re_ohm: statedValue('Re_ohm'), Znom_ohm: statedValue('Znom_ohm'),
                Le_H: statedValue('Le_H'), fLe_hz: statedValue('fLe_hz'), KLe_H_sqrtHz: statedValue('KLe_H_sqrtHz'),
                Qes: statedValue('Qes'), Qms: statedValue('Qms'), Qts: statedValue('Qts'),
                Vas_m3: statedValue('Vas_m3'), Sd_m2: statedValue('Sd_m2'), Dd_m: statedValue('Dd_m'),
                BL_Tm: statedValue('BL_Tm'), Mms_kg: statedValue('Mms_kg'), Cms_m_per_N: statedValue('Cms_m_per_N'),
                Rms_kg_per_s: statedValue('Rms_kg_per_s'), EBP_hz: statedValue('EBP_hz'), Xmax_m: statedValue('Xmax_m'),
                Vd_m3: statedValue('Vd_m3'), Hc_m: statedValue('Hc_m'), Hg_m: statedValue('Hg_m'),
                Pe_W: statedValue('Pe_W'), no: statedValue('no'), SPL_dB: statedValue('SPL_dB'),
                USPL_dB: statedValue('USPL_dB'), SPLmax_dB: statedValue('SPLmax_dB'),
                SPLmaxLF_dB: statedValue('SPLmaxLF_dB'), Rme_kg_per_s: statedValue('Rme_kg_per_s'),
                Mpow_N_per_sqrtW: statedValue('Mpow_N_per_sqrtW'), Mcost_kg_per_s: statedValue('Mcost_kg_per_s'),
                gamma_m_per_s2_A: statedValue('gamma_m_per_s2_A'), Gloss: statedValue('Gloss'),
                Vcd_m: statedValue('Vcd_m'), Depth_m: statedValue('Depth_m'),
                MagDepth_m: statedValue('MagDepth_m'), Magnet_m: statedValue('Magnet_m'),
                DVol_m3: statedValue('DVol_m3'), c_m_per_s: statedValue('c_m_per_s') ?? air.c,
                roo_kg_per_m3: statedValue('roo_kg_per_m3') ?? air.rho,
            });
            solvedFor = json;
            return solved;
        };

        const f = (
            key: keyof DriverSpecsSection,
            derived: () => number | undefined,
        ): Field<number> => new Field<number>(
            // A key ABSENT from the section means the driver does not state that parameter — the
            // ordinary shape of a scraped record, not a fault. Unstated is not the same as
            // unknowable: if the solver can derive it from what IS stated, that is what the field
            // reports, marked `calculated` so a reader can still tell derived from entered.
            () => {
                const stated = record.get().specs[section]?.[key];
                const v = winningValue(stated);
                if (v !== null) return createCell<number>('', v, 'entered');
                const calculated = derived();
                return calculated === undefined
                    ? createCell<number>('', null, 'not-available')
                    : createCell<number>('', calculated, 'calculated');
            },
            (v) => {
                const json = record.get();
                const spec = json.specs[section] ?? {};
                record.set({
                    ...json,
                    specs: {...json.specs, [section]: {...spec, [key]: enteredEntry(v)}},
                });
            },
            () => {
                const json = record.get();
                const spec = json.specs[section] ?? {};
                const {[key]: _removed, ...rest} = spec;
                record.set({
                    ...json,
                    specs: {...json.specs, [section]: rest},
                });
            },
        );

        this.Fs_hz = f('Fs_hz', () => solvedNow().Fs_hz);
        this.Re_ohm = f('Re_ohm', () => solvedNow().Re_ohm);
        this.Le_H = f('Le_H', () => solvedNow().Le_H);
        this.fLe_hz = f('fLe_hz', () => solvedNow().fLe_hz);
        this.KLe_H_sqrtHz = f('KLe_H_sqrtHz', () => solvedNow().KLe_H_sqrtHz);
        this.Znom_ohm = f('Znom_ohm', () => solvedNow().Znom_ohm);
        this.Qts = f('Qts', () => solvedNow().Qts);
        this.Qes = f('Qes', () => solvedNow().Qes);
        this.Qms = f('Qms', () => solvedNow().Qms);
        this.Vas_m3 = f('Vas_m3', () => solvedNow().Vas_m3);
        this.Sd_m2 = f('Sd_m2', () => solvedNow().Sd_m2);
        this.BL_Tm = f('BL_Tm', () => solvedNow().BL_Tm);
        this.Mms_kg = f('Mms_kg', () => solvedNow().Mms_kg);
        this.Cms_m_per_N = f('Cms_m_per_N', () => solvedNow().Cms_m_per_N);
        this.Rms_kg_per_s = f('Rms_kg_per_s', () => solvedNow().Rms_kg_per_s);
        this.Xmax_m = f('Xmax_m', () => solvedNow().Xmax_m);
        this.Xlim_m = f('Xlim_m', () => undefined);
        this.SPL_dB = f('SPL_dB', () => solvedNow().SPL_dB);
        this.Pe_W = f('Pe_W', () => solvedNow().Pe_W);
        this.Dd_m = f('Dd_m', () => solvedNow().Dd_m);
        this.EBP_hz = f('EBP_hz', () => solvedNow().EBP_hz);
        this.numVC = new Field<number>(
            () => {
                const stated = record.get().specs[section]?.numVC;
                const v = winningValue(stated);
                return v === null ? createCell('', calcNumVC(), 'calculated') : createCell('', v, 'entered');
            },
            (v) => {
                const json = record.get();
                const spec = json.specs[section] ?? {};
                record.set({
                    ...json,
                    specs: {...json.specs, [section]: {...spec, numVC: enteredEntry(v)}},
                });
            },
            () => {
                const json = record.get();
                const spec = json.specs[section] ?? {};
                const {numVC: _removed, ...rest} = spec;
                record.set({
                    ...json,
                    specs: {...json.specs, [section]: rest},
                });
            },
        );
        this.VCCon = wiring();
        this.Dia_m = f('Dia_m', () => undefined);
        this.Vd_m3 = f('Vd_m3', () => solvedNow().Vd_m3);
        this.no = f('no', () => solvedNow().no);
        this.SPLmax_dB = f('SPLmax_dB', () => solvedNow().SPLmax_dB);
        this.SPLmaxLF_dB = f('SPLmaxLF_dB', () => solvedNow().SPLmaxLF_dB);
        this.USPL_dB = f('USPL_dB', () => solvedNow().USPL_dB);
        this.alfaVC_per_K = f('alfaVC_per_K', () => undefined);
        this.Rt_K_per_W = f('Rt_K_per_W', () => undefined);
        this.Ct_J_per_K = f('Ct_J_per_K', () => undefined);
        this.gamma_m_per_s2_A = f('gamma_m_per_s2_A', () => solvedNow().gamma_m_per_s2_A);
        this.Rme_kg_per_s = f('Rme_kg_per_s', () => solvedNow().Rme_kg_per_s);
        this.Mpow_N_per_sqrtW = f('Mpow_N_per_sqrtW', () => solvedNow().Mpow_N_per_sqrtW);
        this.Mcost_kg_per_s = f('Mcost_kg_per_s', () => solvedNow().Mcost_kg_per_s);
        this.Gloss = f('Gloss', () => solvedNow().Gloss);

        /** The air field builder. Its own builder, not `f()`: unlike every other numeric field,
         *  an unstated `c`/`roo` reads back as the live air model at this driver's own environment
         *  — the calculated default `openIsdDriverToWinIsdDriver` used to compute only at `.wdr`
         *  export time, now available on the driver's own getter (see `AirConstantProvider`). */
        const air = (key: 'c_m_per_s' | 'roo_kg_per_m3', pick: (a: Air) => number): Field<number> => new Field<number>(
            () => {
                const stated = record.get().specs[section]?.[key];
                const v = winningValue(stated);
                return v === null
                    ? createCell('', pick(engine.airFor(airProvider())), 'calculated')
                    : createCell('', v, 'entered');
            },
            (v) => {
                const json = record.get();
                const spec = json.specs[section] ?? {};
                record.set({
                    ...json,
                    specs: {...json.specs, [section]: {...spec, [key]: enteredEntry(v)}},
                });
            },
            () => {
                const json = record.get();
                const spec = json.specs[section] ?? {};
                const {[key]: _removed, ...rest} = spec;
                record.set({
                    ...json,
                    specs: {...json.specs, [section]: rest},
                });
            },
        );
        this.c_m_per_s = air('c_m_per_s', (a) => a.c);
        this.roo_kg_per_m3 = air('roo_kg_per_m3', (a) => a.rho);
        this.Vcd_m = f('Vcd_m', () => solvedNow().Vcd_m);
        this.Hg_m = f('Hg_m', () => solvedNow().Hg_m);
        this.Hc_m = f('Hc_m', () => solvedNow().Hc_m);
        this.freq_low_hz = f('freq_low_hz', () => undefined);
        this.freq_high_hz = f('freq_high_hz', () => undefined);
        this.power_peak_W = f('power_peak_W', () => undefined);
        this.weight_kg = f('weight_kg', () => undefined);
        this.Thick_m = f('Thick_m', () => undefined);
        this.Depth_m = f('Depth_m', () => solvedNow().Depth_m);
        this.MagDepth_m = f('MagDepth_m', () => solvedNow().MagDepth_m);
        this.Magnet_m = f('Magnet_m', () => solvedNow().Magnet_m);
        this.Basket_m = f('Basket_m', () => undefined);
        this.Outer_m = f('Outer_m', () => undefined);
        this.OuterX_m = f('OuterX_m', () => undefined);
        this.OuterY_m = f('OuterY_m', () => undefined);
        this.DVol_m3 = f('DVol_m3', () => solvedNow().DVol_m3);
    }
}

/**
 * A device record stating NOTHING but its own bookkeeping — what `empty()` hands an editor.
 *
 * Every spec section is absent, so each field reads `not-available` and the editor's own
 * "not entered" rendering is what the user sees. The bookkeeping fields cannot be absent: the
 * conformance guard requires them, so a record without them is not a record and could never be
 * saved. They are minted the way a `.wdr` import mints them (`openisdSchema.ts`
 * `wdrToOpenIsdRecord`), which faces the same problem — a record with no source document
 * behind it.
 */
// [x] STRATEGY (function blankDeviceRecord):
//     ROLE: Domain helper / constructor.
//     STATUS: GOOD AS-IS. Pure function operating over lenses and records.
function blankDeviceRecord(section: 'woofer' | 'tweeter' | 'passive-radiator'): OpenISDDeviceJson {
    return {
        uuid: {value: newUuid()},
        quality: {
            confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
            parse_errors: [], cross_source_only: [],
        },
        // Stated as empty rather than omitted: the guard requires all three, and an editor
        // overwrites them the moment the user types. `Field`'s own reader reports an empty
        // string as `not-available`, so a blank still renders blank.
        manufacturer: {value: ''},
        brand: {value: ''},
        model: {value: ''},
        sku: {value: '', grounds: [{origin: 'manual', reading: ''}]},
        driver_type: {value: section},
        data_sources: {value: {}},
        // No document to name — `openisd`, the pipeline's own role, exactly as the `.wdr`
        // import uses it for the same reason.
        authoritative: {value: 'openisd'},
        specs: {[section]: {}},
    };
}

/**
 * A DEVICE — a record describing one physical thing, with its identity and its provenance.
 *
 * A driver and a passive radiator are both devices. What they share is everything at this level:
 * a record (`OpenISDDeviceJson`), the six identity fields, and the engine every derived figure
 * comes from. What they do NOT share is the spec section their record carries, and therefore
 * every quantity in it — a radiator has no motor, so `Re`, `BL`, `Qes`, `Znom` and `Pe` are not
 * absent from it, they are meaningless to it.
 *
 * So identity lives here, once, and the physics lives in the subclass.
 */
export abstract class OpenISDDevice {
    /**
     * The device's record, which may be ABSENT: a box's radiator slot can be empty. A driver's
     * never is, and its subclass narrows accordingly.
     *
     * Reading an absent record answers `not-available` on every field; WRITING to one throws. That
     * asymmetry is the point — a view can render a slot nobody has filled, but nothing can put a
     * value into a device that does not exist.
     */
    // [x] STRATEGY (#slot):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    #slot: Lens<OpenISDDeviceJson>;

    /** The one calculation surface. INJECTED, exactly as `OpenISDProject`'s is — a device reports
     *  derived figures, and every one of them comes from here and nowhere else. */
    protected readonly engine: Engine;

    // [x] STRATEGY (brand):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly brand: Field<string>;
    // [x] STRATEGY (model):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly model: Field<string>;
    // [x] STRATEGY (manufacturer):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly manufacturer: Field<string>;
    // [x] STRATEGY (providedBy):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly providedBy: Field<string>;
    // [x] STRATEGY (comment):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly comment: Field<string>;
    // [x] STRATEGY (added):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly added: Field<string>;

    protected constructor(slot: Lens<OpenISDDeviceJson>, engine: Engine) {
        this.#slot = slot;
        this.engine = engine;
        this.brand = this.#buildMeta('brand');
        this.model = this.#buildMeta('model');
        this.manufacturer = this.#buildMeta('manufacturer');
        this.providedBy = this.#buildMeta('provided_by');
        this.comment = this.#buildMeta('comment');
        this.added = this.#buildMeta('added');
    }

    // [x] STRATEGY (#buildMeta):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    #buildMeta(key: MetaFieldName): Field<string> {
        return new Field<string>(
            () => {
                const stated = this.#slot.get()[key];
                return stated === undefined
                    ? createCell<string>('', null, 'not-available')
                    : createCell<string>('', stated.value, 'entered');
            },
            (v) => {
                this.#slot.set({...this.#slot.get(), [key]: {value: v, origin: 'entered'}});
            },
            () => {
                this.#slot.set({...this.#slot.get(), [key]: {value: '', origin: 'entered'}});
            },
        );
    }
}

export abstract class OpenISDDriver extends OpenISDDevice {
    // [x] STRATEGY (fromConformingRecord):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    static fromConformingRecord(record: unknown, engine: Engine): OpenISDDriver | string[] {
        const conformed = OpenISDDeviceJson.fromConformingRecord(record);
        if ('problems' in conformed) return conformed.problems;

        const sectionProblems = driverSectionProblems(conformed.json);
        if (sectionProblems.length > 0) return sectionProblems;
        return OpenISDDriverStandalone.wrap(conformed.json, engine);
    }

    /** A driver stating nothing — what the editor opens on "create a new driver from scratch".
     *  Every spec field reads `not-available`, so the editor renders it blank and the consistency
     *  solver has nothing to work from until the user types. No conformance check: this record is
     *  minted here, not received from outside, so there is no untrusted input to refuse. */
    // [x] STRATEGY (empty):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    static empty(engine: Engine): OpenISDDriver {
        return OpenISDDriverStandalone.wrap(blankDeviceRecord('woofer'), engine);
    }

    /** `.owdr` text — openisd driver YAML — back to a driver, or the reasons it could not be
     *  read. The inverse of `toOwdrText()`. */
    // [x] STRATEGY (fromOwdrText):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    static fromOwdrText(text: string, engine: Engine): OpenISDDriver | string[] {
        const parsed = OpenISDDeviceJson.fromOpenisdDriverYml(text);
        if ('problems' in parsed) return parsed.problems;

        const sectionProblems = driverSectionProblems(parsed.json);
        if (sectionProblems.length > 0) return sectionProblems;
        return OpenISDDriverStandalone.wrap(parsed.json, engine);
    }

    // [x] STRATEGY (section):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly section: 'woofer' | 'tweeter';

    /** The driver's spec sections. A caller that does not care which kind of driver it holds reads
     *  `driver.spec[driver.section]`. */
    // [x] STRATEGY (spec):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly spec: {
        // [x] STRATEGY (woofer):
        //     ROLE: Internal member of enclosure/device/project.
        //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
        readonly woofer: OpenIsdDriverSpec;
        // [x] STRATEGY (tweeter):
        //     ROLE: Internal member of enclosure/device/project.
        //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
        readonly tweeter: OpenIsdDriverSpec;
    };

    /** The scraper-stated classification string — driver only, so it lives here rather than on
     *  `OpenISDDevice` alongside `brand`/`model`, which a box or radiator also carries. Read-only:
     *  a plain accessor, not a `Field`, because nothing writes this — it is scraper-owned data
     *  (`scrapedFieldOf`), not a value an editor enters.
     *
     *  Every value seen across the driver.yml corpus: "woofer", "subwoofer", "midrange",
     *  "mid-bass", "mid-woofer", "full-range", "coaxial", "tweeter", "amt", "passive-radiator".
     *
     *  TODO(bugs/BUG_20260907_driver_type_has_no_closed_set_shared_with_python.md): this is a
     *  closed vocabulary (`driver.yml`'s own field comment says so) with no enum backing it on
     *  either side of the scraper/domain boundary. Once one exists, shared with the Python
     *  scraper the way `filter/driverType.ts` keeps `DriverType`/`Chip` in parity with
     *  `test_driver_type_enum_parity.py`, this method returns that domain type instead of the raw
     *  string — not `packages/design/filter`'s `DriverType`, which is a UI/search-only concept. */
    // [x] STRATEGY (driverType):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    driverType(): string {
        return this.record.get().driver_type.value;
    }

    /** A driver's record is never absent, so this stays non-null for everything below. */
    protected readonly record: Lens<OpenISDDeviceJson>;

    protected constructor(
        record: Lens<OpenISDDeviceJson>,
        section: 'woofer' | 'tweeter',
        engine: Engine,
        airProvider: () => AirConstantProvider = () => ({}),
    ) {
        super({
            get: () => record.get(), set: (json) => {
                if (json) record.set(json);
            }
        }, engine);
        this.record = record;
        this.section = section;
        // Both are built unconditionally, and NEITHER reads the record here. A `DriverSpec` is a
        // WINDOW: it dereferences at call time, so a section the record does not carry reads
        // `not-available` on every field and starts carrying values the moment one is set. Deciding
        // in this constructor which sections "exist" would snapshot the record — and `update()`
        // REPLACES it, so a driver updated from a tweeter record would keep reporting no tweeter.
        // `section` already answers "which kind of driver is this"; presence is not a second answer.
        this.spec = {
            woofer: new OpenIsdDriverSpec(record, 'woofer', engine, airProvider),
            tweeter: new OpenIsdDriverSpec(record, 'tweeter', engine, airProvider),
        };
    }

    /** Which spec section a record carries, or a refusal if it carries neither. */
    protected static sectionOf(json: OpenISDDeviceJson): 'woofer' | 'tweeter' {
        if (json.specs.woofer) return 'woofer';
        if (json.specs.tweeter) return 'tweeter';
        throw new Error('OpenISDDriver: record has neither a woofer nor a tweeter section');
    }

    // ── DERIVED FIGURES — every one from the injected engine, none computed here ──────────────

    /** Everything this driver's stated values imply, filled in. Does NOT write back — a solved
     *  value is a derivation, and the record holds only what was actually stated. */
    // [x] STRATEGY (solveConsistencyGroup):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    solveConsistencyGroup(): Readonly<DriverSolverQuantities> {
        const spec = this.spec[this.section];
        const value = (field: Field<number>): number | undefined => field.get().value ?? undefined;
        return solveConsistencyGroup({
            Fs_hz: value(spec.Fs_hz), Re_ohm: value(spec.Re_ohm), Znom_ohm: value(spec.Znom_ohm),
            Le_H: value(spec.Le_H), fLe_hz: value(spec.fLe_hz), KLe_H_sqrtHz: value(spec.KLe_H_sqrtHz),
            Qes: value(spec.Qes), Qms: value(spec.Qms), Qts: value(spec.Qts), Vas_m3: value(spec.Vas_m3),
            Sd_m2: value(spec.Sd_m2), Dd_m: value(spec.Dd_m), BL_Tm: value(spec.BL_Tm),
            Mms_kg: value(spec.Mms_kg), Cms_m_per_N: value(spec.Cms_m_per_N),
            Rms_kg_per_s: value(spec.Rms_kg_per_s), EBP_hz: value(spec.EBP_hz),
            Xmax_m: value(spec.Xmax_m), Vd_m3: value(spec.Vd_m3), Hc_m: value(spec.Hc_m),
            Hg_m: value(spec.Hg_m), Pe_W: value(spec.Pe_W), no: value(spec.no),
            SPL_dB: value(spec.SPL_dB), USPL_dB: value(spec.USPL_dB),
            SPLmax_dB: value(spec.SPLmax_dB), SPLmaxLF_dB: value(spec.SPLmaxLF_dB),
            Rme_kg_per_s: value(spec.Rme_kg_per_s), Mpow_N_per_sqrtW: value(spec.Mpow_N_per_sqrtW),
            Mcost_kg_per_s: value(spec.Mcost_kg_per_s), gamma_m_per_s2_A: value(spec.gamma_m_per_s2_A),
            Gloss: value(spec.Gloss), Vcd_m: value(spec.Vcd_m), Depth_m: value(spec.Depth_m),
            MagDepth_m: value(spec.MagDepth_m), Magnet_m: value(spec.Magnet_m), DVol_m3: value(spec.DVol_m3),
            c_m_per_s: value(spec.c_m_per_s), roo_kg_per_m3: value(spec.roo_kg_per_m3),
            numVC: value(spec.numVC),
            wiring: spec.VCCon.get().value === VoiceCoilWiring.Series
                ? 'series' : 'parallel',
        });
    }

    // [x] STRATEGY (solveDriverConsistencyGroup):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    solveDriverConsistencyGroup(): Readonly<DriverSolverQuantities> {
        return this.solveConsistencyGroup();
    }

    /** Everything this driver's stated values disagree about — an over-specified driver whose
     *  numbers cannot all be true at once. Empty when consistent. */
    // [x] STRATEGY (checkConsistency):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    checkConsistency(): ConsistencyIssue[] {
        return [];
    }

    /** Voice-coil inductance, as the record states it. Not a solver quantity — nothing derives it
     *  — so it travels to `sweep` on its own, for the impedance plot alone. */
    // [x] STRATEGY (Le_H):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    Le_H(): number | undefined {
        return winningValue(this.record.get().specs[this.section]?.Le_H ?? undefined) ?? undefined;
    }

    /** An INDEPENDENT driver carrying this one's current values — and, with `update()`, the whole
     *  of how an editor works: take a copy, let the user edit THAT, and on OK write it back with
     *  `update()`; on Cancel simply drop it. The original never sees an intermediate value, so
     *  Cancel needs no layer, no session object and no adapter, and the same code serves an
     *  embedded driver and a standalone one alike — which is what a generic editor wants. What makes "Save to My Drivers",
     *  "edit a bundle entry" and "fork this entry" possible without any of them reaching into the
     *  storage this window points at. Always STANDALONE — a copy belongs to nothing until
     *  something adopts it (via `OpenISDDriverEmbedded.update()`, or a repo save). */
    // [x] STRATEGY (detach):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    detach(): OpenISDDriverStandalone {
        return OpenISDDriverStandalone.wrap(structuredClone(this.record.get()), this.engine);
    }

    /** @internal The record a save writes, deep-cloned. Same seam as
     *  `OpenISDProject.cloneProject()` — the persistence layer's one way to reach the raw record
     *  it stores, never field by field. Clones before handing it out, so the caller can store or
     *  hand the result elsewhere without aliasing this driver's own live record — a shallow
     *  `{...}` spread is not enough, since every nested field object (`brand`, `driver_type`,
     *  `specs.woofer.Fs`, …) would still be the same reference as the live record. */
    // [x] STRATEGY (cloneDriver):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    cloneDriver(): OpenISDDeviceJson {
        return structuredClone(this.record.get());
    }

    /** Replace this driver's whole record with `source`'s current values. The write-back
     *  primitive: a project adopting a different driver, or an edit made on a detached copy being
     *  put back.
     *
     *  Reads `source.record` directly. Legal because `record` is PROTECTED and this method belongs
     *  to the class that declares it, so one driver may read another's — and no consumer can,
     *  because a protected member is not on the public surface.
     *
     *  Deep-cloned: after this call the two records share no nested object, so neither driver's
     *  later edits reach the other regardless of how the storage layer applies writes. */
    // [x] STRATEGY (update):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    update(source: OpenISDDriver): void {
        this.record.set(structuredClone(source.record.get()));
    }

    /** Make this driver a copy: its `model` states so, so `<brand>/<model>` differs from the
     *  driver it was copied from and the two stand side by side rather than one replacing the
     *  other. Called on a detached copy, before it is saved. */
    // [x] STRATEGY (renameToCopy):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    renameToCopy(): void {
        this.model.set('Copy of ' + (this.model.get().value ?? ''));
    }

    /** The catalogue URL recorded for one source role — datasheet, product page, listing page —
     *  or null when the record carries none. The picker shows these as the preview's links; a
     *  URL is provenance, not a driver parameter, so it is read here rather than off `spec`. */
    // [x] STRATEGY (dataSource):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    dataSource(role: 'manufacturer_datasheet' | 'manufacturer_product_page' | 'manufacturer_listing_page'): string | null {
        return this.record.get().data_sources.value[role] ?? null;
    }

    /** The product series this driver belongs to (e.g. "Reference Series"), or null. Descriptive
     *  only — the picker's preview text, never a simulated quantity. */
    // [ ] STRATEGY (series):
    //     ROLE: Descriptive metadata attribute on driver record.
    //     STATUS: UPGRADE from raw getter to ReadOnlyCalculatedField<string>.
    //     MECHANICS: Wraps string in Cell shape carrying name and entered/calculated provenance across package boundaries.
    get series(): string | null {
        return this.record.get().series?.value ?? null;
    }

    /** The manufacturer's own catalogue number, derived by the scraper from brand/model. */
    // [ ] STRATEGY (sku):
    //     ROLE: Descriptive metadata attribute on driver record.
    //     STATUS: UPGRADE from raw getter to ReadOnlyCalculatedField<string>.
    //     MECHANICS: Wraps string in Cell shape carrying name and entered/calculated provenance across package boundaries.
    get sku(): string | null {
        return this.record.get().sku.value ?? null;
    }

    /** Free-text description from the datasheet, or null. Preview text only. */
    // [ ] STRATEGY (description):
    //     ROLE: Descriptive metadata attribute on driver record.
    //     STATUS: UPGRADE from raw getter to ReadOnlyCalculatedField<string>.
    //     MECHANICS: Wraps string in Cell shape carrying name and entered/calculated provenance across package boundaries.
    get description(): string | null {
        return this.record.get().description?.value ?? null;
    }

    // [x] STRATEGY (toOpenIsdDeviceJson):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    toOpenIsdDeviceJson(): OpenISDDeviceJson {
        return this.record.get();
    }

    /** This driver as `.owdr` text — openisd driver YAML, the form `OpenISDDriver.fromOwdrText` reads
     *  back. The serialisation stays inside the domain so the record type never crosses the
     *  package boundary. */
    // [x] STRATEGY (toOwdrText):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    toOwdrText(): string {
        return OpenISDDeviceJson.toOpenisdDriverYml(this.record.get());
    }

    /** This driver as WinISD `.wdr` text — the form `OpenISDDriver.fromWdrIniText` reads back.
     *
     *  `.wdr` states far less than an openisd record does: a field WinISD has no key for is
     *  dropped, so this is a lossy write and the round trip is not an identity. `errors` carries
     *  every such loss the converter reported. */
    // [x] STRATEGY (toWdrIniText):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    toWdrIniText(engine: Engine): { value: string | null; errors: DriverError[] } {
        const errors: DriverError[] = [];
        const wdr = openIsdDriverToWinIsdDriver(this, engine, errors);
        return {value: wdr.toWdrIni(), errors};
    }

    /** WinISD `.wdr` text back to a driver. The inverse of `toWdrIniText()`, as far as a format
     *  carrying fewer fields allows. */
    // [x] STRATEGY (fromWdrIniText):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    static fromWdrIniText(text: string, engine: Engine): { value: OpenISDDriver | null; errors: DriverError[] } {
        return winIsdDriverTextToOpenIsdDriver(text, engine);
    }
}

/** A driver that belongs to no project — a My Drivers entry, a bundle row, a detached copy.
 *  `wrap()` windows onto a record the caller owns; the record is not copied, it is referenced.
 *
 *  `export`ed for `openisdTransforms.ts` (`conformingRecordToOpenIsdDriver` calls `wrap()`);
 *  `domain/index.ts` does not re-export it, so no consumer outside `packages/design` sees it. */
// [x] STRATEGY (class OpenISDDriverStandalone):
//     ROLE: Core domain model implementation class for OpenISDDriverStandalone.
//     STATUS: MAINTAIN & ENHANCE. Encapsulates state over immutable JSON records.
export class OpenISDDriverStandalone extends OpenISDDriver {
    /** `airProvider` defaults to the reference environment — every existing caller
     *  (`conformingRecordToDriver`, tests, `driverYmlToOpenisdAndWdr.ts`) passes none. A caller
     *  holding an app-level environment (the UI, constructing a My Drivers row) passes its own. */
    // [x] STRATEGY (wrap):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    static wrap(
        json: OpenISDDeviceJson,
        engine: Engine,
        airProvider: () => AirConstantProvider = () => ({}),
    ): OpenISDDriverStandalone {
        let current = json;
        const record: Lens<OpenISDDeviceJson> = {
            get: () => current,
            set: (j) => {
                current = j;
            },
        };
        return new OpenISDDriverStandalone(record, OpenISDDriver.sectionOf(json), engine, airProvider);
    }

}

/** The driver INSIDE a project — a window onto the project's own `driver` slot. A standalone
 *  driver windows its own record instead, which is the whole difference between the two. */
// [x] STRATEGY (class OpenISDDriverEmbedded):
//     ROLE: Core domain model implementation class for OpenISDDriverEmbedded.
//     STATUS: MAINTAIN & ENHANCE. Encapsulates state over immutable JSON records.
class OpenISDDriverEmbedded extends OpenISDDriver {
    private constructor(
        record: Lens<OpenISDDeviceJson>,
        section: 'woofer' | 'tweeter',
        engine: Engine,
        airProvider: () => AirConstantProvider,
    ) {
        // [x] STRATEGY (super):
        //     ROLE: Internal member of enclosure/device/project.
        //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
        super(record, section, engine, airProvider);
    }

    /** Takes the lens onto the project's `driver` slot and the project's own environment — the
     *  air this driver falls back to when it states no `c`/`roo` of its own. The project owns
     *  both slots and builds the lens/environment reader, so the driver needs no reference back
     *  to the project itself. */
    // [x] STRATEGY (wrap):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    static wrap(
        slot: Lens<OpenISDDeviceJson>,
        engine: Engine,
        environment: () => OpenISDEnvironmentJson,
    ): OpenISDDriverEmbedded {
        const airProvider = (): AirConstantProvider => {
            const env = environment();
            return {
                tempK: env.temperature_K ?? undefined,
                humidityPct: env.humidity_pct ?? undefined,
                pressurePa: env.pressure_Pa ?? undefined,
            };
        };
        return new OpenISDDriverEmbedded(slot, OpenISDDriver.sectionOf(slot.get()), engine, airProvider);
    }
}

/**
 * The radiator INSIDE a box — a window onto the box's own `component` slot, which may hold
 * nothing yet. Implements `PassiveRadiatorComponent`, so it IS what `box.passiveRadiator
 * .component` hands back, rather than a hand-assembled literal of field handles.
 *
 * Has no copy/write-back pair of its own, unlike a driver. The driver editor is a GENERIC
 * component that does not know where its driver came from, so it works on a `detach()`ed copy
 * and writes back with `update()`. The radiator's dedicated tab already knows it is editing a
 * project, so writes from the radiator tab land in the project's own edited layer like any
 * other field write.
 */

/**
 * What every radiator has, wherever the radiator lives: a lens onto ITS OWN record.
 *
 * The base exists so one radiator can read another's record without any module-scoped bridge.
 * `slot` is PROTECTED, so `update()` below — a method of the class that declares it — may read
 * `source.slot`, while nothing outside the class hierarchy can.
 *
 * The lens is NULLABLE because an embedded radiator's box may hold no radiator yet. A standalone
 * radiator refuses construction without a `passive-radiator` section, so its lens never answers
 * null in practice.
 */

/**
 * ONE PASSIVE-RADIATOR SPEC SECTION, PUBLISHED — the radiator's counterpart to `DriverSpec`.
 *
 * A window onto the `passive-radiator` section of a device record, with every parameter that
 * section can carry. Separate from `DriverSpec` because a radiator has no motor: `Re`, `BL`,
 * `Qes`, `Znom`, `Pe` and the thermal parameters are not absent from it, they are meaningless to
 * it, and one shared class would have to model one of the two dishonestly.
 */
// [x] STRATEGY (class OpenIsdPassiveRadiatorSpec):
//     ROLE: Core domain model implementation class for OpenIsdPassiveRadiatorSpec.
//     STATUS: MAINTAIN & ENHANCE. Encapsulates state over immutable JSON records.
export class OpenIsdPassiveRadiatorSpec {
    // [x] STRATEGY (Fs_hz):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Fs_hz: Field<number>;
    // [x] STRATEGY (Qms):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Qms: Field<number>;
    // [x] STRATEGY (Cms_m_per_N):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Cms_m_per_N: Field<number>;
    // [x] STRATEGY (Mms_kg):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Mms_kg: Field<number>;
    // [x] STRATEGY (Rms_kg_per_s):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Rms_kg_per_s: Field<number>;
    // [x] STRATEGY (Sd_m2):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Sd_m2: Field<number>;
    // [x] STRATEGY (Vas_m3):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Vas_m3: Field<number>;
    // [x] STRATEGY (Vd_m3):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Vd_m3: Field<number>;
    // [x] STRATEGY (Xmax_m):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Xmax_m: Field<number>;
    // [x] STRATEGY (Xlim_m):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Xlim_m: Field<number>;
    // [x] STRATEGY (Dia_m):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Dia_m: Field<number>;
    // [x] STRATEGY (Dd_m):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Dd_m: Field<number>;
    // [x] STRATEGY (DVol_m3):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly DVol_m3: Field<number>;
    // [x] STRATEGY (Thick_m):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Thick_m: Field<number>;
    // [x] STRATEGY (Depth_m):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Depth_m: Field<number>;
    // [x] STRATEGY (Basket_m):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Basket_m: Field<number>;
    // [x] STRATEGY (Outer_m):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly Outer_m: Field<number>;
    // [x] STRATEGY (OuterX_m):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly OuterX_m: Field<number>;
    // [x] STRATEGY (OuterY_m):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly OuterY_m: Field<number>;
    // [x] STRATEGY (weight_kg):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly weight_kg: Field<number>;

    constructor(slot: Lens<OpenISDDeviceJson>) {
        this.Fs_hz = prSpec(slot, 'Fs_hz');
        this.Qms = prSpec(slot, 'Qms');
        this.Cms_m_per_N = prSpec(slot, 'Cms_m_per_N');
        this.Mms_kg = prSpec(slot, 'Mms_kg');
        this.Rms_kg_per_s = prSpec(slot, 'Rms_kg_per_s');
        this.Sd_m2 = prSpec(slot, 'Sd_m2');
        this.Vas_m3 = prSpec(slot, 'Vas_m3');
        this.Vd_m3 = prSpec(slot, 'Vd_m3');
        this.Xmax_m = prSpec(slot, 'Xmax_m');
        this.Xlim_m = prSpec(slot, 'Xlim_m');
        this.Dia_m = prSpec(slot, 'Dia_m');
        this.Dd_m = prSpec(slot, 'Dd_m');
        this.DVol_m3 = prSpec(slot, 'DVol_m3');
        this.Thick_m = prSpec(slot, 'Thick_m');
        this.Depth_m = prSpec(slot, 'Depth_m');
        this.Basket_m = prSpec(slot, 'Basket_m');
        this.Outer_m = prSpec(slot, 'Outer_m');
        this.OuterX_m = prSpec(slot, 'OuterX_m');
        this.OuterY_m = prSpec(slot, 'OuterY_m');
        this.weight_kg = prSpec(slot, 'weight_kg');
    }
}

abstract class OpenISDPassiveRadiator extends OpenISDDevice {
    protected readonly slot: Lens<OpenISDDeviceJson>;

    /** Which spec section this device's record carries — the radiator's counterpart to the
     *  driver's `'woofer' | 'tweeter'`. */
    // [x] STRATEGY (section):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly section = 'passive-radiator' as const;

    /** This radiator's spec section, exactly as a driver publishes `spec[section]`. */
    // [x] STRATEGY (spec):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly spec: OpenIsdPassiveRadiatorSpec;


    // Every SPEC field a radiator can state, declared and built ONCE for both kinds. An embedded
    // radiator and a standalone one differ in WHERE their record lives, never in what a radiator
    // is, so a field list that differed between them was describing nothing real. The six identity
    // fields are not here: every device has those, so they live on `OpenISDDevice`.

    protected constructor(slot: Lens<OpenISDDeviceJson>, engine: Engine) {
        // [x] STRATEGY (super):
        //     ROLE: Internal member of enclosure/device/project.
        //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
        super(slot, engine);
        this.slot = slot;
        this.spec = new OpenIsdPassiveRadiatorSpec(slot);
    }

    /**
     * Replace this radiator's record with `source`'s current values.
     *
     * PROTECTED: adopting another radiator is meaningless on a standalone, which belongs to no
     * box, so only the embedded subclass republishes this as public. Declared HERE because `slot`
     * is declared here, which is what makes reading `source.slot` legal.
     */
    protected update(source: OpenISDPassiveRadiator): void {
        const record = source.slot.get();
        this.slot.set({...record});
    }
}

// [x] STRATEGY (class OpenISDPassiveRadiatorEmbedded):
//     ROLE: Core domain model implementation class for OpenISDPassiveRadiatorEmbedded.
//     STATUS: MAINTAIN & ENHANCE. Encapsulates state over immutable JSON records.
class OpenISDPassiveRadiatorEmbedded extends OpenISDPassiveRadiator {

    constructor(slot: Lens<OpenISDDeviceJson>, engine: Engine) {
        // [x] STRATEGY (super):
        //     ROLE: Internal member of enclosure/device/project.
        //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
        super(slot, engine);
    }

    /** Adopt the chosen radiator into this box. The box owns its radiator from here on, so later
     *  edits change the box and never the library entry the radiator was picked from. */
    override update(source: OpenISDPassiveRadiatorStandalone): void {
        super.update(source);
    }

    /** This radiator as one belonging to no box — the copy My Passive Radiators holds, and the
     *  inverse of `update()`. Deep-copies, so editing the box afterwards leaves the saved
     *  radiator alone, exactly as `OpenISDDriver.detach()` does for a driver.
     *
     *  Throws on an empty slot: a box with no radiator chosen has nothing to save. */
    // [x] STRATEGY (detach):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    detach(): OpenISDPassiveRadiatorStandalone {
        const record = this.slot.get();
        return OpenISDPassiveRadiatorStandalone.wrap(structuredClone(record), this.engine);
    }
}

/** A radiator that belongs to no box — straight out of the bundle, or served from My PRs. The
 *  ONLY radiator type the selector popup and the PR editor ever see, and what `configurePR()`
 *  accepts. Its record has a `passive-radiator` section. Its
 *  own concept, not "a driver that happens to be a PR": no shared ancestor with `OpenISDDriver`.
 *  Same window-not-copy shape, same construction-time refusal, same eager-built fields.
 *
 *  `export`ed for `openisdTransforms.ts` (`conformingRecordToOpenIsdPassiveRadiatorStandalone`
 *  and the PR builder call `wrap()`); `domain/index.ts` does not re-export it. */
// [x] STRATEGY (class OpenISDPassiveRadiatorStandalone):
//     ROLE: Core domain model implementation class for OpenISDPassiveRadiatorStandalone.
//     STATUS: MAINTAIN & ENHANCE. Encapsulates state over immutable JSON records.
export class OpenISDPassiveRadiatorStandalone extends OpenISDPassiveRadiator {
    /** A radiator stating nothing — the counterpart of `OpenISDDriver.empty()`, and how a PR
     *  comes into existence before anyone has typed its parameters. `configurePR()` accepts it,
     *  so a box can adopt one and the editor fills it in from there. */
    // [x] STRATEGY (empty):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    static empty(engine: Engine): OpenISDPassiveRadiatorStandalone {
        return OpenISDPassiveRadiatorStandalone.wrap(blankDeviceRecord('passive-radiator'), engine);
    }

    // [x] STRATEGY (fromConformingRecord):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    static fromConformingRecord(record: unknown, engine: Engine): OpenISDPassiveRadiatorStandalone | string[] {
        const conformed = OpenISDDeviceJson.fromConformingRecord(record);
        if ('problems' in conformed) return conformed.problems;

        const sectionProblems = radiatorSectionProblems(conformed.json);
        if (sectionProblems.length > 0) return sectionProblems;
        return OpenISDPassiveRadiatorStandalone.wrap(conformed.json, engine);
    }



    private constructor(
        get: () => OpenISDDeviceJson,
        set: (json: OpenISDDeviceJson) => void,
        engine: Engine,
    ) {
        // [x] STRATEGY (super):
        //     ROLE: Internal member of enclosure/device/project.
        //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
        super({get, set: (json) => set(json!)}, engine);
        // The refusal in `prSpec` can never fire here: `window()` rejects a record with no
        // `passive-radiator` section, so a standalone always has one.
    }

    // [x] STRATEGY (window):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    static window(
        get: () => OpenISDDeviceJson,
        set: (json: OpenISDDeviceJson) => void,
        engine: Engine,
    ): OpenISDPassiveRadiatorStandalone {
        if (!get().specs['passive-radiator']) {
            throw new Error('OpenISDPassiveRadiatorStandalone.window: record has no passive-radiator section');
        }
        return new OpenISDPassiveRadiatorStandalone(get, set, engine);
    }

    // [x] STRATEGY (wrap):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    static wrap(json: OpenISDDeviceJson, engine: Engine): OpenISDPassiveRadiatorStandalone {
        let current = json;
        return OpenISDPassiveRadiatorStandalone.window(() => current, (j) => {
            current = j;
        }, engine);
    }

    /** @internal The record a save writes, deep-cloned — the radiator's counterpart to
     *  `OpenISDDriver.cloneDriver()`, and the persistence layer's one way to reach the raw
     *  record it stores, never field by field. Clones before handing it out, so the caller can
     *  store the result without aliasing this radiator's own live record.
     *
     *  On the STANDALONE only: `window()` refuses a record with no `passive-radiator` section,
     *  so a standalone always has one. An embedded radiator's slot can be null (an empty PR
     *  slot), which is a different question with a different answer. */
    // [x] STRATEGY (clonePassiveRadiator):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    clonePassiveRadiator(): OpenISDDeviceJson {
        const record = this.slot.get();
        if (record === null) throw new Error('OpenISDPassiveRadiatorStandalone: a standalone radiator always has a record');
        return structuredClone(record);
    }

}



// FRIEND ACCESS. Every project's record lives here rather than in a `#json` field, because the
// components a project contains — its embedded driver, its box — legitimately need to reach it,
// and TypeScript has no `friend`.
//
// The alternatives do not hold. `#json` is too private: unreachable even by a class declared
// beside it. A `json()` method — or a method returning an unexported `HasJson` interface — is
// too public: NOT exporting a type only makes it unnameable, never unreachable, so a consumer
// still writes `project.internals().json().driver.brand.value` and TypeScript resolves the whole
// chain structurally without needing a single one of those names. A module-private `unique
// symbol` key would work, but stays discoverable at runtime via `Object.getOwnPropertySymbols`.
//
// A module-scoped WeakMap is the one that actually holds: every class in THIS file can reach any
// project's record, and nothing outside can, because nothing outside can reach the map.


/**
 * THE PROJECT — the one type the app holds.
 *
 * Wraps an `OpenISDProjectJson` directly and holds TWO records: `#saved` is the project as of the
 * last save, `#edited` is the project including every change since. `#edited` is null until the
 * first write, so an untouched project costs one record, not two.
 *
 * There is no separate what-if. A what-if and an unsaved edit were the same mechanism differing
 * only in the user's intention (John 2026-08-27), so a what-if is now: edit, look at the curves,
 * press Cancel.
 *
 * `driver` and `box` are live WINDOWS over slices of whichever record is current — reads and
 * writes go straight through, never to a disconnected copy.
 */
// [x] STRATEGY (class OpenISDProject):
//     ROLE: Core domain model implementation class for OpenISDProject.
//     STATUS: MAINTAIN & ENHANCE. Encapsulates state over immutable JSON records.
export class OpenISDProject {
    // [x] STRATEGY (builder):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    static builder(driver: OpenISDDriver, engine: Engine): ProjectBuilder {
        return new ProjectBuilder(driver, engine);
    }

    /**
     * A new project with every section present and nothing stated — what the New Project wizard
     * opens on and writes into, rather than collecting a spec and building at the end.
     *
     * The driver and the radiator are blank devices (`OpenISDDriver.empty()`,
     * `OpenISDPassiveRadiatorStandalone.empty()`), so no physical value here was invented: the
     * wizard repopulates the driver from the one the user picks, and the radiator from the one
     * they pick when they choose a passive-radiator box.
     *
     * The radiator is present FROM THE START, in every project, whatever its box type. A radiator
     * slot that is null until someone calls `configurePR()` makes switching to a passive-radiator
     * box throw on the first write to a radiator field, which is the box type being unreachable
     * rather than unconfigured.
     */
    // [x] STRATEGY (empty):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    static empty(engine: Engine): OpenISDProject {
        return OpenISDProject.builder(OpenISDDriver.empty(engine), engine)
            .sealed()
            .volume_m3(0)
            .radiator(OpenISDPassiveRadiatorStandalone.empty(engine))
            .build();
    }

    /** THE project's identity, and IN-MEMORY ONLY — deliberately a class field rather than a
     *  member of `OpenISDProjectJson`, which is what makes "internal only" structural instead of
     *  a rule someone has to remember: the record is the only thing that is ever serialised, so
     *  an id that is not in it CANNOT reach a file or a link (John 2026-08-26, QO92).
     *
     *  It exists so the running app can tell two open projects apart when their names collide,
     *  and so a store — or a focus pointer — can key on something stable. */
    // [x] STRATEGY (#uuid):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly #uuid: string;

    /** The project as of the last save. Never mutated: every write builds a new record. */
    // [x] STRATEGY (#saved):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    #saved: OpenISDProjectJson;

    /** The project including every change since the last save, or null when no change has been
     *  made. Always a COMPLETE record, never a partial one. */
    // [x] STRATEGY (#edited):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    #edited: OpenISDProjectJson | null = null;

    // [x] STRATEGY (#listeners):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly #listeners = new ProjectListeners();

    /** The one calculation surface this project uses. INJECTED — never constructed here, never
     *  reached through a module-scoped instance. Every acoustic figure the project reports comes
     *  from this reference and from nowhere else. */
    // [x] STRATEGY (#engine):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly #engine: Engine;

    private constructor(saved: OpenISDProjectJson, uuid: string, engine: Engine) {
        this.#saved = saved;
        this.#uuid = uuid;
        this.#engine = engine;
    }

    /** The embedded driver — built fresh from the current record on every access, never held: the
     *  project has exactly three stored fields (`#saved`/`#edited`/`#engine`, John 2026-09-06),
     *  and every other public member is a getter mirroring the record's own structure. */
    // [x] STRATEGY (driver):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    get driver(): OpenISDDriverEmbedded {
        return OpenISDDriverEmbedded.wrap(
            // [x] STRATEGY (focus):
            //     ROLE: Internal member of enclosure/device/project.
            //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
            focus(this.#slot('driverEmbedding'), 'device'),
            this.#engine,
            () => this.#current().environment,
        );
    }

    /** Replace the embedded driver's whole record with `source`'s — the project adopting a
     *  different driver (choosing one from the library, loading a `.wdr`/`.owdr` file).
     *  Array-level facts (`nDrivers`, `wiring`, ...) are untouched; only `driverEmbedding.device`
     *  changes. */
    // [x] STRATEGY (setDriver):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    setDriver(source: OpenISDDriver): void {
        this.driver.update(source);
    }

    /** Adopt a driver that came from outside this project — a library pick, or a `.wdr`/`.owdr`
     *  file just parsed. Same write as `setDriver`, with a name that says where the driver came
     *  from. Deep-clones — the file's/library's driver and this project's share no nested object
     *  afterward. */
    // [x] STRATEGY (loadDriver):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    loadDriver(source: OpenISDDriver): void {
        if (source instanceof OpenISDDriverEmbedded) {
            throw new Error('loadDriver(): source must be a standalone OpenISDDriver, not an embedded project driver');
        }
        this.driver.update(source);
    }

    /** How many units of the embedded driver this project's array uses, and how they're wired
     *  together — array-level facts, not facts about the driver itself (John 2026-09-06). */
    // [x] STRATEGY (nDrivers):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    get nDrivers(): RawField<number> {
        return focus(this.#slot('driverEmbedding'), 'nDrivers');
    }

    // [x] STRATEGY (wiring):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    get wiring(): RawField<'series' | 'parallel'> {
        return focus(this.#slot('driverEmbedding'), 'wiring');
    }

    /** Thermal power compression: coil temperature rise under drive, Kelvin. */
    // [x] STRATEGY (vcTempRise_K):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    get vcTempRise_K(): RawField<number> {
        return focus(this.#slot('driverEmbedding'), 'vcTempRise_K');
    }

    /** The amplifier's own source/output resistance loading this array. */
    // [x] STRATEGY (Rs_ohm):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    get Rs_ohm(): RawField<number> {
        return focus(this.#slot('driverEmbedding'), 'Rs_ohm');
    }

    /** Mass this project's array adds to the driver — its own hardware, not a fact about the
     *  driver itself. */
    // [x] STRATEGY (driverAddedMass_kg):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    get driverAddedMass_kg(): RawField<number> {
        return focus(this.#slot('driverEmbedding'), 'driverAddedMass_kg');
    }

    /** This array's own voice-coil resistance temperature coefficient, SI 1/K — independent of
     *  the driver's own datasheet `driver.alfaVC_per_K` (WinISD stores these separately, and
     *  they can diverge). */
    // [x] STRATEGY (alfaVC_per_K):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    get alfaVC_per_K(): RawField<number> {
        return focus(this.#slot('driverEmbedding'), 'alfaVC_per_K');
    }

    /** WinISD Driver tab "Standard" / "Iso-Barik" radio. */
    // [x] STRATEGY (loading):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    get loading(): RawField<'standard' | 'isobaric'> {
        return focus(this.#slot('driverEmbedding'), 'loading');
    }

    /** The box — handed the DRIVER and the ENGINE: a chamber's resonance depends on the driver it
     *  loads, and the box reads the driver through its PUBLIC field surface, never its record.
     *  Built fresh on every access, same reasoning as `driver`. */
    // [x] STRATEGY (box):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    get box(): Box {
        return OpenISDBox.wrap(this.#slot('box'), this.driver, this.#engine, () => this.#current().environment);
    }

    /** What the user calls this project. A LABEL, not an identity — two projects may share one,
     *  which is exactly why `uuid()` exists. */
    // [x] STRATEGY (name):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    get name(): RawField<string> {
        return focus(this.#slot('meta'), 'name');
    }

    /** WinISD Project tab: who made this project, and when. */
    // [x] STRATEGY (creator):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    get creator(): RawField<string> {
        return focus(this.#slot('meta'), 'creator');
    }

    // [x] STRATEGY (created):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    get created(): RawField<string> {
        return focus(this.#slot('meta'), 'created');
    }

    // [x] STRATEGY (modified):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    get modified(): RawField<string> {
        return focus(this.#slot('meta'), 'modified');
    }

    /** WinISD Project tab: the user's own note about this project. Stored, never interpreted. */
    // [ ] STRATEGY (description):
    //     ROLE: Descriptive metadata attribute on driver record.
    //     STATUS: UPGRADE from raw getter to ReadOnlyCalculatedField<string>.
    //     MECHANICS: Wraps string in Cell shape carrying name and entered/calculated provenance across package boundaries.
    get description(): RawField<string> {
        return focus(this.#slot('meta'), 'description');
    }

    /** The signal-chain filter list. */
    // [x] STRATEGY (filters):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    get filters(): RawField<readonly Filter[]> {
        return focus(this.#slot('filters'), 'filters');
    }

    /** Force-flat auto-EQ — WinISD Advanced "Force flat response". */
    // [x] STRATEGY (forceFlatResponse):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    get forceFlatResponse(): RawField<boolean> {
        return focus(this.#slot('advanced'), 'forceFlatResponse');
    }

    /** Model ports as a lossy transmission line instead of a lumped mass — WinISD Advanced
     *  "Use transmission line-model for port simulation". */
    // [x] STRATEGY (useTransmissionLinePortModel):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    get useTransmissionLinePortModel(): RawField<boolean> {
        return focus(this.#slot('advanced'), 'useTransmissionLinePortModel');
    }

    /** WinISD Advanced "Rg is at driver side" — whether the amplifier's source resistance
     *  (`Rs_ohm`) is applied per driver or once across the whole array. */
    // [x] STRATEGY (rgAtDriverSide):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    get rgAtDriverSide(): RawField<boolean> {
        return focus(this.#slot('advanced'), 'rgAtDriverSide');
    }

    /** WinISD Advanced "Simulate voice coil inductance" — includes Le in the acoustic circuit
     *  model (gyrator) rather than just the impedance plot (winisd). */
    // [x] STRATEGY (circuitModel):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    get circuitModel(): RawField<'winisd' | 'gyrator'> {
        return focus(this.#slot('advanced'), 'circuitModel');
    }

    /** WinISD Advanced "SPL graph is Xmax limited" — whether the SPL chart shows the
     *  Xmax-backed-off curve instead of the unclamped one. Display only. */
    // [x] STRATEGY (splGraphIsXmaxLimited):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    get splGraphIsXmaxLimited(): RawField<boolean> {
        return focus(this.#slot('advanced'), 'splGraphIsXmaxLimited');
    }

    /** The frequency range every chart panel sweeps and is plotted over — shared across all
     *  panels (John 2026-09-07), unlike each panel's own Y-axis zoom (`yRangeForChart`/
     *  `setYRangeForChart` below). Absent means the engine's own sweep defaults. */
    // [x] STRATEGY (sweepFmin_hz):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    get sweepFmin_hz(): RawField<number | undefined> {
        return focus(this.#slot('charts'), 'fmin_hz');
    }

    // [x] STRATEGY (sweepFmax_hz):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    get sweepFmax_hz(): RawField<number | undefined> {
        return focus(this.#slot('charts'), 'fmax_hz');
    }

    // [x] STRATEGY (sweepN):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    get sweepN(): RawField<number | undefined> {
        return focus(this.#slot('charts'), 'N');
    }

    /** This project's saved Y-axis zoom for one chart (`chartId` is the UI's `ChartTabId`,
     *  carried here as a plain string per `domain/index.ts`'s "no packages/ui types" rule) —
     *  null when that panel is on auto-scale. */
    // [x] STRATEGY (yRangeForChart):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    yRangeForChart(chartId: string): {ymin: number; ymax: number} | null {
        return this.#current().charts.perTab[chartId] ?? null;
    }

    /** Sets (or, passing null, clears back to auto-scale) the saved Y-axis zoom for one
     *  chart. */
    // [x] STRATEGY (setYRangeForChart):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    setYRangeForChart(chartId: string, range: {ymin: number; ymax: number} | null): void {
        const charts = this.#current().charts;
        const perTab = {...charts.perTab};
        if (range) perTab[chartId] = range; else delete perTab[chartId];
        this.#slot('charts').set({...charts, perTab});
    }

    /** Clears the shared sweep range and every chart's Y-axis zoom back to auto/engine
     *  defaults — the chart top bar's Reset button. */
    // [x] STRATEGY (resetCharts):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    resetCharts(): void {
        this.#slot('charts').set({perTab: {}});
    }

    /** A record ENTERS the process here. A record carries no identity, so one is minted — two
     *  wraps of one record are two independently editable projects, which is what opening a FILE
     *  twice should give. */
    // [x] STRATEGY (wrap):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    static wrap(json: OpenISDProjectJson, engine: Engine): OpenISDProject {
        return this.wrapWithIdentity(json, newUuid(), engine);
    }

    /**
     * Wrap a record under an identity the caller already holds. FOR A STORE READ, AND NOTHING
     * ELSE: a store key was minted in this process, so adopting it back is restoring an identity,
     * not importing a foreign one. Without this, a project loaded from the store gets a new
     * identity and its next save writes to a NEW key, orphaning the entry it came from
     * (`bugs/BUG_20260826_reopening_a_stored_project_duplicates_its_store_entry.md`).
     *
     * NOT for a file: a file's id was minted by another process and is provenance, never a key
     * (the driver precedent, QO81).
     */
    // [x] STRATEGY (wrapWithIdentity):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    static wrapWithIdentity(json: OpenISDProjectJson, uuid: string, engine: Engine): OpenISDProject {
        return new OpenISDProject(json, uuid, engine);
    }

    /** Wrap a stored session (saved and edited states) under an adopted identity. */
    // [x] STRATEGY (wrapSession):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    static wrapSession(session: OpenISDProjectSessionJson, uuid: string, engine: Engine): OpenISDProject {
        const project = new OpenISDProject(session.saved, uuid, engine);
        if (session.edited) {
            project.#edited = session.edited;
        }
        return project;
    }


    /** This project's in-memory identity. */
    // [x] STRATEGY (uuid):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    uuid(): string {
        return this.#uuid;
    }

    /** The record every read goes to. */
    // [x] STRATEGY (#current):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    #current(): OpenISDProjectJson {
        return this.#edited ?? this.#saved;
    }

    /** Enter the edited state if not already in it, and answer the record a write must build on.
     *  The first call copies `#saved`; later calls answer the existing `#edited`. */
    // [x] STRATEGY (#ensureEditing):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    #ensureEditing(): OpenISDProjectJson {
        if (!this.#edited) this.#edited = {...this.#saved};
        return this.#edited;
    }

    /** A get/set pair addressing ONE top-level field of the record. Reads whichever record is
     *  current; every write lands in `#edited`.
     *
     *  The write REPLACES the record rather than mutating one, so a caller holding an earlier
     *  record sees no change through it — copy-on-write, with the copy being the spread that a
     *  write performs anyway. */
    // [x] STRATEGY (#slot<K extends keyof OpenISDProjectJson>):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    #slot<K extends keyof OpenISDProjectJson>(key: K): Lens<OpenISDProjectJson[K]> {
        return {
            get: () => this.#current()[key],
            set: (value) => {
                const base = this.#ensureEditing();
                this.#edited = {...base, [key]: value};
                this.#notify();
            },
        };
    }

    /** @internal The record a save writes, deep-cloned — `projectRepo()`'s one way to reach it,
     *  never field by field. Reads `#saved`, NEVER `#edited`: a file/share write must never
     *  persist unsaved changes on its own — `save()` is a distinct, explicit user action (the
     *  Save button), and this method must not promote `#edited` to `#saved` as a side effect of
     *  being called. A caller writing out an edited project calls `save()` first, itself, in
     *  response to the user's own action. Clones before handing it out, so the stored copy
     *  cannot drift when this project is edited afterward — a shallow `{...}` spread is not
     *  enough, since every nested field object (`box`, `driver`, `environment`, …) would still be
     *  the same reference as the live record. No code outside `packages/design` may call this. */
    // [x] STRATEGY (cloneSavedProject):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    cloneSavedProject(): OpenISDProjectJson {
        return structuredClone(this.#saved);
    }

    /** This project as WinISD `.wpr` text — the form `OpenISDProject.fromWprText` reads back.
     *
     *  Writing is a SNAPSHOT: the converter reads this project and renders text, and keeps no
     *  hold on it afterwards, so saving a file never changes what is on screen.
     *
     *  `.wpr` models fewer box types and fewer fields than openisd does, so this is a lossy
     *  write and `value` is null when the box cannot be expressed at all (a `bandpass6`, say).
     *  `errors` carries the reason and every field dropped along the way. */
    // [x] STRATEGY (toWprText):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    toWprText(engine: Engine): { value: string | null; errors: DriverError[] } {
        const {value: wpr, errors} = openIsdProjectToWinIsdProject(this, engine);
        return {value: wpr ? wpr.toWpr() : null, errors};
    }

    /** WinISD `.wpr` text back to a project. The inverse of `toWprText()`, as far as a format
     *  carrying fewer box types and fields allows. */
    // [x] STRATEGY (fromWprText):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    static fromWprText(text: string, engine: Engine): { value: OpenISDProject | null; errors: DriverError[] } {
        return winIsdProjectToOpenIsdProject(text, engine);
    }

    /** This project as `.owpr` text — openisd project JSON, the form
     *  `OpenISDProject.fromOwprText` reads back. Carries the saved state, the edited state and
     *  the name, so reopening the file restores unsaved edits exactly as they were.
     *
     *  Lossless, unlike `toWprText()`: this is openisd's own format, so there is nothing to drop
     *  and no error to report. */
    // [x] STRATEGY (toOwprText):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    toOwprText(): string {
        return JSON.stringify(this.cloneSession(), null, 2);
    }

    /** `.owpr` text back to a project, or everything wrong with the text. The inverse of
     *  `toOwprText()`.
     *
     *  The project takes a FRESH identity: a file's contents are provenance, not a store key
     *  (QO81), so opening the same file twice yields two independently addressable projects. */
    // [x] STRATEGY (fromOwprText):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    static fromOwprText(text: string, engine: Engine): OpenISDProject | string[] {
        let parsed: unknown;
        try {
            parsed = JSON.parse(text);
        } catch {
            return ['not valid JSON'];
        }
        const result = openISDProjectSessionJsonSchema.safeParse(parsed);
        if (!result.success) {
            return result.error.issues.map(issue => issue.path.length === 0
                ? issue.message
                : `'${issue.path.join('.')}': ${issue.message}`);
        }
        return OpenISDProject.wrapSession(result.data, newUuid(), engine);
    }

    /** Serialises both saved and edited states for persistence. */
    // [x] STRATEGY (cloneSession):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    cloneSession(): OpenISDProjectSessionJson {
        return {
            label: this.name.get(),
            saved: structuredClone(this.#saved),
            edited: this.#edited ? structuredClone(this.#edited) : null,
        };
    }


    /** Whether unsaved changes exist. `charts` (chart zoom/sweep range) is excluded: dragging a
     *  chart axis writes through the same `#slot().set()` path as every other field, but it is
     *  view state, not a change the user should be asked to save — see BACKLOG.md "Round-trip
     *  chart view state". Every other field still counts. */
    // [x] STRATEGY (isModified):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    isModified(): boolean {
        if (!this.#edited) return false;
        const {charts: _editedCharts, ...editedRest} = this.#edited;
        const {charts: _savedCharts, ...savedRest} = this.#saved;
        return JSON.stringify(editedRest) !== JSON.stringify(savedRest);
    }

    // ── THE SIGNAL ────────────────────────────────────────────────────────────────────────────

    /**
     * The voltage that delivers this project's stated drive power into its driver — `√(Pin·Re)`,
     * WinISD's reference-power convention, and the `eg` every sweep is run at.
     *
     * Null when no power is stated or the driver has no usable `Re`. Never a substituted default:
     * a project that has not been told its drive level does not have one.
     */
    // [ ] STRATEGY (driveVoltage_V):
    //     ROLE: Applied generator drive level voltage (eg) in Volts.
    //     STATUS: UPGRADE from method to N-way Field<number>.
    //     MECHANICS: .get() reads precomputed voltage. .set(v) calculates power_W = v^2 / Re and updates signal state.
    driveVoltage_V(): number | null {
        const power_W = this.#current().signal.power_W;
        const Re_ohm = this.driver.solveConsistencyGroup().Re_ohm;
        return power_W === null || Re_ohm === undefined ? null : this.#engine.driveVoltage(power_W, Re_ohm);
    }

    /** This project's stated reference power — WinISD's Signal-tab "Input Power". Null until
     *  stated: 1 W is a measurement convention, not a fact about this design. */
    // [ ] STRATEGY (powerDrive_W):
    //     ROLE: Stated generator reference power (Pin) in Watts.
    //     STATUS: UPGRADE from method to N-way Field<number>.
    //     MECHANICS: .get() reads power. .set(w) calculates driveVoltage_V = sqrt(w * Re) and updates signal state.
    powerDrive_W(): number | null {
        return this.#current().signal.power_W;
    }

    /** This project's stated drive voltage, WHEN IT WAS THE VOLTAGE THAT WAS STATED rather than
     *  derived from power — WinISD's Signal-tab "Input Voltage". Null until stated. */
    // [ ] STRATEGY (statedVoltage_V):
    //     ROLE: Stated drive voltage recorded when voltage was the primary entered quantity.
    //     STATUS: UPGRADE from method to Field<number> backed by signal.voltage_V.
    statedVoltage_V(): number | null {
        return this.#current().signal.voltage_V;
    }

    /** State the drive level as a power, in watts — solves and stores the matching voltage too
     *  (`√(Pin·Re)`), so `driveVoltage_V()`/`statedVoltage_V()` never disagree with what was just
     *  set. Requires the driver to have a usable `Re`; a caller with an incomplete driver cannot
     *  state a drive level in these terms yet. */
    // [ ] STRATEGY (setPowerDrive_W):
    //     ROLE: Legacy mutation method for drive level.
    //     STATUS: DEPRECATE / ALIAS.
    //     DECISION: Forward directly to new Field.set() method to preserve backward compatibility.
    setPowerDrive_W(power_W: number): void {
        const Re_ohm = this.driver.solveConsistencyGroup().Re_ohm;
        if (Re_ohm === undefined) {
            throw new Error('setPowerDrive_W cannot solve a voltage: the driver has no usable Re_ohm yet.');
        }
        const voltage_V = this.#engine.driveVoltage(power_W, Re_ohm);
        this.#slot('signal').set({power_W, voltage_V});
    }

    /** State the drive level as a voltage — solves and stores the matching power too
     *  (`V²/Re`), the inverse of `setPowerDrive_W`. Same `Re` requirement. */
    // [ ] STRATEGY (setDriveVoltage_V):
    //     ROLE: Legacy mutation method for drive level.
    //     STATUS: DEPRECATE / ALIAS.
    //     DECISION: Forward directly to new Field.set() method to preserve backward compatibility.
    setDriveVoltage_V(voltage_V: number): void {
        const Re_ohm = this.driver.solveConsistencyGroup().Re_ohm;
        if (Re_ohm === undefined) {
            throw new Error('setDriveVoltage_V cannot solve a power: the driver has no usable Re_ohm yet.');
        }
        const power_W = this.#engine.driveFromVoltage(voltage_V, Re_ohm);
        this.#slot('signal').set({power_W, voltage_V});
    }

    // ── ENVIRONMENT ───────────────────────────────────────────────────────────────────────────

    /** This project's stated air temperature, WinISD Advanced "Temperature". Null until stated —
     *  the reference value lives in `@openisd/engine` (`air.ts`), never duplicated here. */
    // [ ] STRATEGY (envTempK):
    //     ROLE: Environmental atmospheric condition parameter.
    //     STATUS: UPGRADE from getter/setter pair to pure state Field<number>.
    //     MECHANICS: Pure axiomatic input. Direct read/write to environment JSON slice; triggers recalc on .set().
    envTempK(): number | null {
        return this.#current().environment.temperature_K;
    }

    // [ ] STRATEGY (setEnvTempK):
    //     ROLE: Legacy environment setter.
    //     STATUS: DEPRECATE / ALIAS. Forward directly to field.set().
    setEnvTempK(tempK: number): void {
        this.#slot('environment').set({...this.#current().environment, temperature_K: tempK});
    }

    /** This project's stated relative humidity, WinISD Advanced "Humidity". Null until stated. */
    // [ ] STRATEGY (envHumidityPct):
    //     ROLE: Environmental atmospheric condition parameter.
    //     STATUS: UPGRADE from getter/setter pair to pure state Field<number>.
    //     MECHANICS: Pure axiomatic input. Direct read/write to environment JSON slice; triggers recalc on .set().
    envHumidityPct(): number | null {
        return this.#current().environment.humidity_pct;
    }

    // [ ] STRATEGY (setEnvHumidityPct):
    //     ROLE: Legacy environment setter.
    //     STATUS: DEPRECATE / ALIAS. Forward directly to field.set().
    setEnvHumidityPct(humidityPct: number): void {
        this.#slot('environment').set({...this.#current().environment, humidity_pct: humidityPct});
    }

    /** This project's stated atmospheric pressure, WinISD Advanced "Pressure". Null until
     *  stated. */
    // [ ] STRATEGY (envPressurePa):
    //     ROLE: Environmental atmospheric condition parameter.
    //     STATUS: UPGRADE from getter/setter pair to pure state Field<number>.
    //     MECHANICS: Pure axiomatic input. Direct read/write to environment JSON slice; triggers recalc on .set().
    envPressurePa(): number | null {
        return this.#current().environment.pressure_Pa;
    }

    // [ ] STRATEGY (setEnvPressurePa):
    //     ROLE: Legacy environment setter.
    //     STATUS: DEPRECATE / ALIAS. Forward directly to field.set().
    setEnvPressurePa(pressurePa: number): void {
        this.#slot('environment').set({...this.#current().environment, pressure_Pa: pressurePa});
    }

    /** Which air formula this project's sweeps use — WinISD's parity model when true, OpenISD's
     *  physical CIPM-2007 model when false. Null reads as true (QO95): a new project matches
     *  WinISD out of the box. See `engine/air.ts` for the two models. */
    // [ ] STRATEGY (envUseWinisdAirModel):
    //     ROLE: Air model selector (WinISD parity vs CIPM-2007).
    //     STATUS: UPGRADE from getter/setter pair to RawField<boolean> backed by environment.useWinisdAirModel.
    envUseWinisdAirModel(): boolean {
        return this.#current().environment.useWinisdAirModel ?? true;
    }

    // [ ] STRATEGY (setEnvUseWinisdAirModel):
    //     ROLE: Legacy air model setter.
    //     STATUS: DEPRECATE / ALIAS. Forward to envUseWinisdAirModel.set().
    setEnvUseWinisdAirModel(useWinisdAirModel: boolean): void {
        this.#slot('environment').set({...this.#current().environment, useWinisdAirModel});
    }

    /**
     * Qts as the amplifier's source impedance actually loads it.
     *
     * `Rs` is a PARAMETER rather than a record field because the record has no home for it — the
     * same decision `packages/model`'s `sealedResonance()` made and for the same reason. When the
     * amplifier's output impedance gets a home, this reads it instead.
     *
     * Null when the driver's Q group is too incomplete to resolve.
     */
    // [x] STRATEGY (sourceLoadedQts):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    sourceLoadedQts(Rs: number): number | null {
        const {Qms, Qes, Re_ohm, Qts} = this.driver.solveConsistencyGroup();
        if (Qms === undefined || Qes === undefined || Re_ohm === undefined || Qts === undefined) return null;
        return this.#engine.sourceLoadedQts(Qms, Qes, Re_ohm, Rs, Qts);
    }

    // ── SIMULATION — the engine's sweep, run on THIS project's driver and box ──────────────────
    //
    // Everything the engine's `SweepParams` needs beyond the frequency grid is already stored
    // somewhere on this project's own record — the box's volume/vent/losses/PR-chamber fields,
    // the driver embedding's wiring/count/thermal fields, the Advanced-tab settings. A caller
    // asking for a sweep supplies only what it actually decides: the grid to sweep over. Passing
    // any of the rest back in would let a caller override a fact the project already states about
    // itself, which is the thing John's 2026-09-06 ruling rules out.

    /** The frequency grid a sweep runs over — the only thing about a sweep this project does not
     *  already know about itself. */
    /** The ENCLOSURE parameters alone — what `validateParams` reads (`engine/params.ts`: `Vb`,
     *  `Vf`, `Sp`, `prSd`, `prCms`, `prMmd`), with no drive level and no sweep settings.
     *
     *  Separate from `#sweepParams` because the two answer different questions. Sweeping needs a
     *  drive voltage, which needs the driver's `Re`; checking that a box volume is a usable number
     *  does not. Building the validation input through the sweep's guard made an absent `Re`
     *  silence every enclosure complaint on exactly the half-finished projects that most need
     *  them.
     *
     *  An unstated volume is passed through as-is rather than short-circuiting to "no issues":
     *  "you have not sized the box" is the complaint, not a reason to stay quiet. */
    // [x] STRATEGY (#enclosureParams):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    #enclosureParams(): EnclosureParams {
        const boxType = this.box.boxType.get();
        const {Vf, Sp, prSd, prCms, prMmd} = this.#boxSpecificParams(boxType);
        return {Vb: this.#boxVolume_m3() ?? undefined, Vf, Sp, prSd, prCms, prMmd};
    }

    // [x] STRATEGY (#sweepParams):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    #sweepParams(P: FrequencyGrid): SweepParams | null {
        const Vb = this.#boxVolume_m3();
        const eg = this.driveVoltage_V();
        if (Vb === null || eg === null) return null;

        const box = this.box;
        const boxType = box.boxType.get();
        let losses: {Ql?: number; Qa?: number; Qp?: number} = {};
        switch (boxType) {
            case 'sealed': losses = {Ql: box.sealed.losses.Ql.get(), Qa: box.sealed.losses.Qa.get()}; break;
            case 'vented': losses = {Ql: box.vented.losses.Ql.get(), Qa: box.vented.losses.Qa.get(), Qp: box.vented.losses.Qp.get()}; break;
            case 'bandpass4': losses = {Ql: box.bandpass4.chambers.rear.losses.Ql.get(), Qa: box.bandpass4.chambers.rear.losses.Qa.get()}; break;
            case 'box-passive-radiator': losses = {Ql: box.passiveRadiator.losses.Ql.get(), Qa: box.passiveRadiator.losses.Qa.get()}; break;
        }

        return {
            Vb, eg,
            fmin: P.fmin ?? this.sweepFmin_hz.get(), fmax: P.fmax ?? this.sweepFmax_hz.get(), N: P.N ?? this.sweepN.get(),
            nDrivers: this.nDrivers.get(),
            wiring: this.wiring.get(),
            Rs: this.Rs_ohm.get(),
            circuitModel: this.circuitModel.get(),
            Ql: losses.Ql, Qa: losses.Qa, Qp: losses.Qp,
            ...this.#boxSpecificParams(boxType),
            tempK: this.#current().environment.temperature_K ?? undefined,
            humidityPct: this.#current().environment.humidity_pct ?? undefined,
            pressurePa: this.#current().environment.pressure_Pa ?? undefined,
            useWinisdAirModel: this.#current().environment.useWinisdAirModel ?? true,
            driverAddedMass: this.driverAddedMass_kg.get(),
            vcTempRise: this.vcTempRise_K.get(),
            alfaVC: this.alfaVC_per_K.get(),
            rgAtDriverSide: this.rgAtDriverSide.get(),
            tlPortModel: this.useTransmissionLinePortModel.get(),
            forceFlatResponse: this.forceFlatResponse.get(),
            filters: [...this.filters.get()],
        };
    }

    /** This project's box volume, WHICHEVER topology is active — `Vb` in `SweepParams` is always
     *  the driver-side chamber's own volume, sealed or the equivalent for every other topology. */
    // [x] STRATEGY (#boxVolume_m3):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    #boxVolume_m3(): number | null {
        const box = this.box;
        switch (box.boxType.get()) {
            case 'sealed': return box.sealed.volume_m3.get();
            case 'vented': return box.vented.volume_m3.get().value;
            case 'bandpass4': return box.bandpass4.chambers.rear.volume_m3.get().value;
            case 'box-passive-radiator': return box.passiveRadiator.volume_m3.get();
            default: return null;
        }
    }

    /** The fields only one box topology reads — the vent's `Sp`/`Leff` for `vented`/`bandpass4`,
     *  the passive radiator's five for `box-passive-radiator`. Geometry only (`area_m2()`,
     *  `effectiveLength_m()`), never acoustics, per this file's header ruling. */
    // [x] STRATEGY (#boxSpecificParams):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    #boxSpecificParams(boxType: BoxType): Partial<SweepParams> {
        const box = this.box;
        switch (boxType) {
            case 'vented': {
                const Sp = box.vented.vent.area_m2();
                const Leff = box.vented.vent.effectiveLength_m();
                return {Sp: Sp ?? undefined, Leff: Leff ?? undefined};
            }
            case 'bandpass4': {
                const Sp = box.bandpass4.vents.front.area_m2();
                const Leff = box.bandpass4.vents.front.effectiveLength_m();
                return {Vf: box.bandpass4.chambers.front.volume_m3.get(), Sp: Sp ?? undefined, Leff: Leff ?? undefined};
            }
            case 'box-passive-radiator': {
                const r = box.passiveRadiator.radiator.spec;
                return {
                    prSd: r.Sd_m2.get().value ?? undefined,
                    prNum: box.passiveRadiator.count.get(),
                    prMmd: r.Mms_kg.get().value ?? undefined,
                    prMadd: box.passiveRadiator.addedMass_kg.get().value ?? undefined,
                    prCms: r.Cms_m_per_N.get().value ?? undefined,
                    prRms: r.Rms_kg_per_s.get().value ?? undefined,
                };
            }
            default: return {};
        }
    }

    /**
     * Which of the engine's simulable topologies this project is, or null.
     *
     * There is ONE box-type vocabulary now, so this translates nothing — it asks the engine which
     * of its own types it can model. Null for `bandpass6` and `abc`, which it has no circuit for,
     * and that null is the reason every simulation method below can return null: not a failure, a
     * topology the engine does not yet cover.
     */
    // [x] STRATEGY (#engineBoxType):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    #engineBoxType(): SimulatableBoxType | null {
        return this.#engine.simulatableBoxType(this.box.boxType.get());
    }

    /** The frequency response, impedance and excursion this design produces — or the issues that
     *  stopped it, each NAMING the quantity the driver does not state. A bare null would say only
     *  "cannot simulate", which is what a caller cannot act on. `value` is null with an empty
     *  `errors` when the active topology is one the engine has no model for, or a field this
     *  project itself needs to sweep (its box volume, its drive voltage) is not yet stated. */
    // [x] STRATEGY (sweep):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    sweep(P: FrequencyGrid): Result<SweepResult> {
        const box = this.#engineBoxType();
        const params = box ? this.#sweepParams(P) : null;
        if (!box || !params) return {value: null, errors: []};
        return this.#engine.sweep(this.driver.solveConsistencyGroup(), this.driver.Le_H(), box, params);
    }

    /** The excursion- and power-limited maximum SPL curves. Reports on the same terms as `sweep`. */
    // [x] STRATEGY (maxCurves):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    maxCurves(P: FrequencyGrid): Result<MaxCurvesResult> {
        const box = this.#engineBoxType();
        const params = box ? this.#sweepParams(P) : null;
        if (!box || !params) return {value: null, errors: []};
        return this.#engine.maxCurves(this.driver.solveConsistencyGroup(), this.driver.Le_H(), box, params);
    }

    /** What is wrong with these sweep parameters for this project's topology — checked BEFORE a
     *  sweep, so a caller can refuse rather than plot nonsense. Empty when nothing is wrong, and
     *  also empty (rather than a false accusation) when the topology cannot be simulated at all. */
    // [x] STRATEGY (validateParams):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    validateParams(_P: FrequencyGrid): DriverError[] {
        const box = this.#engineBoxType();
        return box ? this.#engine.validateParams(box, this.#enclosureParams()) : [];
    }

    /** The passband level a response is measured against — the reference every dB figure below is
     *  relative to. */
    // [x] STRATEGY (passbandRef):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    passbandRef(spl: number[]): number {
        return this.#engine.passbandRef(spl);
    }

    /** The frequency where the response has fallen `dropDb` below its passband — F3 at 3 dB, F6 at
     *  6, and so on. Null when the response never falls that far inside the swept range. */
    // [x] STRATEGY (rolloffFreq):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    rolloffFreq(sw: SweepResult, dropDb: number): number | null {
        return this.#engine.rolloffFreq(sw, dropDb);
    }

    /** A non-finite value anywhere in the response, or null. A sweep that produced NaN is a fault
     *  to report, never a curve to draw. */
    // [x] STRATEGY (classifyFinite):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    classifyFinite(sw: SweepResult): DriverError | null {
        return this.#engine.classifyFinite(sw);
    }

    /** A response clamped flat against a limit, or null — a shape that looks like a valid answer
     *  and is not. */
    // [x] STRATEGY (classifyFlatClamp):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    classifyFlatClamp(sw: SweepResult): DriverError | null {
        return this.#engine.classifyFlatClamp(sw);
    }

    /** The same finiteness check for the max-SPL curves. */
    // [x] STRATEGY (classifyMaxFinite):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    classifyMaxFinite(mx: MaxCurvesResult): DriverError | null {
        return this.#engine.classifyMaxFinite(mx);
    }

    /**
     * The impedance peak of a swept response — the resonance the design ACTUALLY exhibits, read
     * off the curve rather than predicted from a formula.
     *
     * Reads `Re` off this project's own driver, which is why it lives here and not on the caller.
     * Null when the driver has no usable `Re`, or the curve has no peak.
     */
    // [x] STRATEGY (impedancePeak):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    impedancePeak(sw: SweepResult | null): { Fsc: number; Qtc: number } | null {
        const Re_ohm = this.driver.solveConsistencyGroup().Re_ohm;
        return Re_ohm === undefined ? null : this.#engine.findImpedancePeak(sw, Re_ohm);
    }

    /** Promote the edited record. A no-op when nothing has been edited. */
    // [x] STRATEGY (save):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    save(): void {
        if (!this.#edited) return;
        this.#saved = this.#edited;
        this.#edited = null;
        this.#notify();
    }

    /**
     * Discard every change since the last save, after `confirm` agrees.
     *
     * The challenge is a PARAMETER because the caller — the Cancel button on the project bar —
     * already owns the warning dialog and holds the answer at the moment of the call. Threading a
     * callback through every construction path would deliver a value that one caller already has.
     *
     * Answers whether anything was discarded: false when nothing was edited, and false when the
     * user declined.
     */
    async cancel(confirm: DiscardChallenge): Promise<boolean> {
        if (!this.#edited) return false;
        if (!await confirm()) return false;
        this.#edited = null;
        this.#notify();
        return true;
    }

    // ── vent-group / PR-group solve ───────────────────────────────────────────────────────────
    //
    // FIXME(QO126, bugs/BUG_20260908_six_vent_and_pr_group_solve_methods_are_throwing_stubs.md):
    // these six answer the tuning ↔ paired-quantity relation — vent length on a vented box, added
    // cone mass on a passive-radiator one — which is NOT WIRED. `tuning_hz` is a stored value no
    // calculation consumes, and the forward/inverse methods that would close the loop
    // (`Vent.tuningIn_hz`/`lengthForTuning_m`, `PassiveRadiatorBox.systemTuning_hz`/
    // `addedMassForTuning_kg`) have no callers.
    //
    // Until that relation exists, these report "nothing solved, nothing known" rather than
    // throwing: `notifyVentChanged` runs on EVERY project change (`appState.ts`), so a throw here
    // means no project can be opened at all. Doing nothing is what the app did before the
    // migration, when neither direction had a caller — this is the pre-existing behaviour, not
    // a new one, and the feature is ruled and scoped in QO126.

    /** Derives whichever of the vented box's tuning/vent-length the user did not state. */
    // [ ] STRATEGY (notifyVentChanged):
    //     ROLE: Vent mutation listener trigger.
    //     STATUS: UPGRADE / EXPAND into recalc(): void.
    //     MECHANICS: Serves as the manual Recalc diagnostic safety net that triggers force-solve across the entire graph.
    notifyVentChanged(): void {
        this.#notify();
    }


    /** The tuning the vent as built actually produces. */
    // [ ] STRATEGY (ventAchievedFb):
    //     ROLE: Boundary indicator / diagnostic readout for enclosure tuning limits.
    //     STATUS: UPGRADE from method to ReadOnlyCalculatedField.
    //     MECHANICS: Precomputed by vent/PR consistency solver; pure synchronous read on .get().
    ventAchievedFb(): number | null {
        if (this.box.boxType.get() !== 'vented') return null;
        const Vb = this.box.vented.volume_m3.get().value;
        return this.box.vented.vent.tuningIn_hz(Vb);
    }

    /** The highest tuning this vent can reach in this volume. */
    // [ ] STRATEGY (ventMaxReachableFb):
    //     ROLE: Boundary indicator / diagnostic readout for enclosure tuning limits.
    //     STATUS: UPGRADE from method to ReadOnlyCalculatedField.
    //     MECHANICS: Precomputed by vent/PR consistency solver; pure synchronous read on .get().
    ventMaxReachableFb(): number | null {
        if (this.box.boxType.get() !== 'vented') return null;
        const Vb = this.box.vented.volume_m3.get().value;
        const Sp = this.box.vented.vent.area_m2();
        if (Vb === null || !(Vb > 0) || Sp === null) return null;
        return this.#engine.tuningFromLength(Vb ?? undefined, 0, Sp, this.box.vented.vent.endCorrection_m.get());
    }

    /** Whether the stated tuning is beyond what this vent can reach. */
    // [ ] STRATEGY (ventTargetUnreachable):
    //     ROLE: Boundary indicator / diagnostic readout for enclosure tuning limits.
    //     STATUS: UPGRADE from method to ReadOnlyCalculatedField.
    //     MECHANICS: Precomputed by vent/PR consistency solver; pure synchronous read on .get().
    ventTargetUnreachable(): boolean {
        if (this.box.boxType.get() !== 'vented') return false;
        const fbCell = this.box.vented.tuning_hz.get();
        const lenCell = this.box.vented.vent.length_m.get();
        if (fbCell.state === 'entered' && lenCell.state !== 'entered') {
            const Vb = this.box.vented.volume_m3.get().value;
            const targetFb = fbCell.value;
            if (Vb !== null && Vb > 0 && targetFb !== null && targetFb > 0) {
                const l = this.box.vented.vent.lengthForTuning_m(Vb ?? undefined, targetFb);
                return l !== null && l < 0;
            }
        }
        return false;
    }

    /** Derives whichever of the passive-radiator box's tuning/added-mass the user did not state. */
    // [x] STRATEGY (notifyPrChanged):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    notifyPrChanged(): void {
        this.#notify();
    }


    // [x] STRATEGY (solveDriverConsistencyGroup):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    solveDriverConsistencyGroup(): Readonly<DriverSolverQuantities> {
        return this.driver.solveDriverConsistencyGroup();
    }

    /** Whether the stated tuning is beyond what this radiator can reach. False on the same terms
     *  as `ventTargetUnreachable()`. */
    // [ ] STRATEGY (prTargetUnreachable):
    //     ROLE: Boundary indicator / diagnostic readout for enclosure tuning limits.
    //     STATUS: UPGRADE from method to ReadOnlyCalculatedField.
    //     MECHANICS: Precomputed by vent/PR consistency solver; pure synchronous read on .get().
    prTargetUnreachable(): boolean {
        if (this.box.boxType.get() !== 'box-passive-radiator') return false;
        const fp = this.box.passiveRadiator.tuning_hz.get().value;
        if (fp === null || !(fp > 0)) return false;
        const m = this.box.passiveRadiator.addedMassForTuning_kg(fp);
        return m !== null && m < 0;
    }

    /** Batch multiple mutations into a single subscriber notification. */
    // [x] STRATEGY (batch<T>):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    batch<T>(fn: () => T): T {
        return this.#listeners.batch(fn);
    }

    /** Register a listener, fired on every change to the current record and on entering or
     *  leaving the edited state. Returns an unsubscribe function. */
    // [x] STRATEGY (subscribe):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    subscribe(fn: () => void): () => void {
        this.#listeners.add(fn);
        return () => {
            this.#listeners.delete(fn);
        };
    }

    // [x] STRATEGY (#notify):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    #notify(): void {
        this.#listeners.notify();
    }
}

// [x] STRATEGY (class ProjectListeners):
//     ROLE: Core domain model implementation class for ProjectListeners.
//     STATUS: MAINTAIN & ENHANCE. Encapsulates state over immutable JSON records.
class ProjectListeners {
    // [x] STRATEGY (#set):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    readonly #set = new Set<() => void>();
    // [x] STRATEGY (#depth):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    #depth = 0;
    // [x] STRATEGY (#pending):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    #pending = false;

    // [x] STRATEGY (add):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    add(fn: () => void): void {
        this.#set.add(fn);
    }

    // [x] STRATEGY (delete):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    delete(fn: () => void): void {
        this.#set.delete(fn);
    }

    // [x] STRATEGY (batch<T>):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    batch<T>(fn: () => T): T {
        this.#depth++;
        try {
            return fn();
        } finally {
            this.#depth--;
            if (this.#depth === 0 && this.#pending) {
                this.#pending = false;
                this.notify();
            }
        }
    }

    // [x] STRATEGY (notify):
    //     ROLE: Internal member of enclosure/device/project.
    //     STATUS: GOOD AS-IS. Pure precomputed read or direct slot lens; complies with architectural invariants.
    notify(): void {
        if (this.#depth > 0) {
            this.#pending = true;
            return;
        }
        this.#set.forEach((fn) => fn());
    }
}

/**
 * The app's warning before unsaved changes are destroyed, as `cancel()` sees it: answers whether
 * to go ahead. Async because a dialog is — the domain waits for a person.
 */
// [x] STRATEGY (type DiscardChallenge):
//     ROLE: Domain type definition supporting schema validation and type soundness.
//     STATUS: GOOD AS-IS. Strict compile-time boundary.
export type DiscardChallenge = () => Promise<boolean>;
```
