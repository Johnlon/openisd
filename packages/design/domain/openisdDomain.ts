/* eslint-disable @typescript-eslint/no-unused-vars */

import {ProjectBuilder} from './openisdTransforms.js';
// HUMAN RULING (2026-08-26): GEOMETRY IS IN. ACOUSTICS IS OUT.
// IN: pure geometry (e.g., Vent.area_m2).
// OUT: anything involving air, compliance, resonance, or frequency. Engine handles all acoustics.
// TEST: If two implementers could disagree on the model, it belongs in the engine.
import {
    calcNumVC,
    calcVentCount,
    calcVCCon,
    calculatedWiring,
    type CoupledSealedLossesJson,
    type CoupledVentedChamberJson,
    type CoupledVentedLossesJson,
    type DriverSpecsSection,
    driverSpecsOf,
    type EnvironmentCondition,
    enteredEntry,
    calculatedEntry,
    enteredWiring,
    type OpenISDBoxJson,
    OpenISDDeviceJson,
    type DriverDeviceJson,
    type DriverSpecsJson,
    type RadiatorSpecsJson,
    type RadiatorDeviceJson,
    asDriverDevice,
    asRadiatorDevice,
    type OpenISDEnvironmentJson,
    type OpenISDProjectJson,
    type OpenISDProjectSessionJson,
    openISDProjectSessionJsonSchema,
    type PassiveRadiatorSpecsSection,
    type SealedLossesJson,
    type SpecEntryJson,
    type VentedLossesJson,
    type VentJson,
    VoiceCoilWiring,
    winningValue,
    wiringFromRecord,
} from './openisdSchema.js';
import {
    absentCell,
    calculatedCell,
    CalculatedFieldImpl,
    enteredCell,
    defaultingEntryField,
    entryField,
    DualWriteFieldImpl,
    focus,
    inputOf,
    SetOnlyFieldImpl,
    nullableField,
    pairedField,
    ReadableFieldImpl,
    DefaultingFieldImpl,
    requiredField,
    resolvingField,
    simpleField,
    writeEntryDq,
    type Calculatable,
    type Calculated,
    type Clearable,
    type Entered,
    type Precise,
    type Readable,
    type SimpleField,
    type Unsolvable,
    type Writable,
} from './cell.js';
import {newUuid} from './newUuid.js';
import {type AppContext, dateStamp, realAppContext} from './appContext.js';
import type {
    BoxParamsIssue,
    BoxType,
    CalculationIssue,
    DqIssue,
    DriverError,
    DriverIssue,
    DriverQuantityName,
    EnclosureParams,
    Filter,
    MaxCurvesResult,
    MaxCurvesSolveResult,
    OutOfRangeIssue,
    PrIssue,
    SealedAlignmentIssue,
    SignalIssue,
    SimulatableBoxType,
    SweepIssue,
    SweepParams,
    SweepResult,
    SweepSolveResult,
    VentIssue,
} from '../engine/index.js';
import {
    type Air,
    type AirConstantProvider,
    type DriverSolverParams,
    Engine,
    LossMode,
    type SolverField,
    type SolverInput,
    type Wiring
} from '../engine/index.js';
// The DEFINING modules, never `../winisd/index.js`: the barrel also re-exports these two
// converter modules, so importing it here would pull them in whichever name was asked for.
import {openIsdDriverToWinIsdDriver, winIsdDriverTextToOpenIsdDriver} from './driverYmlToOpenisdAndWdr.js';
import {openIsdProjectToWinIsdProject, winIsdProjectToOpenIsdProject} from './openIsdProjectToWinIsdProject.js';

import type {Vent, VentShape} from './vent.js';
import type {CoupledSealedLosses, CoupledVentedLosses, SealedLosses, VentedLosses,} from './losses.js';

// The domain declares its state here. JSON shapes live in `openisdSchema.ts`.
// Internal JSON types are never re-exported from `domain/index.ts`.
//
// A module-scoped WeakMap bridge (`notifyProject`/`subscribeToProject`) lets
// `ManagedProject` observe internal `OpenISDProject` changes without exposing
// state publicly.

/** WinISD's reference drive: 1 W, and the voltage a sweep runs at before anything is known. */
const DEFAULT_DRIVE_POWER_W = 1;
const DEFAULT_DRIVE_VOLTAGE_V = 1;
/** The lowest drive voltage a project may hold: 10 mV, the smallest the UI's 2 dp shows. */
const MIN_DRIVE_VOLTAGE_V = 0.01;

/** Schema-mandatory identity fields: always stated. */
type MandatoryMetaFieldName = 'brand' | 'model' | 'manufacturer';
/** Schema-optional identity fields: may be absent. */
type OptionalMetaFieldName = 'provided_by' | 'comment' | 'added';

/** The names of a driver's spec fields — the schema's own keys. */
export type DriverSpecFieldName = keyof DriverSpecsSection;

/** The names of `PassiveRadiatorSpecsSection`'s spec-entry fields. */
type PassiveRadiatorFieldName = keyof PassiveRadiatorSpecsSection;


/** The frequency grid a sweep runs over — the only thing about a sweep `OpenISDProject` does not
 *  already know about itself; everything else `SweepParams` needs comes off the project's own
 *  record. */
export interface FrequencyGrid {
    fmin?: number;
    fmax?: number;
    N?: number;
}

export interface VentedChamber {
    readonly volume_m3: Readable<number> & Entered & Writable<number>;
    readonly tuning_goal_hz: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly losses: CoupledVentedLosses;
}

export interface SealedBox {
    readonly volume_m3: SimpleField<number>;

    /** The resulting system Fc, calculated from the volume and the driver — null when either is
     *  not yet known. A CALCULATION, not a stored field, so a readout, not a handle. */
    readonly resonance_hz: Readable<number | null> & Calculated;

    /** The resulting system Q (Qtc), under the same loss mode as `resonance_hz` — null on the
     *  same terms. An ENTRY read (S10): the project's `#resolve()` cascade writes it as a
     *  calculated C/E entry via `Engine.solveSealedAlignment`, the same pattern the vent's
     *  `tuning_goal_hz`/the PR's `tuning_goal_hz` already use — not a readout recomputed on every
     *  read. */
    readonly q_tc: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;

    readonly losses: SealedLosses;
}

export interface VentedBox {
    readonly volume_m3: Readable<number> & Entered & Writable<number>;
    /** WinISD: Fb — the target frequency, which drives `vent`'s dimensions (or vice versa). */
    readonly tuning_goal_hz: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly vent: Vent;
    readonly losses: VentedLosses;
}

// Chambers and vents (ports) are two SEPARATE, sibling groupings — never one bundled into the
// other. `chambers.rear`/`chambers.front` carry ONLY volume/tuning/losses, never a vent; every
// port is a flat sibling under `vents` instead, matching the Vents tab's own three-column
// layout ("Rear chamber"/"Front chamber"/"Intrachamber").
export interface Bandpass4Box {
    readonly chambers: {
        /** rear = the chamber the driver protrudes into, SEALED — no port, so no `vents.rear`, and
         *  a read-only calculated `resonance_hz` (WinISD's "Frc") instead of a tuning to enter. */
        readonly rear: {
            readonly volume_m3: Readable<number> & Entered & Writable<number>;
            readonly resonance_hz: Readable<number | null> & Calculated;
            readonly losses: CoupledSealedLosses;
        };
        /** front = vented; its volume (`Vf`) has a Field readout like every other chamber. */
        readonly front: {
            readonly volume_m3: Readable<number> & Entered & Writable<number>;
            readonly tuning_goal_hz: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
            readonly losses: CoupledVentedLosses;
        };
    };
    readonly vents: {
        readonly front: Vent;
    };
}

/** UNLIKE bandpass4: BOTH chambers are vented and independently tunable. */
export interface Bandpass6Box {
    readonly chambers: {
        readonly rear: VentedChamber;
        readonly front: VentedChamber;
    };
    readonly vents: {
        readonly rear: Vent;
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
export interface AbcBox {
    readonly chambers: {
        readonly rear: VentedChamber;
        readonly front: VentedChamber;
    };
    readonly vents: {
        readonly rear: Vent;
        readonly front: Vent;
        readonly intra: Vent;
    };
}

export interface PassiveRadiatorBox {
    readonly volume_m3: SimpleField<number>;        // no solve relation
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

    /** WinISD's "Fs (with added mass)" — the RADIATOR'S OWN resonance carrying whatever tuning
     *  mass is on its cone, with no box in it. A different quantity from `systemTuning_hz`,
     *  which is this radiator loaded by this box's air. Null until a radiator is chosen and
     *  states the mass and compliance the resonance is made of. An OUTPUT of the solved pair
     *  (S2-7d2), entry-backed like `systemTuning_hz`. Carries the relation's DQ when the pair is
     *  inconsistent (an unreachable target). */
    readonly resonanceWithAddedMass_hz: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
}

/** The enclosure: which box type is active, and every box type's own fields. All six are
 *  present at once and dormant unless `boxType` names them — the dormant-data rule expressed in
 *  the type, rather than left to callers to honour. */
export interface Box {
    readonly boxType: SimpleField<BoxType>;
    readonly sealed: SealedBox;
    readonly vented: VentedBox;
    readonly bandpass4: Bandpass4Box;
    readonly bandpass6: Bandpass6Box;
    readonly abc: AbcBox;
    readonly passiveRadiator: PassiveRadiatorBox;
}

// ---------------------------------------------------------------------------------------------
// THE BOX WINDOW — the implementation of the shapes above, over the stored record.
// ---------------------------------------------------------------------------------------------

/** A sealed chamber's two loss factors, over its stored `SealedLossesJson` — no port, so no
 *  `Qp`; no coupling to another chamber, so no `Qicl` (BUG_20260824's live-confirmed shape). */
class SealedLossesWindow implements SealedLosses {
    readonly Ql: SimpleField<number>;
    readonly Qa: SimpleField<number>;

    constructor(lens: SimpleField<SealedLossesJson>) {
        // Each loss factor is its own `focus()` over the losses record, with no wrapper in between.
        this.Ql = focus(lens, 'Ql');
        this.Qa = focus(lens, 'Qa');
    }
}

/** A standalone vented chamber's three loss factors, over its stored `VentedLossesJson` — has a
 *  port (`Qp`), no coupling to another chamber (no `Qicl`). */
class VentedLossesWindow implements VentedLosses {
    readonly Ql: SimpleField<number>;
    readonly Qa: SimpleField<number>;
    readonly Qp: SimpleField<number>;

    constructor(lens: SimpleField<VentedLossesJson>) {
        this.Ql = focus(lens, 'Ql');
        this.Qa = focus(lens, 'Qa');
        this.Qp = focus(lens, 'Qp');
    }
}

/** A sealed chamber coupled to another (bandpass4's rear), over its stored
 *  `CoupledSealedLossesJson` — no port (no `Qp`), coupled to the other chamber (`Qicl`). */
class CoupledSealedLossesWindow implements CoupledSealedLosses {
    readonly Ql: SimpleField<number>;
    readonly Qa: SimpleField<number>;
    readonly Qicl: SimpleField<number>;

    constructor(lens: SimpleField<CoupledSealedLossesJson>) {
        this.Ql = focus(lens, 'Ql');
        this.Qa = focus(lens, 'Qa');
        this.Qicl = focus(lens, 'Qicl');
    }
}

/** A vented chamber coupled to another (bandpass4's front, bandpass6's and ABC's rear/front),
 *  over its stored `CoupledVentedLossesJson` — has a port AND a coupling, all four factors. */
class CoupledVentedLossesWindow implements CoupledVentedLosses {
    readonly Ql: SimpleField<number>;
    readonly Qa: SimpleField<number>;
    readonly Qp: SimpleField<number>;
    readonly Qicl: SimpleField<number>;

    constructor(lens: SimpleField<CoupledVentedLossesJson>) {
        this.Ql = focus(lens, 'Ql');
        this.Qa = focus(lens, 'Qa');
        this.Qp = focus(lens, 'Qp');
        this.Qicl = focus(lens, 'Qicl');
    }
}

/** A stored port count the domain will honour: a whole number of at least one port. */
function isPortCount(v: number): boolean {
    return Number.isInteger(v) && v >= 1;
}

/** One port. `area_m2` follows `shape` — a solved pair with `diameter_m` when round, with
 *  `height_m` (against the live `width_m`) when slotted — so switching shape changes which pair
 *  is active without any stored value having to be recomputed or migrated. */
class VentWindow implements Vent {
    readonly #lens: SimpleField<VentJson>;
    readonly #engine: Engine;
    /** The project's own resolved air, read at CALL time — never a reference-condition default
     *  computed inside the engine (Driver Air Constants,
     *  `docs/plans/PLAN_DRIVER_SOLVE_AND_SWEEP_DIAGNOSTICS.md`). Sourced from the owning box's
     *  embedded driver, which already resolves `c_m_per_s`/`roo_kg_per_m3` to the project's live
     *  environment unconditionally — no second air-provider plumbing needed. */
    readonly #air: () => Air;
    readonly shape: SimpleField<VentShape>;
    readonly endCorrection_m: SimpleField<number>;

    readonly diameter_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly width_m: Readable<number | null> & Entered & Writable<number> & Clearable;
    readonly height_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly length_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly count: Readable<number> & Entered & Calculated & Writable<number> & Clearable & Calculatable<number>;
    readonly area_m2: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;

    constructor(
        lens: SimpleField<VentJson>, engine: Engine, air: () => Air,
        /** A pre-built `length_m`, ATOMICALLY paired with a tuning target living OUTSIDE this
         *  vent's own record (a chamber's `tuning_goal_hz` — `vented`'s and `bandpass4.front`'s own
         *  vents have one; bandpass6/ABC's do not, so they pass none). Only the OWNER
         *  (`OpenISDBox`) can build this: it is the one place that can see both parent lenses at
         *  once, needed to write BOTH sides in a single call — two separate writes would let a
         *  resolve run in between and re-derive the sibling from a value the caller is in the
         *  middle of retracting (S2-7d2 — replaces the earlier `ventContext` bag, which fed a
         *  live read-time solve `#resolve()` now owns). */
        lengthField?: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable,
    ) {
        this.#lens = lens;
        this.#engine = engine;
        this.#air = air;
        this.shape = focus(lens, 'shape');
        this.endCorrection_m = focus(lens, 'endCorrection_m');
        this.width_m = nullableField(lens, 'width_m');
        this.length_m = lengthField ?? entryField(focus(lens, 'length_m'), 'length_m', engine);

        // Two solved pairs sharing this one record: `diameter_m` ↔ `area_m2` (round), `height_m`
        // ↔ `area_m2` (slotted, against the live `width_m`) — `#resolveVentGeometry` runs the
        // actual Math. `area_m2`'s own commit picks its sibling by the CURRENT shape; entering
        // `diameter_m`/`height_m` always clears `area_m2` unconditionally — harmless when that
        // dimension is not the active one, since geometry never consults it either.
        const diameterEntry = entryField(focus(lens, 'diameter_m'), 'diameter_m', engine);
        const heightEntry = entryField(focus(lens, 'height_m'), 'height_m', engine);
        const areaEntry = entryField(focus(lens, 'area_m2'), 'area_m2', engine);
        this.diameter_m = pairedField(
            (entry) => lens.set({ ...lens.value, diameter_m: entry, area_m2: undefined }),
            diameterEntry,
        );
        this.height_m = pairedField(
            (entry) => lens.set({ ...lens.value, height_m: entry, area_m2: undefined }),
            heightEntry,
        );
        this.area_m2 = pairedField(
            (entry) => {
                if (lens.value.shape === 'round') lens.set({ ...lens.value, area_m2: entry, diameter_m: undefined });
                else lens.set({ ...lens.value, area_m2: entry, height_m: undefined });
            },
            areaEntry,
        );

        /** Never N: an empty slot reads `calcVentCount()` as C; `OpenISDProject#resolveVentCount`
         *  stores it. */
        this.count = defaultingEntryField(focus(lens, 'count'), 'count', engine, calcVentCount);
    }

    /** The port count as a plain number. A record the resolve has not reached, or one stating a
     *  count that is not a whole number of at least one, reads as the default — REPAIRED rather
     *  than refused (John 2026-09-20). */
    #ports(): number {
        return this.count.value;
    }

    /** `count` × one port's area — plain arithmetic on geometry the domain already owns. */
    totalArea_m2(): number | null {
        const one = this.area_m2.value;
        return one === null ? null : this.#ports() * one;
    }

    /** Acoustic length — the physical length plus the end correction, which is what the sweep's
     *  port model actually resonates (`SweepParams.Leff`).
     *
     *  The end correction models how air outside the port behaves, so it is ACOUSTICS and the
     *  engine owns it. The domain supplies the port's own geometry — its length and its area, both
     *  of which it legitimately knows — and reports what comes back. */
    effectiveLength_m(): number | null {
        const length_m = this.length_m.value;
        const Sp = this.area_m2.value;
        if (length_m === null || Sp === null) return null;
        return this.#engine.ventEffectiveLength(length_m, Sp, this.#ports(), this.#lens.value.endCorrection_m);
    }

    tuningIn_hz(volume_m3: number | null): number | null {
        const length_m = this.length_m.value;
        const Sp = this.area_m2.value;
        if (volume_m3 === null || !(volume_m3 > 0) || length_m === null || Sp === null) return null;
        return this.#engine.tuningFromLength(volume_m3, length_m, Sp, this.#ports(), this.#air(), this.#lens.value.endCorrection_m);
    }

    lengthForTuning_m(volume_m3: number | null, fb_hz: number): number | null {
        const Sp = this.area_m2.value;
        if (volume_m3 === null || !(volume_m3 > 0) || !(fb_hz > 0) || Sp === null) return null;
        return this.#engine.ventLength(volume_m3, fb_hz, Sp, this.#ports(), this.#air(), this.#lens.value.endCorrection_m);
    }
}

/** A chamber with both a volume and a tuning of its own — bandpass6's and ABC's, and the shape
 *  `VentedChamber` names in `box.ts`. */
class VentedChamberWindow {
    readonly volume_m3: Readable<number> & Entered & Writable<number>;
    readonly tuning_goal_hz: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly losses: CoupledVentedLosses;

    constructor(lens: SimpleField<CoupledVentedChamberJson>, engine: Engine) {
        this.volume_m3 = requiredField(lens, 'volume_m3');
        this.tuning_goal_hz = entryField(focus(lens, 'tuning_goal_hz'), 'tuning_goal_hz', engine);
        this.losses = new CoupledVentedLossesWindow(focus(lens, 'losses'));
    }
}

/** The radiator section of `slot`'s record. */
function radiatorSection(slot: SimpleField<RadiatorDeviceJson>): SimpleField<PassiveRadiatorSpecsSection> {
    return {
        get value() { return slot.value.specs['passive-radiator']; },
        set: (section) => slot.set({...slot.value, specs: {'passive-radiator': section}}),
    };
}

/** One field of a radiator's section; a key absent from the section reads not-available. */
function prSpec(
    section: SimpleField<PassiveRadiatorSpecsSection>,
    key: PassiveRadiatorFieldName,
): Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable {
    return new DualWriteFieldImpl<number>(
        () => {
            const v = winningValue(section.value[key]);
            return v === null ? absentCell<number>('') : enteredCell<number | null>('', v);
        },
        {
            entered: (v: number) => section.set({...section.value, [key]: enteredEntry(v)}),
            clear: () => {
                const {[key]: _removed, ...rest} = section.value;
                section.set(rest);
            },
            // S2-7c/d: entry-backed — a radiator's own T/S spec is never solver-derived, only
            // entered or absent, so `calculated` has nothing real to do yet.
            calculated: () => {},
            dq: () => {},
        },
    );
}

/** A T/S field of the chosen passive radiator, out of its own `passive-radiator` spec section.
 *  Same not-chosen handling as `prMeta`, plus the section invariant `OpenISDPassiveRadiator`
 *  already guarantees: a record that reached `configurePR()` came through that class, which
 *  refuses to construct without the section, so it is present whenever a component is. */

/** The parameters required to solve passive radiator tuning and mass. */
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
 * The box reaches the driver through its PUBLIC surface (`project.driver.Fs_hz.value`), never
 * through the record — the privacy rule holds inside the module too.
 */
class OpenISDBox implements Box {
    readonly boxType: SimpleField<BoxType>;

    readonly sealed: SealedBox;
    readonly vented: VentedBox;
    readonly bandpass4: Bandpass4Box;
    readonly bandpass6: Bandpass6Box;
    readonly abc: AbcBox;
    readonly passiveRadiator: PassiveRadiatorBox;

    /** The driver this box loads, read through its PUBLIC field surface — never its record. A
     *  chamber's resonance depends on the driver, and this is the only thing the box needs it for. */
    readonly #driver: OpenISDDriverEmbedded;
    /** The one calculation surface. Injected, never constructed here. */
    readonly #engine: Engine;
    /** The project's amplifier source impedance, resolved at CALL time — the `Rg` that loads the
     *  driver's Qts the way WinISD's readout does. A PARAMETER rather than a record field for the
     *  same reason `OpenISDProject.sourceLoadedQts` treats `Rs` as one: the record hear has no
     *  home for it (it lives on the project's driverEmbedding, which the box does not own). */
    readonly #rs: () => number;
    /** The project's chosen sealed-box loss model (S10/QO130), resolved at CALL time — same
     *  reason `#rs` is a closure, not a field: `lossMode` lives on `advanced`, which the box
     *  does not own. */
    readonly #lossMode: () => LossMode;

    private constructor(
        lens: SimpleField<OpenISDBoxJson>,
        driver: OpenISDDriverEmbedded,
        engine: Engine,
        rs: () => number,
        lossMode: () => LossMode,
        issues: () => ProjectIssues,
        ventTuningExtra: () => DqIssue | null,
    ) {
        this.#driver = driver;
        this.#engine = engine;
        this.#rs = rs;
        this.#lossMode = lossMode;
        this.boxType = focus(lens, 'boxType');

        // The project's own resolved air, read at CALL time from the embedded driver — which
        // already resolves `c_m_per_s`/`roo_kg_per_m3` to the project's live environment
        // unconditionally (Driver Air Constants, `docs/plans/PLAN_DRIVER_SOLVE_AND_SWEEP_DIAGNOSTICS.md`).
        // No second air-provider plumbing needed: every vent/PR window below reads this same
        // closure rather than each computing its own reference-condition fallback.
        const air = (): Air => {
            const ts = driver.specs;
            return { rho: ts.roo_kg_per_m3.value!, c: ts.c_m_per_s.value! };
        };

        const sealedLens = focus(lens, 'sealed');
        const sealedVolume = focus(sealedLens, 'volume_m3');
        const sealedLosses = new SealedLossesWindow(focus(sealedLens, 'losses'));
        this.sealed = {
            volume_m3: sealedVolume,
            resonance_hz: new CalculatedFieldImpl<number | null>(() => {
                const v = this.#sealedResonance_hz(sealedVolume.value, sealedLosses);
                return v === null
                    ? absentCell<number>('resonance_hz')
                    : calculatedCell<number | null>('resonance_hz', v);
            }),
            q_tc: entryField(focus(sealedLens, 'Qtc'), 'q_tc', engine, () => groupDq(issues().sealed)),
            losses: sealedLosses,
        };

        const ventedLens = focus(lens, 'vented');
        const ventedChamber = focus(ventedLens, 'chamber');
        const ventedVentLens = focus(ventedLens, 'vent');
        const ventedTuningEntry = entryField(focus(ventedChamber, 'tuning_goal_hz'), 'tuning_goal_hz', engine, () => {
            const dq = groupDq(issues().vent);
            const extra = ventTuningExtra();
            return extra === null ? dq : [...dq, extra];
        });
        const ventedLengthEntry = entryField(focus(ventedVentLens, 'length_m'), 'length_m', engine, () => groupDq(issues().vent));
        const commitVentedPair = (tuning: SpecEntryJson | undefined, length: SpecEntryJson | undefined): void => {
            const cur = ventedLens.value;
            ventedLens.set({
                ...cur,
                chamber: { ...cur.chamber, tuning_goal_hz: tuning },
                vent: { ...cur.vent, length_m: length },
            });
        };
        const ventedTuningField = pairedField((entry) => commitVentedPair(entry, undefined), ventedTuningEntry);
        const ventedLengthField = pairedField((entry) => commitVentedPair(undefined, entry), ventedLengthEntry);
        const ventWindow = new VentWindow(ventedVentLens, engine, air, ventedLengthField);
        this.vented = {
            // The plausibility mark is computed at READ time, not stored: a mandatory volume field
            // has no `setDq` for a resolve to write through, and the band it is judged against is an
            // application setting the user can change under an already-open project. Reading it
            // now is what makes a Settings edit land without the record being rewritten.
            volume_m3: requiredField(ventedChamber, 'volume_m3', (v) => {
                // Only the ACTIVE box type has a design to judge. Every other box's record sits
                // at its schema default (a 0 m³ vented chamber under a sealed project), which is
                // not an implausible design — it is no design. The resolve cascade draws the
                // same line, solving the vent only for the box type in play.
                if (lens.value.boxType !== 'vented') return null;
                return engine.ventedVolumeIssue(v);
            }),
            tuning_goal_hz: ventedTuningField,
            vent: ventWindow,
            losses: new VentedLossesWindow(focus(ventedChamber, 'losses')),
        };

        const bp4 = focus(lens, 'bandpass4');
        const bp4Rear = focus(bp4, 'rear');
        const bp4RearLosses = new CoupledSealedLossesWindow(focus(bp4Rear, 'losses'));
        const bp4Front = focus(bp4, 'front');
        const bp4FrontTuningEntry = entryField(focus(bp4Front, 'tuning_goal_hz'), 'tuning_goal_hz', engine, () => groupDq(issues().vent));
        const bp4FrontVentLens = focus(bp4, 'frontVent');
        const bp4FrontLengthEntry = entryField(focus(bp4FrontVentLens, 'length_m'), 'length_m', engine, () => groupDq(issues().vent));
        const commitBp4FrontPair = (tuning: SpecEntryJson | undefined, length: SpecEntryJson | undefined): void => {
            const cur = bp4.value;
            bp4.set({
                ...cur,
                front: { ...cur.front, tuning_goal_hz: tuning },
                frontVent: { ...cur.frontVent, length_m: length },
            });
        };
        const bp4FrontTuningField = pairedField((entry) => commitBp4FrontPair(entry, undefined), bp4FrontTuningEntry);
        const bp4FrontLengthField = pairedField((entry) => commitBp4FrontPair(undefined, entry), bp4FrontLengthEntry);
        const bp4FrontVent = new VentWindow(bp4FrontVentLens, engine, air, bp4FrontLengthField);
        this.bandpass4 = {
            chambers: {
                // rear is SEALED — no port, so no `vents.rear`, and a read-only calculated
                // `resonance_hz()` (WinISD's "Frc") stands in for the tuning it cannot be given.
                rear: {
                    volume_m3: requiredField(bp4Rear, 'volume_m3'),
                    // LOSSLESS here, unlike the plain sealed box above, because that is what
                    // WinISD itself writes for a bandpass4 rear chamber. Two goldens written by
                    // the same winisd.exe 89 seconds apart with the identical driver, identical
                    // Vr=0.02 and identical Qlr/Qar, differing only in BType: sealed-small.wpr
                    // carries the LOSSY Fr=61.267…, bandpass4.wpr the LOSSLESS Fr=58.3392371416399
                    // (= Fs·√(1+Vas/Vr), matched to 13 significant figures). The rear chamber's
                    // damping is already carried by Qlr/Qar in the bandpass circuit.
                    resonance_hz: new CalculatedFieldImpl<number | null>(() => {
                        const v = this.#sealedResonance_hz(
                            focus(bp4Rear, 'volume_m3').value, bp4RearLosses, LossMode.Lossless);
                        return v === null
                            ? absentCell<number>('resonance_hz')
                            : calculatedCell<number | null>('resonance_hz', v);
                    }),
                    losses: bp4RearLosses,
                },
                // front's volume is a Field, consistent with the rear chamber.
                front: {
                    volume_m3: requiredField(bp4Front, 'volume_m3'),
                    tuning_goal_hz: bp4FrontTuningField,
                    losses: new CoupledVentedLossesWindow(focus(bp4Front, 'losses')),
                },
            },
            vents: {front: bp4FrontVent},
        };

        const bp6 = focus(lens, 'bandpass6');
        this.bandpass6 = {
            chambers: {
                rear: new VentedChamberWindow(focus(bp6, 'rear'), engine),
                front: new VentedChamberWindow(focus(bp6, 'front'), engine),
            },
            vents: {
                rear: new VentWindow(focus(bp6, 'rearVent'), engine, air),
                front: new VentWindow(focus(bp6, 'frontVent'), engine, air),
            },
        };

        const abc = focus(lens, 'abc');
        this.abc = {
            chambers: {
                rear: new VentedChamberWindow(focus(abc, 'rear'), engine),
                front: new VentedChamberWindow(focus(abc, 'front'), engine),
            },
            // Three ports, flat siblings: rear's and front's own ports to outside air, plus the
            // connecting port between the chambers — owned by neither, which is why it sits here and
            // not inside a chamber.
            vents: {
                rear: new VentWindow(focus(abc, 'rearVent'), engine, air),
                front: new VentWindow(focus(abc, 'frontVent'), engine, air),
                intra: new VentWindow(focus(abc, 'intraVent'), engine, air),
            },
        };

        const pr = focus(lens, 'passiveRadiator');
        const prSlot = focus(pr, 'component');
        const getRadiator = (): OpenISDPassiveRadiatorEmbedded => {
            return new OpenISDPassiveRadiatorEmbedded(prSlot, engine);
        };
        const prVolume = focus(pr, 'volume_m3');
        const prAddedMassEntry = entryField(focus(pr, 'addedMass_kg'), 'addedMass_kg', engine, () => groupDq(issues().pr));
        const prTuningEntry = entryField(focus(pr, 'tuning_goal_hz'), 'tuning_goal_hz', engine, () => groupDq(issues().pr));
        const prTuningField = pairedField(
            (entry) => pr.set({ ...pr.value, tuning_goal_hz: entry, addedMass_kg: undefined }),
            prTuningEntry,
        );
        const prAddedMassField = pairedField(
            (entry) => pr.set({ ...pr.value, addedMass_kg: entry, tuning_goal_hz: undefined }),
            prAddedMassEntry,
        );
        this.passiveRadiator = {
            volume_m3: prVolume,
            tuning_goal_hz: prTuningField,
            count: focus(pr, 'count'),
            addedMass_kg: prAddedMassField,
            losses: new SealedLossesWindow(focus(pr, 'losses')),
            // The embedded radiator adopts the chosen one — a radiator reading another radiator's
            // record, legal because both derive from the class that declares `slot`.
            configurePR: (chosen: OpenISDPassiveRadiatorStandalone) => {
                prSlot.set({ ...prSlot.value, ...chosen.clonePassiveRadiator() });
            },
            get radiator() {
                return getRadiator();
            },
            // OUTPUTS of the solved pair (S2-7d2): plain entry-backed slots the `solvePr` cascade
            // in `OpenISDProject#resolve()` writes as 'C' entries — never entered by a user, never
            // recomputed at read time here.
            systemTuning_hz: entryField(focus(pr, 'systemTuning_hz'), 'systemTuning_hz', engine, () => groupDq(issues().pr)),
            resonanceWithAddedMass_hz: entryField(focus(pr, 'resonanceWithAddedMass_hz'), 'resonanceWithAddedMass_hz', engine, () => groupDq(issues().pr)),
            /** A read-only WHAT-IF query, independent of the stored pair and its cascade — never
             *  writes back, so it stays a pure computation over `Engine.prMassForFp` rather than a
             *  route through the (now-deleted) bag solver. The DQ text matches
             *  `checkPrConsistency`'s own negative-mass case exactly: the only DQ this cell could
             *  ever have carried in practice (the missing-dependencies branch always paired with a
             *  null answer, which the not-available branch below already reports with no DQ to lose). */
            addedMassForTuning_kg: (fp_hz: number) => new CalculatedFieldImpl<number | null>(() => {
                const Vb = prVolume.value || this.vented.volume_m3.value;
                const r = getRadiator();
                const prMmd = r.spec.Mms_kg.value;
                const prSd = r.spec.Sd_m2.value;
                const prCms = r.spec.Cms_m_per_N.value;
                if (!(Vb != null && Vb > 0 && prMmd != null && prSd != null && prCms != null && fp_hz > 0)) {
                    return absentCell<number>('addedMassForTuning_kg');
                }
                const totalMass = this.#engine.prMassForFp({ Vb, prMmd, prMadd: 0, prSd, prCms }, fp_hz, air());
                const addedMass = totalMass - prMmd;
                const dq: DqIssue[] | undefined = addedMass < 0 ? [{
                    kind: 'target-unreachable',
                    target: 'addedMassForTuning_kg',
                    maxReachable_hz: this.#engine.prTuning({ Vb, prMmd, prMadd: 0, prSd, prCms }, air()),
                }] : undefined;
                return calculatedCell<number | null>('addedMassForTuning_kg', addedMass, dq);
            }),
        };
    }

    /** Takes the lens onto the project's `box` slot. The project owns that slot and builds the
     *  lens, so the box needs no reference back to the project. */
    static wrap(
        slot: SimpleField<OpenISDBoxJson>,
        driver: OpenISDDriverEmbedded,
        engine: Engine,
        rs: () => number,
        lossMode: () => LossMode,
        issues: () => ProjectIssues,
        ventTuningExtra: () => DqIssue | null,
    ): OpenISDBox {
        return new OpenISDBox(slot, driver, engine, rs, lossMode, issues, ventTuningExtra);
    }

    /**
     * A sealed chamber's resonance, through the INJECTED engine.
     *
     * Null whenever the driver has not stated what the feed needs, or the volume is not
     * positive — absence is `null` here as everywhere, never 0 and never a throw.
     *
     * The domain does none of the physics: it hands over the driver's SOLVED values (Fs, Vas and
     * the Q group), the volume, the chamber's losses and the project's source impedance, and the
     * engine computes the resonance.
     *
     * The FEED is parity-proven, not guessed: the engine test that matches WinISD's own sealed
     * `Box.Fr` readout bit-for-bit (`winisd-parity-functional.test.ts` "Box.Fr") passes exactly
     * the driver's stored Vas and `sourceLoadedQts(Qms, Qes, Re, Rg, Qts)` — never the inline
     * compliance reconstruction `Cms·Sd²·ρc²` and never bare `Qts` (Rg alone moves Fsc by 0.040 Hz
     * on the golden scene; `SEALED_FSC_MODEL.md` §5).
     */
    #sealedResonance_hz(volume_m3: number | null, losses: SealedLosses,
                        mode: LossMode = this.#lossMode()): number | null {
        if (volume_m3 === null || !(volume_m3 > 0)) return null;
        const ts = this.#driver.specs;
        const Fs_hz = ts.Fs_hz.value;
        const Vas = ts.Vas_m3.value;
        const Qts = ts.Qts.value;
        if (Fs_hz === null || Vas === null || Qts === null) return null;
        const QtsLoaded = this.#engine.sourceLoadedQts(
            ts.Qms.value ?? NaN, ts.Qes.value ?? NaN, ts.Re_ohm.value ?? NaN, this.#rs(), Qts);
        // The project's own chosen mode (S10/QO130) by default. WinISD displays and saves the
        // LOSSY figure by default (John 2026-08-27: "default is winisd = Lossy") and it MOVES
        // with the chamber's losses: measured, `Fr` shifts 5.8 Hz for a `Ql` change at fixed
        // volume (winisd_research FINDING-007). A caller (bandpass4's rear chamber) may still
        // override `mode` — that is WinISD's own fixed behaviour for that chamber, not the
        // project's chosen mode; see that call site's own note.
        return this.#engine.sealedResonance(mode, {
            Fs: Fs_hz, Vas, Qts: QtsLoaded, Vb: volume_m3, Ql: losses.Ql.value, Qa: losses.Qa.value,
        }).Fsc;
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
 * Building once makes the identity stable for the instance's lifetime, while `.value` still
 * reads live off `read()` every call — the closures capture `this` and dereference at CALL
 * time, never a json snapshot, which is what makes eager construction safe even though
 * `write()` REASSIGNS the record.
 */
/**
 * A `SolverField` for a `DriverSolverParams` quantity the domain has no storage slot for
 * (`SPLref_dB`, `Re_terminal_ohm`, `BL_terminal_Tm` — none of the three ever appeared in the
 * bag `solvedNow()` built either, before S2-7c; this carries the same gap forward honestly
 * rather than inventing storage for it here). Always not-available; any write is silently
 * discarded — frozen and shared, since it holds no per-call state. */
const NO_SLOT: SolverField = Object.freeze({
    value: null,
    entered: false,
    calculated: false,
    precision: null,
    dq: Object.freeze([]),
    setCalculated: () => {},
    setDq: () => {},
    setNotAvailable: () => {},
});

/** Every `DriverQuantityName`, exactly once — the field list `projectFormulaDq` clears before
 *  applying `resolve()`'s own issues (S2-7d2). Named here, once, in a form the compiler checks
 *  (`satisfies`, not a cast) rather than read back off `params` via `Object.keys`, which answers
 *  `string[]` regardless of what the object's own type declares. */
const DRIVER_QUANTITY_NAMES = [
    'Fs_hz', 'Re_ohm', 'Znom_ohm', 'Le_H', 'fLe_hz', 'KLe_H_sqrtHz', 'Qes', 'Qms', 'Qts', 'Vas_m3',
    'Sd_m2', 'Dd_m', 'BL_Tm', 'Mms_kg', 'Cms_m_per_N', 'Rms_kg_per_s', 'EBP_hz', 'Xmax_m', 'Vd_m3',
    'Hc_m', 'Hg_m', 'Pe_W', 'no', 'SPLref_dB', 'SPL_dB', 'USPL_dB', 'SPLmax_dB', 'SPLmaxLF_dB',
    'Rme_kg_per_s', 'Mpow_N_per_sqrtW', 'Mcost_kg_per_s', 'gamma_m_per_s2_A', 'Gloss', 'Vcd_m',
    'Depth_m', 'MagDepth_m', 'Magnet_m', 'DVol_m3', 'c_m_per_s', 'roo_kg_per_m3',
    'Re_terminal_ohm', 'BL_terminal_Tm', 'numVC', 'wiring',
] as const satisfies readonly DriverQuantityName[];
// Completeness, not merely validity: a `DriverQuantityName` missing from the list above fails to
// compile here and the error NAMES it, rather than `projectFormulaDq` silently never clearing it.
type _MissingFromDriverQuantityNames = Exclude<DriverQuantityName, typeof DRIVER_QUANTITY_NAMES[number]>;
type _AssertDriverQuantityNamesComplete = _MissingFromDriverQuantityNames extends never ? true : never;
const _assertDriverQuantityNamesComplete: _AssertDriverQuantityNamesComplete = true;
void _assertDriverQuantityNamesComplete;

/** One spec section of `record`. An absent tweeter section reads empty and is created on write. */
function driverSection(record: SimpleField<DriverDeviceJson>, section: 'woofer' | 'tweeter'): SimpleField<DriverSpecsSection> {
    return {
        get value() { return record.value.specs[section] ?? {}; },
        set: (next) => record.set({...record.value, specs: {...record.value.specs, [section]: next}}),
    };
}

/**
 * Window onto a single `DriverSpecsSection` of a driver record.
 *
 * Field names carry their unit suffix (e.g. `Fs_hz`, `Rms_kg_per_s`) to report the stored SI unit.
 * Dimensionless parameters (`Qts`, `Qes`, etc.) have no suffix.
 *
 * Fields are constructed eagerly to preserve object identity for reactivity.
 */
export class OpenIsdDriverSpec {
    // Thiele/Small.
    readonly Fs_hz: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Re_ohm: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Le_H: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly fLe_hz: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    /** `Le·√(2π·fLe)` — the Vanderkooy lossy-inductance coefficient (`WINISD_PARITY.md:1009`,
     *  `GHIDRA_FINDINGS.md:1039`). Henries times the square root of hertz; not dimensionless. */
    readonly KLe_H_sqrtHz: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Znom_ohm: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Qts: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Qes: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Qms: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Vas_m3: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Sd_m2: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly BL_Tm: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Mms_kg: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Cms_m_per_N: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Rms_kg_per_s: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Xmax_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Xlim_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly SPL_dB: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Pe_W: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Dd_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly EBP_hz: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    /** How many voice coils. Entry-backed like every numeric field beside it: `null` only
     *  before the first `resolve()`, which stores `calcNumVC()`'s default as a 'C' entry. */
    readonly numVC: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    /** How the coils are wired. A NAME, not WinISD's 1/2 — see `VoiceCoilWiring`. Entry-backed
     *  like every numeric field beside it: `null` only before the first `resolve()`, which
     *  stores `calcVCCon()`'s default as a 'C' entry. */
    readonly VCCon: Readable<VoiceCoilWiring | null> & Entered & Calculated & Writable<VoiceCoilWiring> & Clearable & Calculatable<VoiceCoilWiring> & Unsolvable;
    // Ordinarily derived, but WinISD lets a human type any of them, and an entered value is a fact.
    readonly Dia_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Vd_m3: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly no: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly SPLmax_dB: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly SPLmaxLF_dB: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly USPL_dB: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly alfaVC_per_K: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Rt_K_per_W: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Ct_J_per_K: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    /** `Bxl/Mms` — the acceleration factor, acceleration per ampere. NOT dimensionless: WinISD's
     *  own UI prints `N/(A*kg)`, which is the same dimension as cfuttrup's `m/(s²·A)`. */
    readonly gamma_m_per_s2_A: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Rme_kg_per_s: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    /** `Bxl/√Re` — the motor power factor, newtons per square-root watt. */
    readonly Mpow_N_per_sqrtW: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    /** `Rme·(1 + Xmax/min(Hc, Hg))` — the motor COST factor: how powerful the motor is, penalised
     *  by how far the coil is overhung or underhung. It IS meant as an indicator of what the driver
     *  costs to build, but the unit is not currency — the ratio is dimensionless, so the figure
     *  carries `Rme`'s kg/s. WinISD's own help: "an indicator on the price of the driver, but
     *  please forget about the unit". (Formula decompiled and reproduced exactly on 10 live WinISD
     *  runs: `winisd_research/GHIDRA_FINDINGS.md` §"Four advanced-panel formulas".) */
    readonly Mcost_kg_per_s: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Gloss: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    /** The air THIS DRIVER states — the conditions its own figures were measured or computed at.
     *  Not the environment a simulation runs on; `OpenISDEnvironment` on the project is that. */
    readonly c_m_per_s: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly roo_kg_per_m3: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    // Descriptive and dimensional.
    readonly Vcd_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Hg_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Hc_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly freq_low_hz: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly freq_high_hz: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly power_peak_W: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly weight_kg: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Thick_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Depth_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly MagDepth_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Magnet_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Basket_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Outer_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly OuterX_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly OuterY_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly DVol_m3: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;

    readonly #engine: Engine;
    #issues: readonly DriverIssue[] = [];

    constructor(
        record: SimpleField<DriverDeviceJson>,
        section: 'woofer' | 'tweeter',
        engine: Engine,
        /** The driver's air: what a not-entered `c_m_per_s`/`roo_kg_per_m3` reads as. */
        air: () => Air,
        /** Where a field's dq is read from when THIS spec object cannot be relied on to still
         *  exist between the resolve that produced it and the read that wants it — the project's
         *  embedded driver, rebuilt fresh on every access, which discards `entryField`'s own
         *  closure along with the instance. Omitted by a standalone driver, which is a single
         *  durable instance and keeps its own. Same rule, and same reason, as the vent/PR groups
         *  (`entryField`'s `issuesSource`). */
        durableIssues?: () => readonly DriverIssue[],
    ) {
        this.#engine = engine;

        /** One `SpecEntryJson` slot inside this section — deletes the key when set to `undefined`
         *  (T11: absence is 'N', not a stored null). */
        const sectionLens = driverSection(record, section);
        const sectionSlot = (key: keyof DriverSpecsSection): SimpleField<SpecEntryJson | undefined> => ({
            get value() { return sectionLens.value[key]; },
            set: (v) => {
                const spec = sectionLens.value;
                const {[key]: _removed, ...rest} = spec;
                sectionLens.set(v === undefined ? rest : {...spec, [key]: v});
            },
        });

        /** Every numeric spec field, entry-backed (T11/S2-7c): the record itself holds the
         *  derived value once `resolve()` has run — no live recompute at read time, no
         *  `solvedNow` bag kept beside the record. `entryField` alone reports absent/entered/
         *  calculated straight off what is actually stored. */
        /** The issues `key` is named by, out of a durable list — the same split `projectFormulaDq`
         *  makes: a `field`-carrying issue names one field, everything else names whatever
         *  `issueFields` says. */
        const dqFor = (key: keyof DriverSpecsSection): (() => readonly DqIssue[]) | undefined =>
            durableIssues === undefined ? undefined : () => durableIssues().filter(issue =>
                'field' in issue ? issue.field === key : engine.issueFields(issue).some(f => f === key));
        const f = (key: keyof DriverSpecsSection): Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable => entryField(sectionSlot(key), key, engine, dqFor(key));

        /** The wiring field — `entryField` in every respect but the value's type, which is a
         *  NAME rather than one of `DriverSpecsSection`'s numbers, so it cannot go through `f()`
         *  and states the record's 1/2 encoding through `wiringFromRecord`/`enteredWiring`/
         *  `calculatedWiring` instead.
         *
         *  `calcVCCon()` is NOT read here: `resolve()` writes the default into the record as a
         *  'C' entry and this reads what is stored, like every other quantity (John, 2026-09-24:
         *  "simply no reason for these exceptions to the rule" — replacing the S2-3 read-time
         *  fallback, which left a saved driver silent about its wiring). A number the encoding
         *  does not define reads as absence, the same as a missing key. */
        const wiringSlot = sectionSlot('VCCon');
        let wiringDq: readonly DqIssue[] = [];
        this.VCCon = new DualWriteFieldImpl<VoiceCoilWiring>(
            () => {
                const entry = wiringSlot.value;
                if (entry === undefined) return absentCell<VoiceCoilWiring>('VCCon', wiringDq);
                const wiring = wiringFromRecord(winningValue(entry));
                if (wiring === null) return absentCell<VoiceCoilWiring>('VCCon', wiringDq);
                return entry.state === 'E'
                    ? enteredCell<VoiceCoilWiring | null>('VCCon', wiring, wiringDq)
                    : calculatedCell<VoiceCoilWiring | null>('VCCon', wiring, wiringDq);
            },
            {
                entered: (v: VoiceCoilWiring) => { wiringDq = []; wiringSlot.set(enteredWiring(v)); },
                calculated: (v: VoiceCoilWiring) => { wiringDq = []; wiringSlot.set(calculatedWiring(v)); },
                clear: () => { wiringDq = []; wiringSlot.set(undefined); },
                dq: (list) => { wiringDq = list; writeEntryDq(wiringSlot, list, engine); },
            },
        );

        this.numVC = f('numVC');
        this.Fs_hz = f('Fs_hz'); this.Re_ohm = f('Re_ohm'); this.Le_H = f('Le_H'); this.fLe_hz = f('fLe_hz');
        this.KLe_H_sqrtHz = f('KLe_H_sqrtHz'); this.Znom_ohm = f('Znom_ohm'); this.Qts = f('Qts');
        this.Qes = f('Qes'); this.Qms = f('Qms'); this.Vas_m3 = f('Vas_m3'); this.Sd_m2 = f('Sd_m2');
        this.BL_Tm = f('BL_Tm'); this.Mms_kg = f('Mms_kg'); this.Cms_m_per_N = f('Cms_m_per_N');
        this.Rms_kg_per_s = f('Rms_kg_per_s'); this.Xmax_m = f('Xmax_m'); this.Xlim_m = f('Xlim_m');
        this.SPL_dB = f('SPL_dB'); this.Pe_W = f('Pe_W'); this.Dd_m = f('Dd_m'); this.EBP_hz = f('EBP_hz');
        this.Dia_m = f('Dia_m'); this.Vd_m3 = f('Vd_m3'); this.no = f('no'); this.SPLmax_dB = f('SPLmax_dB');
        this.SPLmaxLF_dB = f('SPLmaxLF_dB'); this.USPL_dB = f('USPL_dB'); this.alfaVC_per_K = f('alfaVC_per_K');
        this.Rt_K_per_W = f('Rt_K_per_W'); this.Ct_J_per_K = f('Ct_J_per_K');
        this.gamma_m_per_s2_A = f('gamma_m_per_s2_A'); this.Rme_kg_per_s = f('Rme_kg_per_s');
        this.Mpow_N_per_sqrtW = f('Mpow_N_per_sqrtW'); this.Mcost_kg_per_s = f('Mcost_kg_per_s');
        this.Gloss = f('Gloss');
        // The air THIS DRIVER states, entry-backed like every other quantity: a not-entered
        // c_m_per_s/roo_kg_per_m3 no longer needs a live read-time fallback — `resolve()`'s own
        // working set defaults it to the driver's `air` and writes the default back as `'C'`
        // (engine `consistency.ts#solveDriver`), so the record always carries a real value by
        // the time anything outside this constructor can read it.
        this.c_m_per_s = f('c_m_per_s'); this.roo_kg_per_m3 = f('roo_kg_per_m3');
        this.Vcd_m = f('Vcd_m'); this.Hg_m = f('Hg_m'); this.Hc_m = f('Hc_m');
        this.freq_low_hz = f('freq_low_hz'); this.freq_high_hz = f('freq_high_hz');
        this.power_peak_W = f('power_peak_W'); this.weight_kg = f('weight_kg'); this.Thick_m = f('Thick_m');
        this.Depth_m = f('Depth_m'); this.MagDepth_m = f('MagDepth_m'); this.Magnet_m = f('Magnet_m');
        this.Basket_m = f('Basket_m'); this.Outer_m = f('Outer_m'); this.OuterX_m = f('OuterX_m');
        this.OuterY_m = f('OuterY_m'); this.DVol_m3 = f('DVol_m3');
    }

    /** T11: every driver quantity `solveDriver` can derive is written back into the record as a
     *  `'C'` entry — the record is a CACHE the solver keeps current, never a value computed
     *  fresh at read time and left unstored (supersedes the earlier QO127 "stated-only, nothing
     *  writes back" framing). Runs the engine over this window's own 44 handles, caches the
     *  issues, and returns them; `air` is the driver's own resolved `{ rho, c }`. */
    resolve(air: Air): readonly DriverIssue[] {
        // The wiring's WinISD default, written into the record as a 'C' entry before the solve
        // reads it — the same route `c_m_per_s` takes, so a saved driver states its wiring
        // rather than leaving every reader to reapply the app's default (John, 2026-09-24).
        // Idempotent: a record that already states a wiring, entered or calculated, is left alone.
        if (!this.VCCon.entered && this.VCCon.value === null) this.VCCon.setCalculated(calcVCCon());
        // The coil count's WinISD default (1), stored the same way and for the same reason: no
        // relation in `solveDriver` derives a numVC — `terminalRe_ohm`/`terminalBL_Tm` read it and
        // never write one back — so the default is stamped here or the record stays silent.
        if (!this.numVC.entered && this.numVC.value === null) this.numVC.setCalculated(calcNumVC());
        const params = {
            Fs_hz: this.Fs_hz, Re_ohm: this.Re_ohm, Znom_ohm: this.Znom_ohm, Le_H: this.Le_H,
            fLe_hz: this.fLe_hz, KLe_H_sqrtHz: this.KLe_H_sqrtHz, Qes: this.Qes, Qms: this.Qms,
            Qts: this.Qts, Vas_m3: this.Vas_m3, Sd_m2: this.Sd_m2, Dd_m: this.Dd_m, BL_Tm: this.BL_Tm,
            Mms_kg: this.Mms_kg, Cms_m_per_N: this.Cms_m_per_N, Rms_kg_per_s: this.Rms_kg_per_s,
            EBP_hz: this.EBP_hz, Xmax_m: this.Xmax_m, Vd_m3: this.Vd_m3, Hc_m: this.Hc_m, Hg_m: this.Hg_m,
            Pe_W: this.Pe_W, no: this.no, SPLref_dB: NO_SLOT, SPL_dB: this.SPL_dB,
            USPL_dB: this.USPL_dB, SPLmax_dB: this.SPLmax_dB, SPLmaxLF_dB: this.SPLmaxLF_dB,
            Rme_kg_per_s: this.Rme_kg_per_s, Mpow_N_per_sqrtW: this.Mpow_N_per_sqrtW,
            Mcost_kg_per_s: this.Mcost_kg_per_s, gamma_m_per_s2_A: this.gamma_m_per_s2_A, Gloss: this.Gloss,
            Vcd_m: this.Vcd_m, Depth_m: this.Depth_m, MagDepth_m: this.MagDepth_m, Magnet_m: this.Magnet_m,
            DVol_m3: this.DVol_m3, c_m_per_s: this.c_m_per_s, roo_kg_per_m3: this.roo_kg_per_m3,
            Re_terminal_ohm: NO_SLOT, BL_terminal_Tm: NO_SLOT, numVC: this.numVC,
            wiring: this.VCCon,
        } satisfies DriverSolverParams;
        this.#issues = this.#engine.solveDriver(params, air);
        projectFormulaDq<DriverQuantityName>(DRIVER_QUANTITY_NAMES, params, this.#issues, this.#engine);
        return this.#issues;
    }

    /** The issues the last `resolve()` produced — empty before the first one has run. */
    issues(): readonly DriverIssue[] {
        return this.#issues;
    }
}

const discardWrite = (): void => {};

/** A `SolverField` reporting a freshly COMPUTED value with no storage behind it — sibling to
 *  `NO_SLOT`, but for a quantity `sweep()` genuinely needs a real number for (the terminal
 *  Re/BL), unlike `SPLref_dB`, which stays permanently not-available. Any write is silently
 *  discarded: nothing persists a value neither `solveDriver()`'s own resolve nor the domain has
 *  a slot for (S2-10) — `driverSolverParamsOf` below recomputes it fresh on every call, the same
 *  as the bag `solveConsistencyGroup()` used to. */
function computedSlot<T>(value: T | null): SolverField<T> {
    return {
        value, entered: false, calculated: value != null, precision: null,
        dq: [],
        setCalculated: discardWrite, setDq: discardWrite, setNotAvailable: discardWrite,
    };
}

/** `spec`'s 44 handles, shaped as `DriverSolverParams` for `Engine.sweep()`/`maxCurves()`
 *  (S2-10 ruling: "`OpenIsdDriverSpec` structurally satisfies `DriverSolverParams`") — true for
 *  40 of the 44 by name; the other four are ADAPTED, not merely reused: `SPLref_dB`/
 *  `Re_terminal_ohm`/`BL_terminal_Tm` have no domain storage slot (matching `NO_SLOT`'s own doc
 *  above), and `wiring` is spelled `VCCon` here and carries a `VoiceCoilWiring` enum member, not
 *  the bare `'series'|'parallel'` union `DriverSolverParams` names. */
function driverSolverParamsOf(spec: OpenIsdDriverSpec, engine: Engine): DriverSolverParams {
    const wiring: Wiring = spec.VCCon.value === VoiceCoilWiring.Series ? 'series' : 'parallel';
    const Re_ohm = spec.Re_ohm.value;
    const BL_Tm = spec.BL_Tm.value;
    // A resolved record always states a coil count — `resolve()` stores `calcNumVC()`'s default
    // as a 'C' entry — so null reaches here only from an unresolved one, and
    // `terminalRe_ohm`/`terminalBL_Tm` apply the same default to `undefined` themselves.
    const numVC = spec.numVC.value ?? undefined;
    // `wiring` is a `SolverInput`: the solve reads it and never writes it, so the slot carries
    // no write members at all — not even discarding ones.
    const wiringInput: SolverInput<Wiring> = { value: wiring, entered: spec.VCCon.entered };
    return {
        ...spec,
        SPLref_dB: NO_SLOT,
        Re_terminal_ohm: computedSlot(Re_ohm == null ? null : engine.terminalRe_ohm(Re_ohm, numVC, wiring)),
        BL_terminal_Tm: computedSlot(BL_Tm == null ? null : engine.terminalBL_Tm(BL_Tm, numVC, wiring)),
        wiring: wiringInput,
    };
}

/**
 * A device record stating NOTHING but its own bookkeeping and its provenance — what `empty()`
 * hands an editor.
 *
 * Every spec section is absent, so each field reads `not-available` and the editor's own
 * "not entered" rendering is what the user sees. The bookkeeping fields cannot be absent: the
 * conformance guard requires them, so a record without them is not a record and could never be
 * saved. They are minted the way a `.wdr` import mints them (`openisdSchema.ts`
 * `wdrToOpenIsdRecord`), which faces the same problem — a record with no source document
 * behind it.
 *
 * `added` and `provided_by` are the one exception to "nothing but bookkeeping": a freshly
 * created device DOES have a creation date and, when the platform user is known, a creator —
 * facts about this act of creation, not about the device's physical spec.
 */
function blankDeviceRecord<S extends DriverSpecsJson | RadiatorSpecsJson>(
    specs: S, section: 'woofer' | 'passive-radiator', appContext: AppContext,
): Omit<OpenISDDeviceJson, 'specs'> & {specs: S} {
    const platformUser = appContext.platformUser();
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
        data_sources: {value: {}},
        driver_type: {value: section},
        // No document to name — `openisd`, the pipeline's own role, exactly as the `.wdr`
        // import uses it for the same reason.
        authoritative: {value: 'openisd'},
        specs,
        added: {value: dateStamp(appContext.now()), origin: 'entered'},
        // Omitted, not `''`, when nobody is known — `#buildMeta` reads a missing key as absent.
        ...(platformUser !== null ? {provided_by: {value: platformUser, origin: 'entered'}} : {}),
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
    #slot: SimpleField<OpenISDDeviceJson>;

    /** The one calculation surface. INJECTED, exactly as `OpenISDProject`'s is — a device reports
     *  derived figures, and every one of them comes from here and nowhere else. */
    protected readonly engine: Engine;

    readonly brand: Readable<string> & Entered & Writable<string>;
    readonly model: Readable<string> & Entered & Writable<string>;
    readonly manufacturer: Readable<string> & Entered & Writable<string>;
    readonly providedBy: Readable<string | null> & Entered & Writable<string>;
    readonly comment: Readable<string | null> & Entered & Writable<string>;
    readonly added: Readable<string | null> & Entered & Writable<string>;

    protected constructor(slot: SimpleField<OpenISDDeviceJson>, engine: Engine) {
        this.#slot = slot;
        this.engine = engine;
        this.brand = this.#buildMandatoryMeta('brand');
        this.model = this.#buildMandatoryMeta('model');
        this.manufacturer = this.#buildMandatoryMeta('manufacturer');
        this.providedBy = this.#buildOptionalMeta('provided_by');
        this.comment = this.#buildOptionalMeta('comment');
        this.added = this.#buildOptionalMeta('added');
    }

    /** The catalogue URL recorded for one source role — datasheet, product page, listing page —
     *  or null when the record carries none. The pickers show these as row and preview links,
     *  and the bundled index carries them; a URL is provenance, not a device parameter, so it is
     *  read here rather than off `spec`. */
    dataSource(role: 'manufacturer_datasheet' | 'manufacturer_product_page' | 'manufacturer_listing_page'): string | null {
        return this.#slot.value.data_sources.value[role] ?? null;
    }

    #buildMandatoryMeta(key: MandatoryMetaFieldName): Readable<string> & Entered & Writable<string> {
        return new SetOnlyFieldImpl<string>(
            () => enteredCell('', this.#slot.value[key].value),
            {
                entered: (v: string) => this.#slot.set({...this.#slot.value, [key]: {value: v, origin: 'entered'}}),
            },
        );
    }

    #buildOptionalMeta(key: OptionalMetaFieldName): Readable<string | null> & Entered & Writable<string> {
        return new SetOnlyFieldImpl<string, string | null>(
            () => {
                const stated = this.#slot.value[key];
                return stated === undefined
                    ? absentCell<string>('')
                    : enteredCell<string | null>('', stated.value);
            },
            {
                entered: (v: string) => this.#slot.set({...this.#slot.value, [key]: {value: v, origin: 'entered'}}),
            },
        );
    }
}

const NOT_A_DRIVER = 'no woofer section — this record is a passive radiator, nothing to simulate';

export abstract class OpenISDDriver extends OpenISDDevice {
    static fromConformingRecord(record: unknown, engine: Engine): OpenISDDriver | string[] {
        const conformed = OpenISDDeviceJson.fromConformingRecord(record);
        if ('problems' in conformed) return conformed.problems;

        const driver = asDriverDevice(conformed.json);
        if (driver === null) return [NOT_A_DRIVER];
        return OpenISDDriverStandalone.wrap(driver, engine);
    }

    /** A driver stating nothing — what the editor opens on "create a new driver from scratch".
     *  Every spec field reads `not-available`, so the editor renders it blank and the consistency
     *  solver has nothing to work from until the user types. No conformance check: this record is
     *  minted here, not received from outside, so there is no untrusted input to refuse. */
    static empty(engine: Engine, appContext: AppContext = realAppContext): OpenISDDriver {
        return OpenISDDriverStandalone.wrap(blankDeviceRecord({woofer: {}}, 'woofer', appContext), engine);
    }

    /** `.owdr` text — openisd driver JSON — back to a driver, or the reasons it could not be
     *  read. The inverse of `toOwdrText()`. */
    static fromOwdrText(text: string, engine: Engine): OpenISDDriver | string[] {
        const parsed = OpenISDDeviceJson.fromOpenisdDriverJson(text);
        if ('problems' in parsed) return parsed.problems;

        const driver = asDriverDevice(parsed.json);
        if (driver === null) return [NOT_A_DRIVER];
        return OpenISDDriverStandalone.wrap(driver, engine);
    }

    /** This driver's spec fields — the woofer section. Driver math is woofer-only in OpenISD; a
     *  coaxial's tweeter section stays in the record but has no handle. `OpenIsdDriverSpec`
     *  structurally satisfies `DriverSolverParams` (44 `Field`s + `wiring`). */
    readonly specs: OpenIsdDriverSpec;

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
    driverType(): string {
        return this.record.value.driver_type.value;
    }

    /** A driver's record is never absent, so this stays non-null for everything below. */
    protected readonly record: SimpleField<DriverDeviceJson>;

    /** The air THIS driver falls back to when it states no `c`/`roo` of its own — an embedded
     *  driver's is the project's own live environment (`OpenISDDriverEmbedded.wrap()`); a
     *  standalone driver's defaults to the reference condition. `resolve()` reads it fresh on
     *  every call, so a project's environment changing is picked up the next time it runs. */
    protected readonly airProvider: () => AirConstantProvider;

    protected constructor(
        record: SimpleField<DriverDeviceJson>,
        engine: Engine,
        airProvider: () => AirConstantProvider,
        /** See `OpenIsdDriverSpec`'s own parameter — only an embedded driver supplies one. */
        durableIssues?: () => readonly DriverIssue[],
    ) {
        super(record, engine);
        this.record = record;
        this.airProvider = airProvider;
        const air = (): Air => engine.solveEnvironment(airProvider()).values;
        this.specs = new OpenIsdDriverSpec(record, 'woofer', engine, air, durableIssues);
    }

    /** T11/S2-7c: resolve this driver's spec — write every derivable quantity back
     *  into the record as a `'C'` entry, cache the issues, and return them. */
    resolve(): readonly DriverIssue[] {
        return this.specs.resolve(this.engine.solveEnvironment(this.airProvider()).values);
    }

    // ── DERIVED FIGURES — every one from the injected engine, none computed here ──────────────

    /** `ts`, shaped as `DriverSolverParams` — for a caller (the UI's chart layer, `Design.driver`)
     *  that needs the full 44-handle surface `Engine.sweep()`/`maxCurves()` take, not just the
     *  live spec window. See `driverSolverParamsOf`'s own doc for which four members are adapted
     *  rather than reused. */
    get solverParams(): DriverSolverParams {
        return driverSolverParamsOf(this.specs, this.engine);
    }

    /** Everything this driver's stated values disagree about — an over-specified driver whose
     *  numbers cannot all be true at once — or cannot yet derive, because too few of a group
     *  (e.g. Qts's Qes/Qms pair) are stated. Empty when consistent and fully solvable.
     *
     *  T11/S2-7c: the cached result of the last `resolve()` — entered-only by construction,
     *  since `resolve()`'s own working set feeds the engine only entered values (never a
     *  calculated one fed back as if it had been typed, or the group could never be reported as
     *  inconsistent no matter how wrong the user's OWN numbers are). */
    issues(): readonly DriverIssue[] {
        return this.specs.issues();
    }

    /** Voice-coil inductance, as the record states it. Not a solver quantity — nothing derives it
     *  — so it travels to `sweep` on its own, for the impedance plot alone. */
    Le_H(): number | null {
        return winningValue(driverSpecsOf(this.record.value)?.woofer?.Le_H);
    }

    /** An INDEPENDENT driver carrying this one's current values — and, with `update()`, the whole
     *  of how an editor works: take a copy, let the user edit THAT, and on OK write it back with
     *  `update()`; on Cancel simply drop it. The original never sees an intermediate value, so
     *  Cancel needs no layer, no session object and no adapter, and the same code serves an
     *  embedded driver and a standalone one alike — which is what a generic editor wants. What makes "Save to My Drivers",
     *  "edit a bundle entry" and "fork this entry" possible without any of them reaching into the
     *  storage this window points at. Always STANDALONE — a copy belongs to nothing until
     *  something adopts it (via `OpenISDDriverEmbedded.update()`, or a repo save). */
    detach(): OpenISDDriverStandalone {
        return OpenISDDriverStandalone.wrap(structuredClone(this.record.value), this.engine);
    }

    /** An independent standalone copy with a new record identity. Used when a driver crosses into
     * a new owner, such as a project embedding or an explicit user copy. */
    copyAsNew(): OpenISDDriver {
        const copy = this.cloneDriver();
        copy.uuid = { value: newUuid() };
        return OpenISDDriverStandalone.wrap(copy, this.engine);
    }

    /** @internal The record a save writes, deep-cloned. Same seam as
     *  `OpenISDProject.cloneProject()` — the persistence layer's one way to reach the raw record
     *  it stores, never field by field. Clones before handing it out, so the caller can store or
     *  hand the result elsewhere without aliasing this driver's own live record — a shallow
     *  `{...}` spread is not enough, since every nested field object (`brand`, `driver_type`,
     *  `specs.woofer.Fs`, …) would still be the same reference as the live record. */
    cloneDriver(): DriverDeviceJson {
        return structuredClone(this.record.value);
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
    update(source: OpenISDDriver): void {
        this.record.set(structuredClone(source.record.value));
    }

    /** Make this driver a copy: its `model` states so, so `<brand>/<model>` differs from the
     *  driver it was copied from and the two stand side by side rather than one replacing the
     *  other. Called on a detached copy, before it is saved; a copy is a new record identity. */
    renameToCopy(): void {
        this.model.set('Copy of ' + this.model.value);
        const copy = this.cloneDriver();
        copy.uuid = { value: newUuid() };
        this.record.set(copy);
    }

    /** The stable identity carried by the canonical driver record. */
    uuid(): string {
        return this.record.value.uuid.value;
    }

    /** The product series this driver belongs to (e.g. "Reference Series"), or null. Descriptive
     *  only — the picker's preview text, never a simulated quantity. Null when the record omits
     *  it. */
    get series(): Readable<string | null> {
        return new ReadableFieldImpl<string | null>(() => {
            const v = this.record.value.series?.value ?? null;
            return v === null ? absentCell<string>('series') : enteredCell<string | null>('series', v);
        });
    }

    /** The manufacturer's own part number — scraper-derived for a bundled record, editor-entered
     *  for a My Driver. `sku` is `derivedFieldOf(z.string())` — schema-guaranteed, `.value`
     *  typed `string`, never null, unlike `series`/`description`, and with no "not entered"
     *  state to clear to: emptying it is `set('')`, the same as `brand`/`model`. */
    get sku(): Readable<string> & Entered & Writable<string> {
        return new SetOnlyFieldImpl<string>(
            () => enteredCell('sku', this.record.value.sku.value),
            {
                entered: (v: string) => {
                    this.record.set({...this.record.value, sku: {value: v, grounds: [{origin: 'manual', reading: v}]}});
                },
            },
        );
    }

    /** Free-text description from the datasheet, or null. Preview text only. */
    get description(): Readable<string | null> {
        return new ReadableFieldImpl<string | null>(() => {
            const v = this.record.value.description?.value ?? null;
            return v === null ? absentCell<string>('description') : enteredCell<string | null>('description', v);
        });
    }

    toOpenIsdDeviceJson(): DriverDeviceJson {
        return this.record.value;
    }

    /** This driver as `.owdr` text — openisd driver JSON, the form `OpenISDDriver.fromOwdrText` reads
     *  back. The serialisation stays inside the domain so the record type never crosses the
     *  package boundary. */
    toOwdrText(): string {
        return OpenISDDeviceJson.toOpenisdDriverJson(this.record.value);
    }

    /** This driver as WinISD `.wdr` text — the form `OpenISDDriver.fromWdrIniText` reads back.
     *
     *  `.wdr` states far less than an openisd record does: a field WinISD has no key for is
     *  dropped, so this is a lossy write and the round trip is not an identity. `errors` carries
     *  every such loss the converter reported. */
    toWdrIniText(engine: Engine): { value: string | null; errors: DriverError[] } {
        const errors: DriverError[] = [];
        const wdr = openIsdDriverToWinIsdDriver(this, errors);
        return {value: wdr.toWdrIni(), errors};
    }

    /** WinISD `.wdr` text back to a driver. The inverse of `toWdrIniText()`, as far as a format
     *  carrying fewer fields allows. */
    static fromWdrIniText(text: string, engine: Engine): { value: OpenISDDriver | null; errors: DriverError[] } {
        return winIsdDriverTextToOpenIsdDriver(text, engine);
    }
}

/** A driver that belongs to no project — a My Drivers entry, a bundle row, a detached copy.
 *  `wrap()` windows onto a record the caller owns; the record is not copied, it is referenced.
 *
 *  `export`ed for `openisdTransforms.ts` (`conformingRecordToOpenIsdDriver` calls `wrap()`);
 *  `domain/index.ts` does not re-export it, so no consumer outside `packages/design` sees it. */
export class OpenISDDriverStandalone extends OpenISDDriver {
    /** ON: every write derives, as `resolve()` always did before this flag existed. OFF: a
     *  write still lands (`entered`/`clear` on the record), but `resolve()` stops deriving —
     *  every field, entered or calculated, stays frozen at whatever it currently reads, so
     *  clearing one no longer pulls another back in behind it. The driver editor's own setting
     *  (John, 2026-09-24): nothing else in the app calls `setAutoCalculate`. */
    #autoCalculate = true;

    get autoCalculate(): boolean {
        return this.#autoCalculate;
    }

    /** Flipping ON resolves immediately, catching up on every write made while OFF in one pass —
     *  the same as re-ticking WinISD's own checkbox. Flipping OFF makes no write of its own: the
     *  fields already hold whatever they last held. */
    setAutoCalculate(enabled: boolean): void {
        this.#autoCalculate = enabled;
        if (enabled) this.resolve();
    }

    /** OFF: skip the derive, return the last resolve's cached issues untouched. */
    override resolve(): readonly DriverIssue[] {
        return this.#autoCalculate ? super.resolve() : this.issues();
    }

    /** `airProvider` defaults to the reference environment — every existing caller
     *  (`conformingRecordToDriver`, tests, `driverYmlToOpenisdAndWdr.ts`) passes none. A caller
     *  holding an app-level environment (the UI, constructing a My Drivers row) passes its own. */
    static wrap(
        json: DriverDeviceJson,
        engine: Engine,
        airProvider: () => AirConstantProvider = () => ({}),
    ): OpenISDDriverStandalone {
        let current = json;
        const raw: SimpleField<DriverDeviceJson> = {
            get value() { return current; },
            set: (j) => {
                current = j;
            },
        };
        // S2-7c: every write resolves from here on — a solve's own `setCalculated` writes
        // travel through this same lens and must not re-trigger (`resolvingField`'s reentrancy
        // guard). `driver` is assigned before `onWrite` can ever run: the guarded callback only
        // fires from a `.set()` call, and construction itself performs none (see the base
        // constructor's own note on why it does not resolve itself).
        // eslint-disable-next-line prefer-const
        let driver!: OpenISDDriverStandalone;
        const record = resolvingField(raw, () => driver.resolve());
        driver = new OpenISDDriverStandalone(record, engine, airProvider);
        // The one-shot cache-on-load (S7-d): a standalone driver is a genuine single long-lived
        // instance, so — unlike an embedded one, rebuilt fresh on every access — resolving once
        // here is exactly the "'C' is a cache, recomputed on load" contract, not a write-on-read
        // hazard. Goes through the wrapped lens like any other write, so it is guarded the same
        // way and reachable from `driver.resolve()` above without recursing.
        driver.resolve();
        return driver;
    }

}

/** The driver INSIDE a project — a window onto the project's own `driver` slot. A standalone
 *  driver windows its own record instead, which is the whole difference between the two.
 *
 *  An embedded driver never carries its own stored `c`/`roo`: the project's environment is the
 *  sole source while it is embedded (human ruling 2026-09-15). `update()` strips both fields on
 *  every write, `solveConsistencyGroup()` fills them from the project's live environment, and
 *  `detach()` freezes the resolved pair back in as entered so the driver leaves with a concrete
 *  value instead of reverting to the bare reference default. */
class OpenISDDriverEmbedded extends OpenISDDriver {
    private constructor(
        record: SimpleField<DriverDeviceJson>,
        engine: Engine,
        airProvider: () => AirConstantProvider,
        durableIssues: () => readonly DriverIssue[],
    ) {
        super(record, engine, airProvider, durableIssues);
    }

    /** Takes the lens onto the project's `driver` slot and the project's air — what this driver
     *  falls back to when it states no `c`/`roo` of its own. The project builds both, so the
     *  driver needs no reference back to the project itself. */
    static wrap(
        slot: SimpleField<DriverDeviceJson>,
        engine: Engine,
        airProvider: () => AirConstantProvider,
        /** The PROJECT's cached driver issues. This object does not outlive one access, so the
         *  dq a resolve wrote into its fields is gone before anything reads it; the project's
         *  cache is what survives. */
        durableIssues: () => readonly DriverIssue[],
    ): OpenISDDriverEmbedded {
        return new OpenISDDriverEmbedded(slot, engine, airProvider, durableIssues);
    }

    /** Adopt `source`'s whole record, then strip its `c`/`roo` — an embedded driver never keeps
     *  an imported/entered value of its own, regardless of where the write came from (a project
     *  choosing a different driver, loading a `.wdr`/`.owdr`, or the generic editor's commit path,
     *  which all route through this one method). */
    override update(source: OpenISDDriver): void {
        super.update(source);
        this.specs.c_m_per_s.clear();
        this.specs.roo_kg_per_m3.clear();
    }

    /** S2-10: `solveConsistencyGroup()` — the what-if bag query this class used to override to
     *  force `c`/`roo` to the project's live air regardless of the stored pair — is gone; the
     *  record is read directly everywhere now (`driver.ts.c_m_per_s.value`), so masking a stale
     *  value at READ time is no longer possible. Clearing it here, on every `resolve()` (not just
     *  on `update()`), is what keeps the "project environment is the SOLE source while embedded"
     *  guarantee self-healing: a write that bypasses `setDriver()`/`loadDriver()` entirely (a
     *  project record saved before this rule existed, `fromOwprText` loading it back, or a
     *  direct field write) can still leave `c_m_per_s`/`roo_kg_per_m3` 'entered' in the raw
     *  record, and `resolve()` never overwrites an entered value on its own — so without this,
     *  such a record's stale pair would surface again (test/domain.test.ts "a stale c/roo
     *  already sitting in an embedded driver's record… is still ignored"). */
    override resolve(): readonly DriverIssue[] {
        this.specs.c_m_per_s.clear();
        this.specs.roo_kg_per_m3.clear();
        return super.resolve();
    }

    /** Leaving the project: freeze the currently-resolved `c`/`roo` in as entered on the detached
     *  copy, so the driver's behaviour does not jump the instant it is no longer bound to a
     *  project's environment. */
    override detach(): OpenISDDriverStandalone {
        // The record's own resolve() cascade (S2-7c/d1) already derives `c_m_per_s`/
        // `roo_kg_per_m3` from the base class's own `airProvider` — this embedded driver's OWN
        // stored pair is always stripped (`update()` above), so the cascade never has an entered
        // value of its own to prefer and always falls through to the project's live environment.
        // Reading the record directly is therefore already "the project's resolved air" — no
        // bag override needed (S2-10).
        const resolvedC = this.specs.c_m_per_s.value;
        const resolvedRho = this.specs.roo_kg_per_m3.value;
        const copy = super.detach();
        if (resolvedC !== null) copy.specs.c_m_per_s.set(resolvedC);
        if (resolvedRho !== null) copy.specs.roo_kg_per_m3.set(resolvedRho);
        return copy;
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
 * ONE PASSIVE-RADIATOR SPEC SECTION, PUBLISHED — the radiator's counterpart to `DriverSpec`.
 *
 * A window onto the `passive-radiator` section of a device record, with every parameter that
 * section can carry. Separate from `DriverSpec` because a radiator has no motor: `Re`, `BL`,
 * `Qes`, `Znom`, `Pe` and the thermal parameters are not absent from it, they are meaningless to
 * it, and one shared class would have to model one of the two dishonestly.
 */
export class OpenIsdPassiveRadiatorSpec {
    readonly Fs_hz: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Qms: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Cms_m_per_N: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Mms_kg: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Rms_kg_per_s: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Sd_m2: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Vas_m3: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Vd_m3: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Xmax_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Xlim_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Dia_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Dd_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly DVol_m3: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Thick_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Depth_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Basket_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Outer_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly OuterX_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly OuterY_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly weight_kg: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;

    constructor(slot: SimpleField<RadiatorDeviceJson>) {
        const section = radiatorSection(slot);
        this.Fs_hz = prSpec(section, 'Fs_hz');
        this.Qms = prSpec(section, 'Qms');
        this.Cms_m_per_N = prSpec(section, 'Cms_m_per_N');
        this.Mms_kg = prSpec(section, 'Mms_kg');
        this.Rms_kg_per_s = prSpec(section, 'Rms_kg_per_s');
        this.Sd_m2 = prSpec(section, 'Sd_m2');
        this.Vas_m3 = prSpec(section, 'Vas_m3');
        this.Vd_m3 = prSpec(section, 'Vd_m3');
        this.Xmax_m = prSpec(section, 'Xmax_m');
        this.Xlim_m = prSpec(section, 'Xlim_m');
        this.Dia_m = prSpec(section, 'Dia_m');
        this.Dd_m = prSpec(section, 'Dd_m');
        this.DVol_m3 = prSpec(section, 'DVol_m3');
        this.Thick_m = prSpec(section, 'Thick_m');
        this.Depth_m = prSpec(section, 'Depth_m');
        this.Basket_m = prSpec(section, 'Basket_m');
        this.Outer_m = prSpec(section, 'Outer_m');
        this.OuterX_m = prSpec(section, 'OuterX_m');
        this.OuterY_m = prSpec(section, 'OuterY_m');
        this.weight_kg = prSpec(section, 'weight_kg');
    }
}

/**
 * What every radiator has, wherever the radiator lives: a lens onto ITS OWN record.
 *
 * `slot` is PROTECTED, so `update()` below — a method of the class that declares it — may read
 * `source.slot`, while nothing outside the class hierarchy can.
 */
abstract class OpenISDPassiveRadiator extends OpenISDDevice {
    protected readonly slot: SimpleField<RadiatorDeviceJson>;

    /** Which spec section this device's record carries — the radiator's counterpart to the
     *  driver's `'woofer' | 'tweeter'`. */
    readonly section = 'passive-radiator' as const;

    /** This radiator's spec section, exactly as a driver publishes `spec[section]`. */
    readonly spec: OpenIsdPassiveRadiatorSpec;


    // Every SPEC field a radiator can state, declared and built ONCE for both kinds. An embedded
    // radiator and a standalone one differ in WHERE their record lives, never in what a radiator
    // is, so a field list that differed between them was describing nothing real. The six identity
    // fields are not here: every device has those, so they live on `OpenISDDevice`.

    protected constructor(slot: SimpleField<RadiatorDeviceJson>, engine: Engine) {
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
        this.slot.set({...source.slot.value});
    }

    /** The stable identity carried by the canonical record — the radiator's counterpart to
     *  `OpenISDDriver.uuid()`. The bundled index lists radiators by it and favourites key on it. */
    uuid(): string {
        return this.slot.value.uuid.value;
    }
}

class OpenISDPassiveRadiatorEmbedded extends OpenISDPassiveRadiator {

    constructor(slot: SimpleField<RadiatorDeviceJson>, engine: Engine) {
        super(slot, engine);
    }

    /** Adopt the chosen radiator into this box. The box owns its radiator from here on, so later
     *  edits change the box and never the library entry the radiator was picked from. */
    override update(source: OpenISDPassiveRadiatorStandalone): void {
        super.update(source);
    }

    /** This radiator as one belonging to no box — the copy My Passive Radiators holds, and the
     *  inverse of `update()`. Deep-copies, so editing the box afterwards leaves the saved
     *  radiator alone, exactly as `OpenISDDriver.detach()` does for a driver. */
    detach(): OpenISDPassiveRadiatorStandalone {
        return OpenISDPassiveRadiatorStandalone.wrap(structuredClone(this.slot.value), this.engine);
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
export class OpenISDPassiveRadiatorStandalone extends OpenISDPassiveRadiator {
    /** A radiator stating nothing — the counterpart of `OpenISDDriver.empty()`, and how a PR
     *  comes into existence before anyone has typed its parameters. `configurePR()` accepts it,
     *  so a box can adopt one and the editor fills it in from there. */
    static empty(engine: Engine, appContext: AppContext = realAppContext): OpenISDPassiveRadiatorStandalone {
        return OpenISDPassiveRadiatorStandalone.wrap(blankDeviceRecord({'passive-radiator': {}}, 'passive-radiator', appContext), engine);
    }

    static fromConformingRecord(record: unknown, engine: Engine): OpenISDPassiveRadiatorStandalone | string[] {
        const conformed = OpenISDDeviceJson.fromConformingRecord(record);
        if ('problems' in conformed) return conformed.problems;

        const radiator = asRadiatorDevice(conformed.json);
        if (radiator === null) return ['no passive-radiator section — this record is a driver, not a radiator'];
        return OpenISDPassiveRadiatorStandalone.wrap(radiator, engine);
    }



    private constructor(
        read: () => RadiatorDeviceJson,
        set: (json: RadiatorDeviceJson) => void,
        engine: Engine,
    ) {
        super({get value() { return read(); }, set}, engine);
    }

    static wrap(json: RadiatorDeviceJson, engine: Engine): OpenISDPassiveRadiatorStandalone {
        let current = json;
        return new OpenISDPassiveRadiatorStandalone(() => current, (j) => {
            current = j;
        }, engine);
    }

    /** @internal The record a save writes, deep-cloned — the radiator's counterpart to
     *  `OpenISDDriver.cloneDriver()`, and the persistence layer's one way to reach the raw
     *  record it stores, never field by field. Clones before handing it out, so the caller can
     *  store the result without aliasing this radiator's own live record. */
    clonePassiveRadiator(): RadiatorDeviceJson {
        return structuredClone(this.slot.value);
    }

    /** The record as the app holds it — the radiator's counterpart of `OpenISDDriver.toOpenIsdDeviceJson()`,
     *  so the scraper bridge and the bundler's round-trip gate read a radiator through the same
     *  seam a driver has. Un-cloned, like the driver's: a caller that stores it clones it
     *  (`clonePassiveRadiator()`). */
    toOpenIsdDeviceJson(): RadiatorDeviceJson {
        return this.slot.value;
    }

}


function freshEmbeddedDriver(json: OpenISDProjectJson, appContext: AppContext = realAppContext): OpenISDProjectJson {
    const copy = structuredClone(json);
    copy.driverEmbedding.device.uuid = {value: appContext.newId()};
    return copy;
}

/** `OpenISDProject#resolve()`'s cached result — the current layer's own issues, by channel.
 *  `driver` is this step (S2-7d1); vent/PR/sealed/environment join it in S2-7d2. */
interface ProjectIssues {
    readonly driver: readonly DriverIssue[];
    readonly signal: readonly SignalIssue[];
    readonly vent: readonly VentIssue[];
    readonly pr: readonly PrIssue[];
    readonly sealed: readonly SealedAlignmentIssue[];
    /** The designed tuning's own plausibility mark — WinISD's answer is not changed, only
     *  judged. Appended to `vent`'s own mark on `tuning_goal_hz`, never over it: the two say
     *  different things (this geometry does not solve / nobody would build this). */
    readonly ventTuningExtra: DqIssue | null;
}

/** A dragged frequency-band selection on a chart — `OpenISDProject#dragRange`'s stored shape.
 *  Never persisted (see that getter's own comment). */
interface DragRange {
    readonly fLo: number;
    readonly fHi: number;
}

/** Clears `dq` on every named handle, then applies each issue's OWN formula only to the handles
 *  `engine.issueFields()` names for it — the driver's 44 independent quantities, where one
 *  relation's DQ has nothing to do with an unrelated field (S2-7d2). */
function projectFormulaDq<Q extends string>(
    /** Every handle's own name, exactly once — `Object.keys(handles)` would answer `string[]`,
     *  not `Q[]` (TS never trusts an object's key list to match its declared type, since nothing
     *  stops one carrying extra enumerable properties at runtime), so the caller states its own
     *  field list where the compiler CAN check it: `as const satisfies readonly Q[]`. */
    fields: readonly Q[],
    handles: Readonly<Record<Q, Pick<Calculatable<unknown>, 'setDq'>>>,
    issues: readonly (CalculationIssue<Q> | OutOfRangeIssue)[],
    engine: Engine,
): void {
    const mark = (key: Q, dq: readonly DqIssue[]): void => handles[key].setDq(dq);
    // `fields` is `readonly Q[]`, always a subtype of `readonly string[]` (`Q extends string`);
    // widening the binding costs no cast. `isField` then validates an `OutOfRangeIssue.field`
    // (declared as plain `string` — D14's mark shape is shared across every domain, not just the
    // driver's own) against that same list before narrowing it to `Q`.
    const fieldNames: readonly string[] = fields;
    const isField = (candidate: string): candidate is Q => fieldNames.includes(candidate);
    fields.forEach(key => mark(key, []));
    issues.forEach(issue => {
        if ('field' in issue) {
            if (isField(issue.field)) mark(issue.field, [issue]);
            return;
        }
        engine.issueFields(issue).forEach(field => mark(field, [issue]));
    });
}

/** The vent tuning↔length pair and the PR addedMass↔tuning quad each carry ONE relation between
 *  a small, tightly-coupled group of quantities — unlike the driver's 44 largely-independent
 *  fields, an issue anywhere in the group redlines EVERY field in it, not just the ones
 *  `issueFields()` happens to name (the established "redline all the fields" ruling PR's own
 *  handles already carried before S2-7d2 — see the type's own doc comment). Takes the FIRST
 *  issue only, matching what every hand-wrapped predecessor field did (`issues.find(...)`) —
 *  these groups practically never carry more than one live issue at once. */
function groupDq(issues: readonly DqIssue[]): readonly DqIssue[] {
    return issues.length > 0 ? [issues[0]] : [];
}

/** Adapts `box.sealed.volume_m3` (a plain `SimpleField<number>` — the schema never gave the box's
 *  own stated volume a C/E flag) into the `SolverField<number>` shape `Vb_m3` needs to hand
 *  `Engine.solveSealedAlignment` (S10). A zero or negative volume reads as null — "a zero volume
 *  is not a very small box; it is no box" (the same check `#sealedResonance_hz`/`#sealedQtc`
 *  made before this adapter replaced them).
 *
 *  The write methods are STRUCTURALLY unreachable, not just unused today: `entered` is always
 *  `true`, and `solveSealedAlignment`'s only route that writes `Vb_m3` is gated on
 *  `!params.Vb_m3.entered` — so that route can never be taken, whatever a caller states for
 *  `Qtc`. Throwing keeps that invariant visible instead of silently discarding a solved volume
 *  a future change might otherwise expect this adapter to store somewhere. */
function sealedVolumeAsSolverField(volume: SimpleField<number>): SolverField<number> {
    const unreachable = (): never => {
        throw new Error(
            'sealedVolumeAsSolverField: Vb_m3 write attempted — structurally unreachable, since ' +
            'this adapter always reports entered:true (see the function\'s own doc comment).');
    };
    return {
        get value() { const v = volume.value; return v > 0 ? v : null; },
        entered: true,
        calculated: false,
        precision: null,
        dq: [],
        setCalculated: unreachable,
        setDq: unreachable,
        setNotAvailable: unreachable,
    };
}

/** One air condition of a project: E when typed, else C, never N. */
type EnvironmentField = Readable<number> & Entered & Calculated & Writable<number> & Clearable & Calculatable<number>;

/** A project's three air conditions. */
interface EnvironmentFields {
    readonly tempK: EnvironmentField;
    readonly humidityPct: EnvironmentField;
    readonly pressurePa: EnvironmentField;
}

export class OpenISDProject {
    static builder(driver: OpenISDDriver, engine: Engine, appContext: AppContext = realAppContext): ProjectBuilder {
        return new ProjectBuilder(driver, engine, appContext);
    }

    /**
     * A new project with every section present and nothing stated — what the New Project wizard
     * opens on and writes into, rather than collecting a spec and building at the end.
     *
     * The driver and the radiator are blank devices (`OpenISDDriver.empty()`,
     * `OpenISDPassiveRadiatorStandalone.empty()`), so no physical value here was invented: the
     * wizard repopulates the driver from the one the user picks, and the radiator from the one
     * they pick when they choose a passive-radiator box.
     */
    static empty(engine: Engine, appContext: AppContext = realAppContext): OpenISDProject {
        return OpenISDProject.builder(OpenISDDriver.empty(engine, appContext), engine, appContext)
            .sealed()
            .volume_m3(0)
            .build();
    }

    /** THE project's identity, and IN-MEMORY ONLY — deliberately a class field rather than a
     *  member of `OpenISDProjectJson`, which is what makes "internal only" structural instead of
     *  a rule someone has to remember: the record is the only thing that is ever serialised, so
     *  an id that is not in it CANNOT reach a file or a link (John 2026-08-26, QO92).
     *
     *  It exists so the running app can tell two open projects apart when their names collide,
     *  and so a store — or a focus pointer — can key on something stable. */
    readonly #uuid: string;

    /** The project as of the last save. Never mutated: every write builds a new record. */
    #saved: OpenISDProjectJson;

    /** The project including every change since the last save, or null when no change has been
     *  made. Always a COMPLETE record, never a partial one. */
    #edited: OpenISDProjectJson | null = null;

    /** The transient tuning session. It is never promoted or serialized. */
    #whatif: OpenISDProjectJson | null = null;

    readonly #listeners = new ProjectListeners();

    /** The one calculation surface this project uses. INJECTED — never constructed here, never
     *  reached through a module-scoped instance. Every acoustic figure the project reports comes
     *  from this reference and from nowhere else. */
    readonly #engine: Engine;

    /** The current layer's cached issues — see the class doc comment's "ONE EXCEPTION". */
    #issues: ProjectIssues = { driver: [], signal: [], vent: [], pr: [], sealed: [], ventTuningExtra: null };

    private constructor(saved: OpenISDProjectJson, uuid: string, engine: Engine) {
        this.#saved = saved;
        this.#uuid = uuid;
        this.#engine = engine;
        this.#resolve();
    }

    /** A window onto a driver embedded in `root`'s whole record — `get driver()` below is
     *  `#driverOver(this.#root())`; `#resolve()` calls it with a DIRECT (non-notifying) root of
     *  its own instead. One construction, parameterised by which lens backs it. */
    #driverOver(root: SimpleField<OpenISDProjectJson>): OpenISDDriverEmbedded {
        return OpenISDDriverEmbedded.wrap(
            focus(focus(root, 'driverEmbedding'), 'device'),
            this.#engine,
            () => this.#airOver(root),
            () => this.#issues.driver,
        );
    }

    /** The three air conditions `root` reads as — each E or C, never absent. */
    #airOver(root: SimpleField<OpenISDProjectJson>): AirConstantProvider {
        const env = this.#envFieldsOver(focus(root, 'environment'));
        return { tempK: env.tempK.value, humidityPct: env.humidityPct.value, pressurePa: env.pressurePa.value };
    }

    /** The embedded driver — built fresh from the current record on every access, never held: the
     *  project has exactly three stored fields (`#saved`/`#edited`/`#engine`, John 2026-09-06;
     *  `#issues` is a derived cache, not project state — see
     *  the class doc comment), and every other public member is a getter mirroring the record's
     *  own structure. */
    get driver(): OpenISDDriverEmbedded {
        return this.#driverOver(this.#root());
    }

    /** A window onto the box embedded in `root`'s whole record — `get box()` below is
     *  `#boxOver(this.#root())`; `#resolve()` calls it with a DIRECT (non-notifying) root of its
     *  own instead. Mirrors `#driverOver` exactly (S2-7d2). */
    #boxOver(root: SimpleField<OpenISDProjectJson>): OpenISDBox {
        return OpenISDBox.wrap(
            focus(root, 'box'), this.#driverOver(root), this.#engine,
            () => root.value.driverEmbedding.Rs_ohm,
            () => LossMode.parse(root.value.advanced.lossMode),
            () => this.#issues,
            () => this.#issues.ventTuningExtra,
        );
    }

    /** Replace the embedded driver's whole record with `source`'s — the project adopting a
     *  different driver (choosing one from the library, loading a `.wdr`/`.owdr` file).
     *  Array-level facts (`nDrivers`, `wiring`, ...) are untouched; only `driverEmbedding.device`
     *  changes. */
    setDriver(source: OpenISDDriver): void {
        this.driver.update(source.copyAsNew());
    }

    /** Adopt a driver that came from outside this project — a library pick, or a `.wdr`/`.owdr`
     *  file just parsed. Same write as `setDriver`, with a name that says where the driver came
     *  from. Deep-clones — the file's/library's driver and this project's share no nested object
     *  afterward. */
    loadDriver(source: OpenISDDriver): void {
        if (source instanceof OpenISDDriverEmbedded) {
            throw new Error('loadDriver(): source must be a standalone OpenISDDriver, not an embedded project driver');
        }
        this.driver.update(source.copyAsNew());
    }

    /** How many units of the embedded driver this project's array uses, and how they're wired
     *  together — array-level facts, not facts about the driver itself (John 2026-09-06). */
    get nDrivers(): SimpleField<number> {
        return focus(this.#slot('driverEmbedding'), 'nDrivers');
    }

    get wiring(): SimpleField<'series' | 'parallel'> {
        return focus(this.#slot('driverEmbedding'), 'wiring');
    }

    /** Thermal power compression: coil temperature rise under drive, Kelvin. */
    get vcTempRise_K(): SimpleField<number> {
        return focus(this.#slot('driverEmbedding'), 'vcTempRise_K');
    }

    /** The amplifier's own source/output resistance loading this array. */
    get Rs_ohm(): SimpleField<number> {
        return focus(this.#slot('driverEmbedding'), 'Rs_ohm');
    }

    /** Mass this project's array adds to the driver — its own hardware, not a fact about the
     *  driver itself. */
    get driverAddedMass_kg(): SimpleField<number> {
        return focus(this.#slot('driverEmbedding'), 'driverAddedMass_kg');
    }

    /** This array's own voice-coil resistance temperature coefficient, SI 1/K — independent of
     *  the driver's own datasheet `driver.alfaVC_per_K` (WinISD stores these separately, and
     *  they can diverge). */
    get alfaVC_per_K(): SimpleField<number> {
        return focus(this.#slot('driverEmbedding'), 'alfaVC_per_K');
    }

    /** WinISD Driver tab "Standard" / "Iso-Barik" radio. */
    get loading(): SimpleField<'standard' | 'isobaric'> {
        return focus(this.#slot('driverEmbedding'), 'loading');
    }

    /** The box — handed the DRIVER and the ENGINE: a chamber's resonance depends on the driver it
     *  loads, and the box reads the driver through its PUBLIC field surface, never its record.
     *  Built fresh on every access, same reasoning as `driver`. */
    get box(): Box {
        return this.#boxOver(this.#root());
    }

    /** What the user calls this project. A LABEL, not an identity — two projects may share one,
     *  which is exactly why `uuid()` exists. */
    get name(): SimpleField<string> {
        return focus(this.#slot('meta'), 'name');
    }

    /** WinISD Project tab: who made this project, and when. */
    get creator(): SimpleField<string> {
        return focus(this.#slot('meta'), 'creator');
    }

    get created(): SimpleField<string> {
        return focus(this.#slot('meta'), 'created');
    }

    get modified(): SimpleField<string> {
        return focus(this.#slot('meta'), 'modified');
    }

    /** WinISD Project tab: the user's own note about this project. Stored, never interpreted. */
    get description(): Readable<string> & Entered & Writable<string> {
        const lens = this.#slot('meta');
        return new SetOnlyFieldImpl<string>(
            () => enteredCell('description', lens.value.description),
            {
                entered: (v: string) => lens.set({...lens.value, description: v}),
            },
        );
    }

    /** The signal-chain filter list. */
    get filters(): SimpleField<readonly Filter[]> {
        return focus(this.#slot('filters'), 'filters');
    }

    /** Force-flat auto-EQ — WinISD Advanced "Force flat response". */
    get forceFlatResponse(): SimpleField<boolean> {
        return focus(this.#slot('advanced'), 'forceFlatResponse');
    }

    /** Model ports as a lossy transmission line instead of a lumped mass — WinISD Advanced
     *  "Use transmission line-model for port simulation". */
    get useTransmissionLinePortModel(): SimpleField<boolean> {
        return focus(this.#slot('advanced'), 'useTransmissionLinePortModel');
    }

    /** WinISD Advanced "Rg is at driver side" — whether the amplifier's source resistance
     *  (`Rs_ohm`) is applied per driver or once across the whole array. */
    get rgAtDriverSide(): SimpleField<boolean> {
        return focus(this.#slot('advanced'), 'rgAtDriverSide');
    }

    /** WinISD Advanced "Simulate voice coil inductance" — includes Le in the acoustic circuit
     *  model (gyrator) rather than just the impedance plot (winisd). */
    get circuitModel(): SimpleField<'winisd' | 'gyrator'> {
        return focus(this.#slot('advanced'), 'circuitModel');
    }

    /** WinISD Advanced "SPL graph is Xmax limited" — whether the SPL chart shows the
     *  Xmax-backed-off curve instead of the unclamped one. Display only. */
    get splGraphIsXmaxLimited(): SimpleField<boolean> {
        return focus(this.#slot('advanced'), 'splGraphIsXmaxLimited');
    }

    /** Sealed-box resonance loss model (S10/QO130) — which physics model `box.sealed`'s Fsc/Qtc
     *  readout uses. PROJECT-scoped, not a UI singleton: two open projects must not share one
     *  loss mode. `advanced.lossMode` stores the wire string; this is the one boundary that
     *  translates it via `LossMode.parse`/`.value`, matching the `circuitModel` accessor above. */
    get lossMode(): SimpleField<LossMode> {
        const lens = focus(this.#slot('advanced'), 'lossMode');
        return {
            get value() { return LossMode.parse(lens.value); },
            set: (mode: LossMode) => lens.set(mode.value),
        };
    }

    /** Which charts are open (S10/QO130) — PROJECT-scoped, reversing QO90 for this field.
     *  Empty when absent (a project saved before S10, or a fresh one). Plain strings: the UI's
     *  `ChartTabId` is `packages/ui`'s own type (`domain/index.ts`'s "no packages/ui types"
     *  rule), so `parseChartTabId` does the string↔member conversion at the UI boundary. */
    get graphs(): SimpleField<readonly string[]> {
        const lens = focus(this.#slot('charts'), 'graphs');
        return {
            get value() { return lens.value ?? []; },
            set: (ids) => lens.set([...ids]),
        };
    }

    /** The graph cursor/selection (S10/QO130) — PROJECT-scoped, reversing QO90: two open
     *  projects must not share one cursor. Written on every mousemove during hover/drag, so
     *  QO168 (John 2026-09-21) keeps these four OUT of the saved record entirely: plain private
     *  instance fields, never `OpenISDProjectJson`/`.owpr` (unlike `graphs`/`lossMode` above,
     *  which DO persist) — a documented exception in
     *  `architecture-project-has-three-fields.test.ts`. `#notify()` alone on write — no
     *  `#slot()`, no `#edited` clone, no `#resolve()` cascade; a mousemove has nothing for the
     *  solver to recompute. */
    #cursorF: number | null = null;
    #pinnedF: number | null = null;
    #cursorLocked = false;
    #dragRange: DragRange | null = null;

    get cursorF(): SimpleField<number | null> {
        return simpleField(() => this.#cursorF, (v) => { this.#cursorF = v; this.#notify(); });
    }

    /** The crosshair's pinned/snapped frequency — see `cursorF` above. */
    get pinnedF(): SimpleField<number | null> {
        return simpleField(() => this.#pinnedF, (v) => { this.#pinnedF = v; this.#notify(); });
    }

    /** Whether the crosshair is locked to `pinnedF` rather than following the pointer. */
    get cursorLocked(): SimpleField<boolean> {
        return simpleField(() => this.#cursorLocked, (v) => { this.#cursorLocked = v; this.#notify(); });
    }

    /** The dragged frequency-band selection, or null when none is active. */
    get dragRange(): SimpleField<DragRange | null> {
        return simpleField(() => this.#dragRange, (v) => { this.#dragRange = v; this.#notify(); });
    }

    get sweepN(): SimpleField<number | null> {
        const charts = this.#slot('charts');
        return {
            get value() { return charts.value.N ?? null; },
            set: (v) => charts.set({...charts.value, N: v ?? undefined}),
        };
    }

    /** A record ENTERS the process here. A record carries no identity, so one is minted — two
     *  wraps of one record are two independently editable projects, which is what opening a FILE
     *  twice should give. */
    static wrap(json: OpenISDProjectJson, engine: Engine, appContext: AppContext = realAppContext): OpenISDProject {
        return this.wrapWithIdentity(freshEmbeddedDriver(json, appContext), appContext.newId(), engine);
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
    static wrapWithIdentity(json: OpenISDProjectJson, uuid: string, engine: Engine): OpenISDProject {
        return new OpenISDProject(json, uuid, engine);
    }

    /** Wrap a stored session (saved and edited states) under an adopted identity. */
    static wrapSession(session: OpenISDProjectSessionJson, uuid: string, engine: Engine, appContext: AppContext = realAppContext): OpenISDProject {
        const project = new OpenISDProject(freshEmbeddedDriver(session.saved, appContext), uuid, engine);
        if (session.edited) {
            project.#edited = freshEmbeddedDriver(session.edited, appContext);
            // The constructor's own resolve() only reached `#saved`, set just above — the
            // edited layer just assigned needs its own (S7-d: recompute on load).
            project.#resolve();
        }
        return project;
    }


    /** This project's in-memory identity. */
    uuid(): string {
        return this.#uuid;
    }

    /** The committed/ordinary-edit record. What-if never becomes the persistence source. */
    #committed(): OpenISDProjectJson {
        return this.#edited ?? this.#saved;
    }

    /** The record every live project read goes to. */
    #current(): OpenISDProjectJson {
        return this.#whatif ?? this.#committed();
    }

    /** Enter the edited state if not already in it, and answer the record a write must build on. */
    #ensureEditing(): OpenISDProjectJson {
        if (!this.#edited) this.#edited = structuredClone(this.#saved);
        return this.#edited;
    }

    /** A get/set pair addressing ONE top-level field of the record. Reads whichever record is
     *  current; every write lands in the active what-if, otherwise in `#edited`.
     *
     *  The write REPLACES the record rather than mutating one, so a caller holding an earlier
     *  record sees no change through it — copy-on-write, with the copy being the spread that a
     *  write performs anyway. */
    #slot<K extends keyof OpenISDProjectJson>(key: K): SimpleField<OpenISDProjectJson[K]> {
        return simpleField(() => this.#current()[key], (value) => {
            const base = this.#whatif ?? this.#ensureEditing();
            if (this.#whatif) this.#whatif = {...base, [key]: value};
            else this.#edited = {...base, [key]: value};
            this.#resolve();
            this.#notify();
        });
    }

    /** A get/set pair over the WHOLE current record — what `get driver()` builds its embedded
     *  driver window on, since a driver's own fields nest many levels below any single top-level
     *  `OpenISDProjectJson` key and `#slot` only ever addresses one. Promotes/notifies exactly
     *  like `#slot` (S2-7d1: also resolves before it notifies), for the same reason: a nested
     *  `focus()` write always reads the whole object a lens is over, then replaces it whole —
     *  here that whole object is the entire project record. */
    #root(): SimpleField<OpenISDProjectJson> {
        return simpleField(() => this.#current(), (json) => {
            if (this.#whatif) this.#whatif = json;
            else { this.#ensureEditing(); this.#edited = json; }
            this.#resolve();
            this.#notify();
        });
    }

    /**
     * T11/S2-7d: resolve the CURRENT layer's driver — write every quantity `solveDriver` can
     * derive back into THAT layer as a `'C'` entry, and cache the result in `#issues`.
     *
     * Reads and writes go DIRECTLY to the layer object below, never through `#slot`/`#root`:
     * those always promote to `#edited` and notify, which would make simply LOADING a project
     * (`wrap()`) register as "modified", and would make a solve's OWN writes notify a SECOND
     * time for one user action — the exact write-on-read/write-on-solve loop that broke
     * `OpenISDDriverEmbedded` in S2-7c before its own auto-resolve was pulled out of the shared
     * driver constructor (see that class's own note).
     */
    #resolve(): void {
        const directRoot = simpleField<OpenISDProjectJson>(
            () => this.#whatif ?? this.#edited ?? this.#saved,
            (json) => {
                if (this.#whatif) this.#whatif = json;
                else if (this.#edited) this.#edited = json;
                else this.#saved = json;
            });
        // Before the driver: its own air falls back to these three conditions, so they must
        // state the app's default by the time `driver.resolve()` reads them.
        this.#resolveEnvironment(focus(directRoot, 'environment'));
        const driver = this.#driverOver(directRoot);
        const driverIssues = driver.resolve();

        // The drive power/voltage pair, against the driver's just-resolved Re. Its dq is read
        // from `#issues.signal` at read time, so no `projectGroupDq` here.
        const Re_ohm = this.#usableReOver(directRoot);
        this.#settleSignal(focus(directRoot, 'signal'), Re_ohm);
        const signal = this.#engine.solveSignal({
            power_W: this.#powerDriveOver(directRoot),
            Re_ohm: inputOf(() => Re_ohm),
            voltage_V: this.#driveVoltageOver(directRoot),
            Rs_ohm: inputOf(() => this.Rs_ohm.value),
        });

        const spec = driver.specs;
        // `driver.resolve()` above writes both back as 'C' entries, so the record states them.
        const air: Air = { rho: spec.roo_kg_per_m3.value!, c: spec.c_m_per_s.value! };

        const box = this.#boxOver(directRoot);
        // GEOMETRY IS IN, ACOUSTICS IS OUT (John, 2026-08-26): every port's area ↔ dims
        // relation solves here, unconditionally, for all 7 vents regardless of which box
        // type is active — geometry does not depend on that. Must run BEFORE the acoustic
        // `solveVent` calls below, which read `area_m2` as a plain input.
        const vents: readonly Vent[] = [
            box.vented.vent, box.bandpass4.vents.front,
            box.bandpass6.vents.rear, box.bandpass6.vents.front,
            box.abc.vents.rear, box.abc.vents.front, box.abc.vents.intra,
        ];
        for (const v of vents) {
            this.#resolveVentGeometry(v);
            this.#resolveVentCount(v);
        }
        const boxType = directRoot.value.box.boxType;
        let vent: readonly VentIssue[] = [];
        let pr: readonly PrIssue[] = [];
        let sealed: readonly SealedAlignmentIssue[] = [];
        let ventTuningExtra: DqIssue | null = null;

        if (boxType === 'vented') {
            vent = this.#engine.solveVent({
                tuning_goal_hz: box.vented.tuning_goal_hz,
                length_m: box.vented.vent.length_m,
                Vb_m3: inputOf(() => box.vented.volume_m3.value),
                area_m2: inputOf(() => box.vented.vent.area_m2.value),
                count: inputOf(() => box.vented.vent.count.value),
                endCorrection_m: inputOf(() => box.vented.vent.endCorrection_m.value),
            }, air);
            // The designed tuning is WinISD's own answer and is not changed — it is marked.
            // Read live off `#issues.ventTuningExtra`, appended to `#issues.vent`'s own mark,
            // never over it: the two say different things (this geometry does not solve /
            // nobody would build this).
            const Fb = box.vented.tuning_goal_hz.value;
            ventTuningExtra = Fb === null ? null : this.#engine.ventedTuningIssue(Fb);
        } else if (boxType === 'bandpass4') {
            vent = this.#engine.solveVent({
                tuning_goal_hz: box.bandpass4.chambers.front.tuning_goal_hz,
                length_m: box.bandpass4.vents.front.length_m,
                Vb_m3: inputOf(() => box.bandpass4.chambers.front.volume_m3.value),
                area_m2: inputOf(() => box.bandpass4.vents.front.area_m2.value),
                count: inputOf(() => box.bandpass4.vents.front.count.value),
                endCorrection_m: inputOf(() => box.bandpass4.vents.front.endCorrection_m.value),
            }, air);
        } else if (boxType === 'box-passive-radiator') {
            const p = box.passiveRadiator;
            const r = p.radiator;
            pr = this.#engine.solvePr({
                addedMass_kg: p.addedMass_kg,
                tuning_goal_hz: p.tuning_goal_hz,
                resonanceWithAddedMass_hz: p.resonanceWithAddedMass_hz,
                systemTuning_hz: p.systemTuning_hz,
                Vb_m3: inputOf(() => p.volume_m3.value || box.vented.volume_m3.value),
                prMmd_kg: inputOf(() => r.spec.Mms_kg.value),
                prSd_m2: inputOf(() => r.spec.Sd_m2.value),
                prCms_m_per_N: inputOf(() => r.spec.Cms_m_per_N.value),
            }, air);
        } else if (boxType === 'sealed') {
            const ts = driver.specs;
            // The Rg-loaded Qts, inlined rather than `sourceLoadedQts(Rs)` (that method reads
            // the NOTIFYING `this.driver.ts` — calling it from inside a resolve would re-enter
            // the write-on-read loop `#resolve()`'s own doc comment warns against). Mirrors
            // `#sealedResonance_hz`'s pre-S10 feed exactly (golden Fsc 63.1762 Hz/Qtc 0.5995).
            const rgLoadedQts = (): number | null => {
                const Qts = ts.Qts.value;
                if (Qts === null) return null;
                return this.#engine.sourceLoadedQts(
                    ts.Qms.value ?? NaN, ts.Qes.value ?? NaN, ts.Re_ohm.value ?? NaN,
                    directRoot.value.driverEmbedding.Rs_ohm, Qts);
            };
            sealed = this.#engine.solveSealedAlignment({
                Qts: inputOf(rgLoadedQts),
                Vas_m3: inputOf(() => ts.Vas_m3.value),
                Fs_hz: inputOf(() => ts.Fs_hz.value),
                Ql: inputOf(() => box.sealed.losses.Ql.value),
                Qa: inputOf(() => box.sealed.losses.Qa.value),
                lossMode: inputOf(() => directRoot.value.advanced.lossMode ?? null),
                Qtc: box.sealed.q_tc,
                Vb_m3: sealedVolumeAsSolverField(box.sealed.volume_m3),
            });
        }

        this.#issues = { driver: driverIssues, signal, vent, pr, sealed, ventTuningExtra };
    }

    /** Solves `vent.area_m2` against whichever dimension its own `shape` uses: `diameter_m`
     *  round, `height_m` (times the live `width_m`) slotted. PLAIN GEOMETRY — πr² and width ×
     *  height involve no air, compliance, resonance or end correction, so this belongs in the
     *  domain, not the engine (John 2026-08-26: "simple geometric calc like pi r squared are ok
     *  in the domain").
     *
     *  Entering either side of a pair already atomically clears the other (`pairedField`'s own
     *  `commitPair`), so this only ever has one side entered, or neither. `setNotAvailable()` on
     *  the "neither" branch wipes a stale calculated echo left over from a shape the vent has
     *  since switched away from — a plain `shape.set()` does not itself touch `area_m2`. */
    #resolveVentGeometry(vent: Vent): void {
        if (vent.shape.value === 'round') {
            if (vent.diameter_m.entered) {
                vent.area_m2.setCalculated(Math.PI * (vent.diameter_m.value! / 2) ** 2);
            } else if (vent.area_m2.entered) {
                vent.diameter_m.setCalculated(2 * Math.sqrt(vent.area_m2.value! / Math.PI));
            } else {
                vent.area_m2.setNotAvailable();
                vent.diameter_m.setNotAvailable();
            }
            return;
        }
        const width = vent.width_m.value;
        if (vent.height_m.entered) {
            if (width === null) vent.area_m2.setNotAvailable();
            else vent.area_m2.setCalculated(width * vent.height_m.value!);
        } else if (vent.area_m2.entered) {
            if (width === null || width === 0) vent.height_m.setNotAvailable();
            else vent.height_m.setCalculated(vent.area_m2.value! / width);
        } else {
            vent.area_m2.setNotAvailable();
            vent.height_m.setNotAvailable();
        }
    }

    /** Stores the port count's default (one port) as a 'C' entry wherever the record states no
     *  count, or states one that is not a whole number of at least one — the repair John ruled on
     *  2026-09-20, written into the record rather than applied at read time (John, 2026-09-24:
     *  "simply no reason for these exceptions to the rule"). No solve derives a port count, so
     *  this is the only write that ever makes one calculated. */
    #resolveVentCount(vent: Vent): void {
        const v = vent.count.value;
        if (!isPortCount(v)) vent.count.setCalculated(calcVentCount());
        else if (!vent.count.entered) vent.count.setCalculated(v);
    }

    /** Stores the app's Options → Environment value as a 'C' entry for every condition the
     *  project does not state itself: clear, then store what the empty slot reads. Re-stamped on
     *  every resolve, so changing Options reaches an unstated project (`appSettingsChanged`); an
     *  entered condition is never touched. */
    #resolveEnvironment(environment: SimpleField<OpenISDEnvironmentJson>): void {
        const env = this.#envFieldsOver(environment);
        for (const condition of [env.tempK, env.humidityPct, env.pressurePa]) {
            if (condition.entered) continue;
            condition.clear();
            condition.setCalculated(condition.value);
        }
    }

    /** @internal The record a save writes, deep-cloned — the persisted payload's one route to
     *  this project's state, never field by field. Reads `#saved`, NEVER `#edited`: a file/share
     *  write must never persist unsaved changes on its own — `save()` is a distinct, explicit
     *  user action (the Save button), and this method must not promote `#edited` to `#saved` as a
     *  side effect of being called. A caller writing out an edited project calls `save()` first,
     *  itself, in response to the user's own action. Clones before handing it out, so the stored
     *  copy cannot drift when this project is edited afterward — a shallow `{...}` spread is not
     *  enough, since every nested field object (`box`, `driver`, `environment`, …) would still be
     *  the same reference as the live record. No code outside `packages/design` may call this. */
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
    toWprText(engine: Engine): { value: string | null; errors: DriverError[] } {
        const committed = OpenISDProject.wrapWithIdentity(structuredClone(this.#committed()), this.#uuid, this.#engine);
        const {value: wpr, errors} = openIsdProjectToWinIsdProject(committed, engine);
        return {value: wpr ? wpr.toWpr() : null, errors};
    }

    /** WinISD `.wpr` text back to a project. The inverse of `toWprText()`, as far as a format
     *  carrying fewer box types and fields allows. */
    static fromWprText(text: string, engine: Engine): { value: OpenISDProject | null; errors: DriverError[] } {
        return winIsdProjectToOpenIsdProject(text, engine);
    }

    /** This project as `.owpr` text — openisd project JSON, the form
     *  `OpenISDProject.fromOwprText` reads back. Carries the saved state, the edited state and
     *  the name, so reopening the file restores unsaved edits exactly as they were.
     *
     *  Lossless, unlike `toWprText()`: this is openisd's own format, so there is nothing to drop
     *  and no error to report. */
    toOwprText(): string {
        return JSON.stringify(this.cloneSession(), null, 2);
    }

    /** `.owpr` text back to a project, or everything wrong with the text. The inverse of
     *  `toOwprText()`.
     *
     *  The project takes a FRESH identity: a file's contents are provenance, not a store key
     *  (QO81), so opening the same file twice yields two independently addressable projects. */
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

    /** Serialises saved and ordinary edited states for persistence. The transient what-if is absent. */
    cloneSession(): OpenISDProjectSessionJson {
        return {
            label: this.#committed().meta.name,
            saved: structuredClone(this.#saved),
            edited: this.#edited ? structuredClone(this.#edited) : null,
        };
    }


    /** Whether unsaved changes exist. `charts` (chart zoom/sweep range) is excluded: dragging a
     *  chart axis writes through the same `#slot().set()` path as every other field, but it is
     *  view state, not a change the user should be asked to save — see BACKLOG.md "Round-trip
     *  chart view state". Every other field still counts. */
    isModified(): boolean {
        if (!this.#edited) return false;
        const {charts: _editedCharts, ...editedRest} = this.#edited;
        const {charts: _savedCharts, ...savedRest} = this.#saved;
        return JSON.stringify(editedRest) !== JSON.stringify(savedRest);
    }

    // ── THE SIGNAL ────────────────────────────────────────────────────────────────────────────

    /** The drive power — WinISD's Signal-tab "Input Power". While the driver has a usable Re,
     *  `power_W = voltage_V² / Re` holds and whichever of the pair was entered last is entered;
     *  the other is calculated. Without a usable Re it is not available and cannot be entered —
     *  its dq names the missing Re. */
    get powerDrive_W(): Readable<number | null> & Entered & Calculated & Writable<number> & Clearable & Calculatable<number> & Unsolvable {
        return this.#powerDriveOver(this.#root());
    }

    /** `powerDrive_W` over `root` — `#resolve()` writes it through its direct root. */
    #powerDriveOver(root: SimpleField<OpenISDProjectJson>): DualWriteFieldImpl<number> {
        const signal = focus(root, 'signal');
        return new DualWriteFieldImpl<number>(
            () => {
                const entry = signal.value.power_W;
                if (entry === undefined) return absentCell<number>('power_W', this.#issues.signal);
                return entry.state === 'E'
                    ? enteredCell<number | null>('power_W', entry.value)
                    : calculatedCell<number | null>('power_W', entry.value);
            },
            {
                entered: (v: number) => {
                    const Re_ohm = this.#usableReOver(root);
                    if (Re_ohm === null) {
                        throw new Error('powerDrive_W cannot be entered: the driver has no usable Re_ohm yet.');
                    }
                    const Rs_ohm = this.Rs_ohm.value ?? 0;
                    if (!(v > 0 && this.#engine.driveVoltage(v, Re_ohm, Rs_ohm) >= MIN_DRIVE_VOLTAGE_V)) {
                        throw new RangeError(`powerDrive_W ${v} W drives below the 10 mV minimum voltage.`);
                    }
                    signal.set({...signal.value, power_W: enteredEntry(v), voltage_V: undefined});
                },
                // With Re known, the voltage stays as it reads and becomes the entered one.
                clear: () => {
                    const {voltage_V} = signal.value;
                    const keepVoltage = this.#usableReOver(root) !== null && voltage_V !== undefined;
                    signal.set({...signal.value, power_W: undefined, voltage_V: keepVoltage ? enteredEntry(voltage_V.value) : voltage_V});
                },
                calculated: (v: number) => signal.set({...signal.value, power_W: calculatedEntry(v)}),
                dq: (list) => writeEntryDq(focus(signal, 'power_W'), list, this.#engine),
            },
        );
    }

    /**
     * The drive voltage — the `eg` every sweep runs at. Never absent: an empty slot reads
     * `DEFAULT_DRIVE_VOLTAGE_V` as calculated, and it is never below 10 mV. Entering it needs no Re.
     * `.clear()` empties the
     * pair; the resolve then fills it back from its defaults.
     */
    get driveVoltage_V(): Readable<number> & Entered & Calculated & Writable<number> & Clearable & Calculatable<number> {
        return this.#driveVoltageOver(this.#root());
    }

    /** `driveVoltage_V` over `root` — `#resolve()` writes it through its direct root. */
    #driveVoltageOver(root: SimpleField<OpenISDProjectJson>): DefaultingFieldImpl<number> {
        const signal = focus(root, 'signal');
        return new DefaultingFieldImpl<number>(
            () => {
                const entry = signal.value.voltage_V;
                if (entry === undefined) return calculatedCell('voltage_V', DEFAULT_DRIVE_VOLTAGE_V);
                return entry.state === 'E'
                    ? enteredCell('voltage_V', entry.value)
                    : calculatedCell('voltage_V', entry.value);
            },
            {
                entered: (v: number) => {
                    if (!(v >= MIN_DRIVE_VOLTAGE_V)) throw new RangeError(`driveVoltage_V ${v} V is below the 10 mV minimum.`);
                    signal.set({...signal.value, voltage_V: enteredEntry(v), power_W: undefined});
                },
                clear: () => signal.set({...signal.value, voltage_V: undefined, power_W: undefined}),
                calculated: (v: number) => signal.set({...signal.value, voltage_V: calculatedEntry(v)}),
                dq: (list) => writeEntryDq(focus(signal, 'voltage_V'), list, this.#engine),
            },
        );
    }

    /** The driver's Re when it is a positive finite number, else null. */
    #usableReOver(root: SimpleField<OpenISDProjectJson>): number | null {
        const Re_ohm = this.#driverOver(root).specs.Re_ohm.value;
        return Re_ohm !== null && Number.isFinite(Re_ohm) && Re_ohm > 0 ? Re_ohm : null;
    }

    /**
     * The signal pair's entered-value rules the solve does not make. Re lost (a power is still
     * stored, which only a known Re allows): the voltage keeps its value as entered and the power
     * goes. Re known with nothing entered: the power is the 1 W reference, entered.
     */
    #settleSignal(signal: SimpleField<OpenISDProjectJson['signal']>, Re_ohm: number | null): void {
        const {power_W, voltage_V} = signal.value;
        if (Re_ohm === null) {
            if (power_W !== undefined) {
                signal.set({...signal.value, power_W: undefined, voltage_V: voltage_V && enteredEntry(voltage_V.value)});
            }
            return;
        }
        if (power_W?.state !== 'E' && voltage_V?.state !== 'E') {
            signal.set({...signal.value, power_W: enteredEntry(DEFAULT_DRIVE_POWER_W)});
        }
    }

    // ── ENVIRONMENT ───────────────────────────────────────────────────────────────────────────

    /** This project's air temperature, WinISD Advanced "Temperature". E when typed, else C: the
     *  app's Options → Environment value (`Engine.envDefaults()`), which the resolve also stores. */
    get envTempK(): Readable<number> & Entered & Calculated & Writable<number> & Clearable & Calculatable<number> {
        return this.#envFieldsOver(this.#slot('environment')).tempK;
    }

    /** @deprecated Use `project.envTempK.set(tempK)` instead. */
    setEnvTempK(tempK: number): void {
        this.envTempK.set(tempK);
    }

    /** This project's relative humidity, WinISD Advanced "Humidity". Stored the same way as
     *  `envTempK`. */
    get envHumidityPct(): Readable<number> & Entered & Calculated & Writable<number> & Clearable & Calculatable<number> {
        return this.#envFieldsOver(this.#slot('environment')).humidityPct;
    }

    /** @deprecated Use `project.envHumidityPct.set(humidityPct)` instead. */
    setEnvHumidityPct(humidityPct: number): void {
        this.envHumidityPct.set(humidityPct);
    }

    /** This project's atmospheric pressure, WinISD Advanced "Pressure". Stored the same way as
     *  `envTempK`. */
    get envPressurePa(): Readable<number> & Entered & Calculated & Writable<number> & Clearable & Calculatable<number> {
        return this.#envFieldsOver(this.#slot('environment')).pressurePa;
    }

    /** The three environment conditions over the environment given, each reading the app's
     *  Options → Environment value as C when not entered. The getters above pass the notifying
     *  `#slot('environment')`; `#resolve()` passes a DIRECT environment of its own, the same split
     *  `#driverOver`/`#boxOver` have. */
    #envFieldsOver(environment: SimpleField<OpenISDEnvironmentJson>): EnvironmentFields {
        const field = (key: EnvironmentCondition, fallback: () => number): EnvironmentField =>
            defaultingEntryField(focus(environment, key), key, this.#engine, fallback);
        return {
            tempK: field('temperature_K', () => this.#engine.envDefaults().tempK),
            humidityPct: field('humidity_pct', () => this.#engine.envDefaults().humidityPct),
            pressurePa: field('pressure_Pa', () => this.#engine.envDefaults().pressurePa),
        };
    }

    /** @deprecated Use `project.envPressurePa.set(pressurePa)` instead. */
    setEnvPressurePa(pressurePa: number): void {
        this.envPressurePa.set(pressurePa);
    }

    /** Which air formula this project's sweeps use — WinISD's parity model when true, OpenISD's
     *  physical CIPM-2007 model when false. Null reads as true (QO95): a new project matches
     *  WinISD out of the box. See `engine/air.ts` for the two models. */
    get envUseWinisdAirModel(): SimpleField<boolean> {
        const slot = this.#slot('environment');
        return {
            get value() { return slot.value.useWinisdAirModel ?? true; },
            set: (useWinisdAirModel: boolean) => {
                slot.set({ ...slot.value, useWinisdAirModel });
            },
        };
    }

    /** @deprecated Use `project.envUseWinisdAirModel.set(useWinisdAirModel)` instead. */
    setEnvUseWinisdAirModel(useWinisdAirModel: boolean): void {
        this.envUseWinisdAirModel.set(useWinisdAirModel);
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
    sourceLoadedQts(Rs: number): number | null {
        const ts = this.driver.specs;
        const Qms = ts.Qms.value, Qes = ts.Qes.value, Re_ohm = ts.Re_ohm.value, Qts = ts.Qts.value;
        if (Qms === null || Qes === null || Re_ohm === null || Qts === null) return null;
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
    /** The ENCLOSURE parameters alone — what `solveBoxParams` reads (`engine/params.ts`: `Vb`,
     *  `Vf`, `Sp`, `prSd`, `prCms`, `prMmd`), with no drive level and no sweep settings.
     *
     *  Separate from `#sweepParams` because the two answer different questions. Sweeping needs a
     *  drive voltage, which needs the driver's `Re`; checking that a box volume is a usable number
     *  does not. Building the validation input through the sweep's guard made an absent `Re`
     *  silence every enclosure complaint on exactly the half-finished projects that most need
     *  them. A zero drive is used only when the circuit must report its missing driver inputs;
     *  it is never returned as a simulation result.
     *
     *  An unstated volume is passed through as-is rather than short-circuiting to "no issues":
     *  "you have not sized the box" is the complaint, not a reason to stay quiet. */
    #enclosureParams(boxType: SimulatableBoxType): EnclosureParams {
        const {Vf, Sp, prSd, prCms, prMmd} = this.#boxSpecificParams(boxType);
        return {Vb: this.#boxVolume_m3(boxType), Vf, Sp, prSd, prCms, prMmd};
    }

    /** `eg` is the drive voltage the sweep runs at: `sweep()` passes the solved `driveVoltage_V`
     *  (gated non-null first), `maxCurves()` the 2.83 V reference the engine runs those curves at. */
    #sweepParams(P: FrequencyGrid, eg: number, boxType: SimulatableBoxType): SweepParams {
        const Vb = this.#boxVolume_m3(boxType);
        const box = this.box;
        let losses: {Ql?: number; Qa?: number; Qp?: number} = {};
        switch (boxType) {
            case 'sealed': losses = {Ql: box.sealed.losses.Ql.value, Qa: box.sealed.losses.Qa.value}; break;
            case 'vented': losses = {Ql: box.vented.losses.Ql.value, Qa: box.vented.losses.Qa.value, Qp: box.vented.losses.Qp.value}; break;
            case 'bandpass4': losses = {Ql: box.bandpass4.chambers.rear.losses.Ql.value, Qa: box.bandpass4.chambers.rear.losses.Qa.value}; break;
            case 'box-passive-radiator': losses = {Ql: box.passiveRadiator.losses.Ql.value, Qa: box.passiveRadiator.losses.Qa.value}; break;
        }

        return {
             Vb, eg,
            fmin: P.fmin,
            fmax: P.fmax,
            N: P.N ?? this.sweepN.value ?? undefined,
            nDrivers: this.nDrivers.value,
            wiring: this.wiring.value,
            Rs: this.Rs_ohm.value,
            circuitModel: this.circuitModel.value,
            lossMode: this.lossMode.value.value,
            Ql: losses.Ql, Qa: losses.Qa, Qp: losses.Qp,
            ...this.#boxSpecificParams(boxType),
            ...this.#airOver(this.#root()),
            useWinisdAirModel: this.#current().environment.useWinisdAirModel ?? true,
            driverAddedMass: this.driverAddedMass_kg.value,
            vcTempRise: this.vcTempRise_K.value,
            alfaVC: this.alfaVC_per_K.value,
            rgAtDriverSide: this.rgAtDriverSide.value,
            tlPortModel: this.useTransmissionLinePortModel.value,
            forceFlatResponse: this.forceFlatResponse.value,
            filters: [...this.filters.value],
        };
    }

    /** This project's box volume, WHICHEVER topology is active — `Vb` in `SweepParams` is always
     *  the driver-side chamber's own volume, sealed or the equivalent for every other topology. */
    #boxVolume_m3(boxType: SimulatableBoxType): number {
        const box = this.box;
        switch (boxType) {
            case 'sealed': return box.sealed.volume_m3.value;
            case 'vented': return box.vented.volume_m3.value;
            case 'bandpass4': return box.bandpass4.chambers.rear.volume_m3.value;
            case 'box-passive-radiator': return box.passiveRadiator.volume_m3.value;
        }
    }

    /** The fields only one box topology reads — the vent's `Sp`/`Leff` for `vented`/`bandpass4`,
     *  the passive radiator's five for `box-passive-radiator`. Geometry only (`area_m2()`,
     *  `effectiveLength_m()`), never acoustics, per this file's header ruling. */
    #boxSpecificParams(boxType: BoxType): Partial<SweepParams> {
        const box = this.box;
        switch (boxType) {
            case 'vented': {
                const Sp = box.vented.vent.totalArea_m2();
                const Leff = box.vented.vent.effectiveLength_m();
                return {Sp: Sp ?? undefined, Leff: Leff ?? undefined};
            }
            case 'bandpass4': {
                const Sp = box.bandpass4.vents.front.totalArea_m2();
                const Leff = box.bandpass4.vents.front.effectiveLength_m();
                return {Vf: box.bandpass4.chambers.front.volume_m3.value, Sp: Sp ?? undefined, Leff: Leff ?? undefined};
            }
            case 'box-passive-radiator': {
                const r = box.passiveRadiator.radiator.spec;
                return {
                    prSd: r.Sd_m2.value ?? undefined,
                    prNum: box.passiveRadiator.count.value,
                    prMmd: r.Mms_kg.value ?? undefined,
                    prMadd: box.passiveRadiator.addedMass_kg.value ?? undefined,
                    prCms: r.Cms_m_per_N.value ?? undefined,
                    prRms: r.Rms_kg_per_s.value ?? undefined,
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
    #engineBoxType(): SimulatableBoxType | null {
        return this.#engine.simulatableBoxType(this.box.boxType.value);
    }

    /** The frequency response, impedance and excursion this design produces — or the issues that
     *  stopped it, each NAMING the quantity the driver does not state. A bare null would say only
     *  "cannot simulate", which is what a caller cannot act on. `value` is null with an empty
     *  `errors` when the active topology is one the engine has no model for, or a field this
     *  project itself needs to sweep (its box volume, its drive voltage) is not yet stated. */
    sweep(P: FrequencyGrid): SweepSolveResult {
        const box = this.#engineBoxType();
        if (!box) return {values: null, issues: []};
        const boxIssues = this.#boxSweepIssues(box);
        if (boxIssues.length) return {values: null, issues: boxIssues};
        const params = this.#sweepParams(P, this.driveVoltage_V.value, box);
        return this.#engine.sweep(driverSolverParamsOf(this.driver.specs, this.#engine), this.driver.Le_H() ?? undefined, box, params);
    }

    /** The excursion- and power-limited maximum SPL curves. Reports on the same terms as `sweep`,
     *  but does not need a stated drive level: the engine runs these curves at the 2.83 V
     *  reference whatever `eg` it is handed, so that reference is passed here outright. */
    maxCurves(P: FrequencyGrid): MaxCurvesSolveResult {
        const box = this.#engineBoxType();
        if (!box) return {values: null, issues: [], driverPrerequisites: []};
        const boxIssues = this.#boxSweepIssues(box);
        if (boxIssues.length) return {values: null, issues: boxIssues, driverPrerequisites: []};
        return this.#engine.maxCurves(driverSolverParamsOf(this.driver.specs, this.#engine), this.driver.Le_H() ?? undefined, box, this.#sweepParams(P, 2.83, box));
    }

    /** The active box's own sweep-level blockers, beyond what `solveBoxParams()` already reports:
     *  a vented/bandpass4 port with neither a stated tuning nor a stated port length, or a
     *  passive-radiator mismatch target with neither a stated added mass nor a stated tuning. */
    #boxSweepIssues(box: SimulatableBoxType): readonly SweepIssue[] {
        if (box === 'vented' || box === 'bandpass4') return this.#ventSweepIssues(box);
        if (box === 'box-passive-radiator') return this.#prSweepIssues();
        return [];
    }

    /** The ACTIVE vent's cached issues (`vented`'s or `bandpass4`'s front — S2-7d2:
     *  `#resolve()` already ran `solveVent` for whichever is active, so this is a thin read, not
     *  a second solve). `solveVent`'s issues deliberately stay empty when NO target is stated at
     *  all (pinned by `engine/vent-pr-consistency.test.ts`: "no target chosen yet" is not a
     *  per-field error), so this guard adds the no-resonance case on top: a port that still has
     *  neither `tuning_goal_hz` nor `length_m` blocks the whole sweep, in the terms the sweep's `Leff`
     *  actually runs by. */
    #ventSweepIssues(box: 'vented' | 'bandpass4'): readonly VentIssue[] {
        if (this.#issues.vent.length) return this.#issues.vent;
        const b = this.box;
        const tuningCell = box === 'vented'
            ? b.vented.tuning_goal_hz
            : b.bandpass4.chambers.front.tuning_goal_hz;
        const vent = box === 'vented' ? b.vented.vent : b.bandpass4.vents.front;
        const Vb = box === 'vented'
            ? b.vented.volume_m3.value
            : b.bandpass4.chambers.front.volume_m3.value;
        const lengthCell = vent.length_m;
        if (tuningCell.value == null && lengthCell.value == null) {
            const area = vent.area_m2.value;
            const required = ['tuning_goal_hz', 'Vb_m3', 'area_m2'] as const;
            const values: Readonly<Record<typeof required[number], number | null>> =
                { tuning_goal_hz: null, Vb_m3: Vb, area_m2: area };
            const missing = required.filter((f) => !(typeof values[f] === 'number' && values[f]! > 0));
            return [{
                kind: 'missing-dependencies', target: 'length_m',
                routes: [{formula: 'length_m from tuning_goal_hz + Vb_m3 + area_m2 (Helmholtz)', required, missing}],
            }];
        }
        return [];
    }

    /** The PR equivalent of `#ventSweepIssues` — the cached issues from `#resolve()`'s own
     *  `solvePr` call. A configured radiator with NEITHER target stated still sweeps — that
     *  un-tuned state is simulable (pinned by `test/engine-wiring.test.ts` "a passive-radiator
     *  box simulates"), and `solvePr`'s own issues already stay empty on that terms, so there is
     *  deliberately no extra gate here, unlike `#ventSweepIssues`. */
    #prSweepIssues(): readonly PrIssue[] {
        return this.#issues.pr;
    }

    /** What is wrong with this project's enclosure parameters — checked BEFORE a sweep, so a
     *  caller can refuse rather than plot nonsense. Empty when nothing is wrong, and also empty
     *  (rather than a false accusation) when the topology cannot be simulated at all. */
    boxParamsIssues(): readonly BoxParamsIssue[] {
        const box = this.#engineBoxType();
        return box ? this.#engine.solveBoxParams(box, this.#enclosureParams(box)).issues : [];
    }

    /** The passband level a response is measured against — the reference every dB figure below is
     *  relative to. */
    passbandRef(spl: number[]): number {
        return this.#engine.passbandRef(spl);
    }

    /** The frequency where the response has fallen `dropDb` below its passband — F3 at 3 dB, F6 at
     *  6, and so on. Null when the response never falls that far inside the swept range. */
    rolloffFreq(sw: SweepResult, dropDb: number): number | null {
        return this.#engine.rolloffFreq(sw, dropDb);
    }

    /** A non-finite value anywhere in the response, or null. A sweep that produced NaN is a fault
     *  to report, never a curve to draw. */
    classifyFinite(sw: SweepResult): DriverError | null {
        return this.#engine.classifyFinite(sw);
    }

    /** A response clamped flat against a limit, or null — a shape that looks like a valid answer
     *  and is not. */
    classifyFlatClamp(sw: SweepResult): DriverError | null {
        return this.#engine.classifyFlatClamp(sw);
    }

    /** The same finiteness check for the max-SPL curves. */
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
    impedancePeak(sw: SweepResult | null): { Fsc: number; Qtc: number } | null {
        const Re_ohm = this.driver.specs.Re_ohm.value;
        return Re_ohm === null ? null : this.#engine.findImpedancePeak(sw, Re_ohm);
    }

    /** Start a transient what-if session from the current committed design. */
    beginWhatIf(): void {
        if (this.#whatif) return;
        this.#whatif = structuredClone(this.#committed());
        this.#notify();
    }

    /**
     * An application setting changed under this open project — re-derive and repaint.
     *
     * John, 2026-09-22: "a notification and recall and repaint is required if app level
     * changes". The engine reads its `AppSettings` at call time, so nothing is rebuilt: the
     * recall is `#resolve()` (rewriting the stored marks, such as the vented tuning's
     * plausibility) and the repaint is `#notify()`. Neither touches the DESIGN, so the project
     * does not become edited — changing what you consider plausible is not a change to the box.
     */
    appSettingsChanged(): void {
        this.#resolve();
        this.#notify();
    }

    /** Whether this project currently has a transient what-if layer. */
    isWhatIfActive(): boolean {
        return this.#whatif !== null;
    }

    /** Discard the what-if layer without touching saved or ordinary edited state. The current
     *  layer changes (back to committed) — its 'C' entries are already right, but `#resolve()`
     *  rebuilds `#issues` to match: while the what-if was active every resolve targeted IT, not
     *  the committed layer this reverts to. */
    cancelWhatIf(): void {
        if (!this.#whatif) return;
        this.#whatif = null;
        this.#resolve();
        this.#notify();
    }

    /** Reset the what-if to the committed design while keeping the session open. The current
     *  layer's CONTENT changes (a fresh clone), so `#issues` is rebuilt the same way. */
    resetWhatIf(): void {
        if (!this.#whatif) return;
        this.#whatif = structuredClone(this.#committed());
        this.#resolve();
        this.#notify();
    }

    /** Promote the edited record. A no-op when nothing has been edited. The layer swap itself
     *  changes nothing a resolve would derive differently, but rebuilding `#issues` here keeps
     *  the "always current" invariant simple to trust rather than relying on that observation. */
    save(): void {
        if (!this.#edited) return;
        this.#saved = this.#edited;
        this.#edited = null;
        this.#resolve();
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
        this.#resolve();
        this.#notify();
        return true;
    }

    // ── vent-group / PR-group solve ───────────────────────────────────────────────────────────
    //
    // FIXME(QO126, bugs/BUG_20260908_six_vent_and_pr_group_solve_methods_are_throwing_stubs.md):
    // these six answer the tuning ↔ paired-quantity relation — vent length on a vented box, added
    // cone mass on a passive-radiator one — which is NOT WIRED. `tuning_goal_hz` is a stored value no
    // calculation consumes, and the forward/inverse methods that would close the loop
    // (`Vent.tuningIn_hz`/`lengthForTuning_m`, `PassiveRadiatorBox.systemTuning_hz`/
    // `addedMassForTuning_kg`) have no callers.
    //
    // Until that relation exists, these report "nothing solved, nothing known" rather than
    // throwing: `notifyVentChanged` runs on EVERY project change (`appState.ts`), so a throw here
    // means no project can be opened at all. Doing nothing is what the app did before the
    // migration, when neither direction had a caller — this is the pre-existing behaviour, not
    // a new one, and the feature is ruled and scoped in QO126.

    /** Manual "Recalc" diagnostic safety net — force-recalculates the whole graph and notifies
     *  subscribers. Every field reads lazily, so the subscriber notification IS the force-solve:
     *  it makes every consumer re-read, which recomputes any derived cell whose sources moved. */
    recalc(): void {
        this.#notify();
    }

    /** @deprecated Use `recalc()` instead. */
    notifyVentChanged(): void {
        this.#notify();
    }


    /** The tuning the vent as built actually produces. A precomputed readout — null, with a
     *  not-available cell, when the box is not vented or the geometry is incomplete. */
    get ventAchievedFb(): Readable<number | null> & Calculated {
        return new CalculatedFieldImpl<number | null>(() => {
            if (this.box.boxType.value !== 'vented') {
                return absentCell<number>('ventAchievedFb');
            }
            const Vb = this.box.vented.volume_m3.value;
            const v = this.box.vented.vent.tuningIn_hz(Vb);
            return v === null
                ? absentCell<number>('ventAchievedFb')
                : calculatedCell<number | null>('ventAchievedFb', v);
        });
    }

    /** The highest tuning this vent can reach in this volume (its L=0 ceiling). A precomputed
     *  readout — not-available when the box is not vented or the geometry is incomplete. */
    get ventMaxReachableFb(): Readable<number | null> & Calculated {
        return new CalculatedFieldImpl<number | null>(() => {
            if (this.box.boxType.value !== 'vented') {
                return absentCell<number>('ventMaxReachableFb');
            }
            const Vb = this.box.vented.volume_m3.value;
            const Sp = this.box.vented.vent.area_m2.value;
            if (!(Vb > 0) || Sp === null) {
                return absentCell<number>('ventMaxReachableFb');
            }
            const ts = this.driver.specs;
            const count = this.box.vented.vent.count.value;
            const v = this.#engine.tuningFromLength(Vb, 0, Sp, count,
                { rho: ts.roo_kg_per_m3.value!, c: ts.c_m_per_s.value! },
                this.box.vented.vent.endCorrection_m.value);
            return calculatedCell<number | null>('ventMaxReachableFb', v);
        });
    }

    /** @deprecated Use `recalc()` instead. */
    notifyPrChanged(): void {
        this.#notify();
    }

    /** Batch multiple mutations into a single subscriber notification. */
    batch<T>(fn: () => T): T {
        return this.#listeners.batch(fn);
    }

    /** Register a listener, fired on every change to the current record and on entering or
     *  leaving the edited state. Returns an unsubscribe function. */
    subscribe(fn: () => void): () => void {
        this.#listeners.add(fn);
        return () => {
            this.#listeners.delete(fn);
        };
    }

    #notify(): void {
        this.#listeners.notify();
    }
}

class ProjectListeners {
    readonly #set = new Set<() => void>();
    #depth = 0;
    #pending = false;

    add(fn: () => void): void {
        this.#set.add(fn);
    }

    delete(fn: () => void): void {
        this.#set.delete(fn);
    }

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
export type DiscardChallenge = () => Promise<boolean>;
