
import { driverSectionProblems, radiatorSectionProblems, ProjectBuilder } from './openisdTransforms.js';
// HUMAN RULING (2026-08-26): GEOMETRY IS IN. ACOUSTICS IS OUT.
// IN: pure geometry (e.g., Vent.area_m2).
// OUT: anything involving air, compliance, resonance, or frequency. Engine handles all acoustics.
// TEST: If two implementers could disagree on the model, it belongs in the engine.

import {
    OpenISDDeviceJson,
    type DriverSpecsSection,
    type PassiveRadiatorSpecsSection,
    type VentJson,
    type SealedLossesJson,
    type VentedLossesJson,
    type CoupledSealedLossesJson,
    type CoupledVentedLossesJson,
    type CoupledVentedChamberJson,
    type OpenISDBoxJson,
    type OpenISDEnvironmentJson,
    type OpenISDProjectJson,
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
    InputField,
    ReadOnlyCalculatedField,
    type Lens,
    type RawField,
} from './cell.js';
import {newUuid} from './newUuid.js';
import {realAppContext, type AppContext} from './appContext.js';
import {type Air, type AirConstantProvider, Engine, LossMode} from '../engine/index.js';
// The DEFINING modules, never `../winisd/index.js`: the barrel also re-exports these two
// converter modules, so importing it here would pull them in whichever name was asked for.
import {openIsdDriverToWinIsdDriver, winIsdDriverTextToOpenIsdDriver} from './driverYmlToOpenisdAndWdr.js';
import {openIsdProjectToWinIsdProject, winIsdProjectToOpenIsdProject} from './openIsdProjectToWinIsdProject.js';
import type {
    BoxType, SimulatableBoxType, DriverError, DriverIssue, Filter,
    EnclosureParams, MaxCurvesResult, SweepParams, SweepResult, DriverSolverQuantities,
    SweepSolveResult, MaxCurvesSolveResult,
    SweepIssue, VentIssue, PrIssue, BoxParamsIssue,
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

type MetaFieldName =
    'brand' | 'model' | 'manufacturer' | 'provided_by' | 'comment' | 'added';

/** The names of `DriverSpecsSection`'s spec-entry fields. */
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
export interface FrequencyGrid {
    fmin?: number;
    fmax?: number;
    N?: number;
}

export interface VentedChamber {
    readonly volume_m3: InputField<number>;
    readonly tuning_hz: InputField<number>;
    readonly losses: CoupledVentedLosses;
}

export interface SealedBox {
    readonly volume_m3: RawField<number>;

    /** The resulting system Fc, calculated from the volume and the driver — null when either is
     *  not yet known. A CALCULATION, not a stored field, so a `ReadOnlyCalculatedField`, not a
     *  handle. */
    readonly resonance_hz: ReadOnlyCalculatedField<number>;

    /** The resulting system Q (Qtc), under the same loss mode as `resonance_hz` — null on the
     *  same terms. A precomputed readout. */
    readonly q_tc: ReadOnlyCalculatedField<number>;

    readonly losses: SealedLosses;
}

export interface VentedBox {
    readonly volume_m3: InputField<number>;
    /** WinISD: Fb — the target frequency, which drives `vent`'s dimensions (or vice versa). */
    readonly tuning_hz: Field<number>;
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
            readonly volume_m3: InputField<number>;
            readonly resonance_hz: ReadOnlyCalculatedField<number>;
            readonly losses: CoupledSealedLosses;
        };
        /** front = vented; its volume (`Vf`) has a Field readout like every other chamber. */
        readonly front: {
            readonly volume_m3: InputField<number>;
            readonly tuning_hz: InputField<number>;
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
    readonly volume_m3: RawField<number>;        // no solve relation
    readonly tuning_hz: Field<number>;     // WinISD: Fp
    readonly count: RawField<number>;            // no solve relation, dimensionless
    readonly addedMass_kg: Field<number>;
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
     *  a different thing from the `tuning_hz` field above: that is the target the user asked for,
     *  this is what the chosen radiator delivers in this volume. Null until a radiator is chosen
     *  and the volume is set. A precomputed readout — a `ReadOnlyCalculatedField`, not a handle.
     *  Carries the relation's DQ when the target is unreachable (an unattainable `tuning_hz`). */
    readonly systemTuning_hz: ReadOnlyCalculatedField<number>;

    /** The tuning mass this radiator needs to hit `fp_hz` in this box. Read-only WHAT-IF query —
     *  SUPERSEDED as a design entry point by the solved pair: committing a target is
     *  `tuning_hz.set(fp)` and reading `addedMass_kg`. Negative — with DQ — above the bare-cone
     *  ceiling, since that asks for mass to be taken off a cone carrying none. */
    addedMassForTuning_kg(fp_hz: number): ReadOnlyCalculatedField<number>;

    // RESOLVED (QO126): `tuning_hz` is now the writable target end of the solved pair — set fp and
    // `addedMass_kg` reads the required mass (negative + DQ when unreachable); set mass and
    // `tuning_hz` reads the achieved tuning. The pair is one relation seen from two ends, both
    // Field<number>, stating either deriving the other. The volume stays the axiomatic input.

    /** WinISD's "Fs (with added mass)" — the RADIATOR'S OWN resonance carrying whatever tuning
     *  mass is on its cone, with no box in it. A different quantity from `systemTuning_hz`,
     *  which is this radiator loaded by this box's air. Null until a radiator is chosen and
     *  states the mass and compliance the resonance is made of. Carries the relation's DQ when
     *  the pair is inconsistent (an unreachable target). */
    readonly resonanceWithAddedMass_hz: ReadOnlyCalculatedField<number>;
}

/** The enclosure: which box type is active, and every box type's own fields. All six are
 *  present at once and dormant unless `boxType` names them — the dormant-data rule expressed in
 *  the type, rather than left to callers to honour. */
export interface Box {
    readonly boxType: RawField<BoxType>;
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
    readonly Ql: RawField<number>;
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
class VentedLossesWindow implements VentedLosses {
    readonly Ql: RawField<number>;
    readonly Qa: RawField<number>;
    readonly Qp: RawField<number>;

    constructor(lens: Lens<VentedLossesJson>) {
        this.Ql = focus(lens, 'Ql');
        this.Qa = focus(lens, 'Qa');
        this.Qp = focus(lens, 'Qp');
    }
}

/** A sealed chamber coupled to another (bandpass4's rear), over its stored
 *  `CoupledSealedLossesJson` — no port (no `Qp`), coupled to the other chamber (`Qicl`). */
class CoupledSealedLossesWindow implements CoupledSealedLosses {
    readonly Ql: RawField<number>;
    readonly Qa: RawField<number>;
    readonly Qicl: RawField<number>;

    constructor(lens: Lens<CoupledSealedLossesJson>) {
        this.Ql = focus(lens, 'Ql');
        this.Qa = focus(lens, 'Qa');
        this.Qicl = focus(lens, 'Qicl');
    }
}

/** A vented chamber coupled to another (bandpass4's front, bandpass6's and ABC's rear/front),
 *  over its stored `CoupledVentedLossesJson` — has a port AND a coupling, all four factors. */
class CoupledVentedLossesWindow implements CoupledVentedLosses {
    readonly Ql: RawField<number>;
    readonly Qa: RawField<number>;
    readonly Qp: RawField<number>;
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
class VentWindow implements Vent {
    readonly #lens: Lens<VentJson>;
    readonly #engine: Engine;
    /** The project's own resolved air, read at CALL time — never a reference-condition default
     *  computed inside the engine (Driver Air Constants,
     *  `docs/plans/PLAN_DRIVER_SOLVE_AND_SWEEP_DIAGNOSTICS.md`). Sourced from the owning box's
     *  embedded driver, which already resolves `c_m_per_s`/`roo_kg_per_m3` to the project's live
     *  environment unconditionally — no second air-provider plumbing needed. */
    readonly #air: () => Air;
    readonly shape: RawField<VentShape>;
    readonly endCorrection_m: RawField<number>;

    readonly diameter_m: InputField<number>;
    readonly width_m: InputField<number>;
    readonly height_m: InputField<number>;
    readonly length_m: Field<number>;

    constructor(
        lens: Lens<VentJson>, engine: Engine, air: () => Air,
        ventContext?: { getVb: () => number | null; getTuningHz: () => number | null; clearTuningHz?: () => void },
    ) {
        this.#lens = lens;
        this.#engine = engine;
        this.#air = air;
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
                const solved = this.#engine.solveVentConsistencyGroup({
                    tuning_hz: ventContextFb ?? undefined,
                    length_m: rawL ?? undefined,
                    Vb_m3: ventContextVb ?? undefined,
                    area_m2: this.area_m2() ?? undefined,
                    endCorrection_m: this.endCorrection_m.get(),
                }, this.#air());
                const issues = this.#engine.checkVentConsistency(solved);
                const issue = issues.find(i => this.#engine.issueFields(i).includes('length_m') || this.#engine.issueFields(i).includes('tuning_hz'));
                const dq = issue ? this.#engine.issueFormula(issue) : null;

                if (rawL !== null) {
                    return createCell<number>('', rawL, 'entered', dq ? [dq] : undefined);
                }
                if (solved.length_m != null) {
                    return createCell<number>('', solved.length_m, 'calculated', dq ? [dq] : undefined);
                }
                return createCell<number>('', null, 'not-available');
            },
            {
                entered: (v: number) => rawLengthLens.set(v),
                clear: () => rawLengthLens.set(null),
                // S2-7c/d: entry-backed — length_m is a solver-set target (vent tuning/length),
                // so `calculated` reuses the same write until the record itself carries a C/E
                // flag for this slot.
                calculated: (v: number) => rawLengthLens.set(v),
                dq: () => {},
            },
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
    effectiveLength_m(): number | null {
        const length_m = this.length_m.get().value;
        const Sp = this.area_m2();
        if (length_m === null || Sp === null) return null;
        return this.#engine.ventEffectiveLength(length_m, Sp, this.#lens.get().endCorrection_m);
    }

    tuningIn_hz(volume_m3: number | null): number | null {
        const length_m = this.length_m.get().value;
        const Sp = this.area_m2();
        if (volume_m3 === null || !(volume_m3 > 0) || length_m === null || Sp === null) return null;
        return this.#engine.tuningFromLength(volume_m3, length_m, Sp, this.#air(), this.#lens.get().endCorrection_m);
    }

    lengthForTuning_m(volume_m3: number | null, fb_hz: number): number | null {
        const Sp = this.area_m2();
        if (volume_m3 === null || !(volume_m3 > 0) || !(fb_hz > 0) || Sp === null) return null;
        return this.#engine.ventLength(volume_m3, fb_hz, Sp, this.#air(), this.#lens.get().endCorrection_m);
    }
}

/** A chamber with both a volume and a tuning of its own — bandpass6's and ABC's, and the shape
 *  `VentedChamber` names in `box.ts`. */
class VentedChamberWindow {
    readonly volume_m3: InputField<number>;
    readonly tuning_hz: InputField<number>;
    readonly losses: CoupledVentedLosses;

    constructor(lens: Lens<CoupledVentedChamberJson>) {
        this.volume_m3 = requiredField(lens, 'volume_m3', 'volume_m3');
        this.tuning_hz = nullableField(lens, 'tuning_hz');
        this.losses = new CoupledVentedLossesWindow(focus(lens, 'losses'));
    }
}

/** One field of an embedded radiator's section. */
function prSpec(
    lens: Lens<OpenISDDeviceJson | null>,
    key: PassiveRadiatorFieldName,
): Field<number> {
    return new Field<number>(
        () => {
            // The record may be ABSENT (a box with no radiator chosen): reads answer
            // not-available, writes throw — the device absent-record contract.
            const record = lens.get();
            if (record === null) return createCell<number>('', null, 'not-available');
            const spec = record.specs['passive-radiator'];
            // A key ABSENT from the section means the radiator does not state that parameter.
            const v = winningValue(spec?.[key]);
            return createCell('', v, v === null ? 'not-available' : 'entered');
        },
        {
            entered: (v: number) => {
                const json = lens.get();
                if (json === null) throw new Error('radiator slot is empty');
                const spec = json.specs['passive-radiator'] ?? {};
                lens.set({
                    ...json,
                    specs: {...json.specs, 'passive-radiator': {...spec, [key]: enteredEntry(v)}},
                });
            },
            clear: () => {
                const json = lens.get();
                if (json === null) throw new Error('radiator slot is empty');
                const spec = json.specs['passive-radiator'];
                if (!spec) return;
                const {[key]: _removed, ...rest} = spec;
                lens.set({
                    ...json,
                    specs: {...json.specs, 'passive-radiator': rest},
                });
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
 * The box reaches the driver through its PUBLIC surface (`project.driver.Fs_hz.get()`), never
 * through the record — the privacy rule holds inside the module too.
 */
class OpenISDBox implements Box {
    readonly boxType: RawField<BoxType>;

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

    private constructor(
        lens: Lens<OpenISDBoxJson>,
        driver: OpenISDDriverEmbedded,
        engine: Engine,
        rs: () => number,
    ) {
        this.#driver = driver;
        this.#engine = engine;
        this.#rs = rs;
        this.boxType = focus(lens, 'boxType');

        // The project's own resolved air, read at CALL time from the embedded driver — which
        // already resolves `c_m_per_s`/`roo_kg_per_m3` to the project's live environment
        // unconditionally (Driver Air Constants, `docs/plans/PLAN_DRIVER_SOLVE_AND_SWEEP_DIAGNOSTICS.md`).
        // No second air-provider plumbing needed: every vent/PR window below reads this same
        // closure rather than each computing its own reference-condition fallback.
        const air = (): Air => {
            const d = driver.solveConsistencyGroup();
            return { rho: d.roo_kg_per_m3!, c: d.c_m_per_s! };
        };

        const sealedLens = focus(lens, 'sealed');
        const sealedVolume = focus(sealedLens, 'volume_m3');
        const sealedLosses = new SealedLossesWindow(focus(sealedLens, 'losses'));
        this.sealed = {
            volume_m3: sealedVolume,
            resonance_hz: new ReadOnlyCalculatedField<number>(() => {
                const v = this.#sealedResonance_hz(sealedVolume.get(), sealedLosses);
                return v === null
                    ? createCell<number>('resonance_hz', null, 'not-available')
                    : createCell<number>('resonance_hz', v, 'calculated');
            }),
            q_tc: new ReadOnlyCalculatedField<number>(() => {
                const v = this.#sealedQtc(sealedVolume.get(), sealedLosses);
                return v === null
                    ? createCell<number>('q_tc', null, 'not-available')
                    : createCell<number>('q_tc', v, 'calculated');
            }),
            losses: sealedLosses,
        };

        const ventedLens = focus(lens, 'vented');
        const ventedChamber = focus(ventedLens, 'chamber');
        const rawVentedTuningLens = focus(ventedChamber, 'tuning_hz');
        const rawVentLengthLens = focus(focus(ventedLens, 'vent'), 'length_m');
        const ventWindow = new VentWindow(focus(ventedLens, 'vent'), engine, air, {
            getVb: () => this.vented.volume_m3.get().value,
            getTuningHz: () => rawVentedTuningLens.get(),
            clearTuningHz: () => rawVentedTuningLens.set(null),
        });
        const ventedTuning = new Field<number>(
            () => {
                const rawFb = rawVentedTuningLens.get();
                const rawL = rawVentLengthLens.get();
                const Vb = this.vented.volume_m3.get().value;
                const solved = this.#engine.solveVentConsistencyGroup({
                    tuning_hz: rawFb ?? undefined,
                    length_m: rawL ?? undefined,
                    Vb_m3: Vb ?? undefined,
                    area_m2: ventWindow.area_m2() ?? undefined,
                    endCorrection_m: ventWindow.endCorrection_m.get(),
                }, air());
                const issues = this.#engine.checkVentConsistency(solved);
                const issue = issues.find(i => this.#engine.issueFields(i).includes('tuning_hz') || this.#engine.issueFields(i).includes('length_m'));
                const dq = issue ? this.#engine.issueFormula(issue) : null;

                if (rawFb !== null) {
                    return createCell<number>('', rawFb ?? undefined, 'entered', dq ? [dq] : undefined);
                }
                if (solved.tuning_hz != null) {
                    return createCell<number>('', solved.tuning_hz, 'calculated', dq ? [dq] : undefined);
                }
                return createCell<number>('', null, 'not-available');
            },
            {
                entered: (v: number) => rawVentedTuningLens.set(v),
                clear: () => rawVentedTuningLens.set(null),
                // S2-7c/d: entry-backed — tuning_hz is a solver-set target (vent tuning/length).
                calculated: (v: number) => rawVentedTuningLens.set(v),
                dq: () => {},
            },
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
                    resonance_hz: new ReadOnlyCalculatedField<number>(() => {
                        const v = this.#sealedResonance_hz(
                            focus(bp4Rear, 'volume_m3').get(), bp4RearLosses, LossMode.Lossless);
                        return v === null
                            ? createCell<number>('resonance_hz', null, 'not-available')
                            : createCell<number>('resonance_hz', v, 'calculated');
                    }),
                    losses: bp4RearLosses,
                },
                // front's volume is a Field, consistent with the rear chamber.
                front: {
                    volume_m3: requiredField(bp4Front, 'volume_m3', 'bandpass4.front.volume_m3'),
                    tuning_hz: nullableField(bp4Front, 'tuning_hz'),
                    losses: new CoupledVentedLossesWindow(focus(bp4Front, 'losses')),
                },
            },
            vents: {front: new VentWindow(focus(bp4, 'frontVent'), engine, air)},
        };

        const bp6 = focus(lens, 'bandpass6');
        this.bandpass6 = {
            chambers: {
                rear: new VentedChamberWindow(focus(bp6, 'rear')),
                front: new VentedChamberWindow(focus(bp6, 'front')),
            },
            vents: {
                rear: new VentWindow(focus(bp6, 'rearVent'), engine, air),
                front: new VentWindow(focus(bp6, 'frontVent'), engine, air),
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
        const rawPrAddedMassLens = focus(pr, 'addedMass_kg');
        const rawPrTuningLens = focus(pr, 'tuning_hz');
        const prAddedMass = new Field<number>(
            () => {
                const rawMass = rawPrAddedMassLens.get();
                const rawTuning = rawPrTuningLens.get();
                const Vb = prVolume.get() || this.vented.volume_m3.get().value;
                const solved = this.#engine.solvePrConsistencyGroup({
                    tuning_hz: rawTuning ?? undefined,
                    addedMass_kg: rawMass ?? undefined,
                    Vb_m3: Vb ?? undefined,
                    prMmd_kg: getRadiator()?.spec.Mms_kg.get().value ?? undefined,
                    prSd_m2: getRadiator()?.spec.Sd_m2.get().value ?? undefined,
                    prCms_m_per_N: getRadiator()?.spec.Cms_m_per_N.get().value ?? undefined,
                    prNum: focus(pr, 'count').get(),
                }, air());
                const issues = this.#engine.checkPrConsistency(solved);
                const issue = issues.find(i => this.#engine.issueFields(i).includes('addedMass_kg') || this.#engine.issueFields(i).includes('tuning_hz'));
                const dq = issue ? this.#engine.issueFormula(issue) : null;

                if (rawMass !== null) {
                    return createCell<number>('', rawMass ?? undefined, 'entered', dq ? [dq] : undefined);
                }
                if (solved.addedMass_kg != null) {
                    return createCell<number>('', solved.addedMass_kg, 'calculated', dq ? [dq] : undefined);
                }
                return createCell<number>('', null, 'not-available');
            },
            {
                entered: (v: number) => {
                    const cur = pr.get();
                    pr.set({ ...cur, addedMass_kg: v, tuning_hz: null });
                },
                clear: () => rawPrAddedMassLens.set(null),
                // S2-7c/d: entry-backed — addedMass_kg is a solver-set target (PR mass/tuning).
                calculated: (v: number) => {
                    const cur = pr.get();
                    pr.set({ ...cur, addedMass_kg: v, tuning_hz: null });
                },
                dq: () => {},
            },
        );
        const prTuning = new Field<number>(
            () => {
                const rawTuning = rawPrTuningLens.get();
                const rawMass = rawPrAddedMassLens.get();
                const Vb = prVolume.get() || this.vented.volume_m3.get().value;
                const solved = this.#engine.solvePrConsistencyGroup({
                    tuning_hz: rawTuning ?? undefined,
                    addedMass_kg: rawMass ?? undefined,
                    Vb_m3: Vb ?? undefined,
                    prMmd_kg: getRadiator()?.spec.Mms_kg.get().value ?? undefined,
                    prSd_m2: getRadiator()?.spec.Sd_m2.get().value ?? undefined,
                    prCms_m_per_N: getRadiator()?.spec.Cms_m_per_N.get().value ?? undefined,
                    prNum: focus(pr, 'count').get(),
                }, air());
                const issues = this.#engine.checkPrConsistency(solved);
                const issue = issues.find(i => this.#engine.issueFields(i).includes('tuning_hz') || this.#engine.issueFields(i).includes('addedMass_kg'));
                const dq = issue ? this.#engine.issueFormula(issue) : null;

                if (rawTuning !== null) {
                    return createCell<number>('', rawTuning ?? undefined, 'entered', dq ? [dq] : undefined);
                }
                if (solved.tuning_hz != null) {
                    return createCell<number>('', solved.tuning_hz, 'calculated', dq ? [dq] : undefined);
                }
                return createCell<number>('', null, 'not-available');
            },
            {
                entered: (v: number) => {
                    const cur = pr.get();
                    pr.set({ ...cur, tuning_hz: v, addedMass_kg: null });
                },
                clear: () => rawPrTuningLens.set(null),
                // S2-7c/d: entry-backed — tuning_hz is a solver-set target (PR mass/tuning).
                calculated: (v: number) => {
                    const cur = pr.get();
                    pr.set({ ...cur, tuning_hz: v, addedMass_kg: null });
                },
                dq: () => {},
            },
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
            get radiator() {
                return getRadiator();
            },
            systemTuning_hz: new ReadOnlyCalculatedField<number>(() => {
                const Vb = prVolume.get() || this.vented.volume_m3.get().value;
                const r = getRadiator();
                // VALUE: what this box delivers with the mass currently on the cone — an unstated
                // added mass reads as a bare cone (0): the tuning this box and radiator produce
                // together is a real figure with no mass on the cone, and `systemTuning_hz` is null
                // only when no radiator is chosen or no volume is set — the interface's own doc.
                // Solved WITHOUT the stored target, so an unreachable request never drags the value.
                const solved = this.#engine.solvePrConsistencyGroup({
                    addedMass_kg: rawPrAddedMassLens.get() ?? 0,
                    Vb_m3: Vb ?? undefined,
                    prMmd_kg: r.spec.Mms_kg.get().value ?? undefined,
                    prSd_m2: r.spec.Sd_m2.get().value ?? undefined,
                    prCms_m_per_N: r.spec.Cms_m_per_N.get().value ?? undefined,
                    prNum: focus(pr, 'count').get(),
                }, air());
                // DQ: the relation is ALSO solved with the stored target (mass left to derive), so
                // an unreachable request shows up as a negative derived mass and flags — the same
                // DQ every other field in the relation carries.
                const issues = this.#engine.checkPrConsistency(this.#engine.solvePrConsistencyGroup({
                    addedMass_kg: rawPrAddedMassLens.get() ?? undefined,
                    tuning_hz: rawPrTuningLens.get() ?? undefined,
                    Vb_m3: Vb ?? undefined,
                    prMmd_kg: r.spec.Mms_kg.get().value ?? undefined,
                    prSd_m2: r.spec.Sd_m2.get().value ?? undefined,
                    prCms_m_per_N: r.spec.Cms_m_per_N.get().value ?? undefined,
                    prNum: focus(pr, 'count').get(),
                }, air()));
                const issue = issues.find(i => this.#engine.issueFields(i).includes('addedMass_kg') || this.#engine.issueFields(i).includes('tuning_hz'));
                const dq = issue ? this.#engine.issueFormula(issue) : null;
                if (solved.systemTuning_hz != null) {
                    return createCell<number>('systemTuning_hz', solved.systemTuning_hz, 'calculated', dq ? [dq] : undefined);
                }
                return createCell<number>('systemTuning_hz', null, 'not-available');
            }),
            addedMassForTuning_kg: (fp_hz: number) => new ReadOnlyCalculatedField<number>(() => {
                const Vb = prVolume.get() || this.vented.volume_m3.get().value;
                const r = getRadiator();
                const solved = this.#engine.solvePrConsistencyGroup({
                    tuning_hz: fp_hz > 0 ? fp_hz : undefined,
                    Vb_m3: Vb ?? undefined,
                    prMmd_kg: r.spec.Mms_kg.get().value ?? undefined,
                    prSd_m2: r.spec.Sd_m2.get().value ?? undefined,
                    prCms_m_per_N: r.spec.Cms_m_per_N.get().value ?? undefined,
                    prNum: focus(pr, 'count').get(),
                }, air());
                const issues = this.#engine.checkPrConsistency(solved);
                const issue = issues.find(i => this.#engine.issueFields(i).includes('addedMass_kg'));
                const dq = issue ? this.#engine.issueFormula(issue) : null;
                if (solved.addedMass_kg != null) {
                    return createCell<number>('addedMassForTuning_kg', solved.addedMass_kg, 'calculated', dq ? [dq] : undefined);
                }
                return createCell<number>('addedMassForTuning_kg', null, 'not-available');
            }),
            resonanceWithAddedMass_hz: new ReadOnlyCalculatedField<number>(() => {
                const r = getRadiator();
                const Vb = prVolume.get() || this.vented.volume_m3.get().value;
                const solved = this.#engine.solvePrConsistencyGroup({
                    addedMass_kg: rawPrAddedMassLens.get() ?? undefined,
                    tuning_hz: rawPrTuningLens.get() ?? undefined,
                    Vb_m3: Vb ?? undefined,
                    prMmd_kg: r.spec.Mms_kg.get().value ?? undefined,
                    prSd_m2: r.spec.Sd_m2.get().value ?? undefined,
                    prCms_m_per_N: r.spec.Cms_m_per_N.get().value ?? undefined,
                    prNum: focus(pr, 'count').get(),
                }, air());
                const issues = this.#engine.checkPrConsistency(solved);
                // Free-air resonance is one of the relation's OUTPUTS: when the pair is
                // inconsistent (an unreachable target deriving negative mass) it flags with the
                // same DQ as the input, per the "redline all the fields" ruling.
                const issue = issues.find(i => this.#engine.issueFields(i).includes('addedMass_kg') || this.#engine.issueFields(i).includes('tuning_hz'));
                const dq = issue ? this.#engine.issueFormula(issue) : null;
                if (solved.resonanceWithAddedMass_hz != null) {
                    return createCell<number>('resonanceWithAddedMass_hz', solved.resonanceWithAddedMass_hz, 'calculated', dq ? [dq] : undefined);
                }
                return createCell<number>('resonanceWithAddedMass_hz', null, 'not-available');
            }),
        };
    }

    /** Takes the lens onto the project's `box` slot. The project owns that slot and builds the
     *  lens, so the box needs no reference back to the project. */
    static wrap(
        slot: Lens<OpenISDBoxJson>,
        driver: OpenISDDriverEmbedded,
        engine: Engine,
        rs: () => number,
    ): OpenISDBox {
        return new OpenISDBox(slot, driver, engine, rs);
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
                        mode: LossMode = LossMode.Default): number | null {
        if (volume_m3 === null || !(volume_m3 > 0)) return null;
        const solved = this.#driver.solveConsistencyGroup();
        const Fs_hz = solved.Fs_hz;
        const Vas = solved.Vas_m3;
        const Qts = solved.Qts;
        if (Fs_hz === undefined || Vas === undefined || Qts === undefined) return null;
        const QtsLoaded = this.#engine.sourceLoadedQts(
            solved.Qms ?? NaN, solved.Qes ?? NaN, solved.Re_ohm ?? NaN, this.#rs(), Qts);
        // `LossMode.Default` IS `WinisdLossy` — John 2026-08-27: "default is winisd = Lossy". WinISD
        // displays and saves the LOSSY figure, and it MOVES with the chamber's losses: measured, `Fr`
        // shifts 5.8 Hz for a `Ql` change at fixed volume (winisd_research FINDING-007).
        return this.#engine.sealedResonance(mode, {
            Fs: Fs_hz, Vas, Qts: QtsLoaded, Vb: volume_m3, Ql: losses.Ql.get(), Qa: losses.Qa.get(),
        }).Fsc;
    }

    /** The sealed system Q (Qtc) under the same loss mode as `#sealedResonance_hz` — the engine's
     *  `sealedResonance` returns {Fsc, Qtc} together, so the two readouts share one computation and
     *  one feed. */
    #sealedQtc(volume_m3: number | null, losses: SealedLosses,
               mode: LossMode = LossMode.Default): number | null {
        if (volume_m3 === null || !(volume_m3 > 0)) return null;
        const solved = this.#driver.solveConsistencyGroup();
        const Fs_hz = solved.Fs_hz;
        const Vas = solved.Vas_m3;
        const Qts = solved.Qts;
        if (Fs_hz === undefined || Vas === undefined || Qts === undefined) return null;
        const QtsLoaded = this.#engine.sourceLoadedQts(
            solved.Qms ?? NaN, solved.Qes ?? NaN, solved.Re_ohm ?? NaN, this.#rs(), Qts);
        return this.#engine.sealedResonance(mode, {
            Fs: Fs_hz, Vas, Qts: QtsLoaded, Vb: volume_m3, Ql: losses.Ql.get(), Qa: losses.Qa.get(),
        }).Qtc;
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
export class OpenIsdDriverSpec {
    // Thiele/Small.
    readonly Fs_hz: Field<number>;
    readonly Re_ohm: Field<number>;
    readonly Le_H: Field<number>;
    readonly fLe_hz: Field<number>;
    /** `Le·√(2π·fLe)` — the Vanderkooy lossy-inductance coefficient (`WINISD_PARITY.md:1009`,
     *  `GHIDRA_FINDINGS.md:1039`). Henries times the square root of hertz; not dimensionless. */
    readonly KLe_H_sqrtHz: Field<number>;
    readonly Znom_ohm: Field<number>;
    readonly Qts: Field<number>;
    readonly Qes: Field<number>;
    readonly Qms: Field<number>;
    readonly Vas_m3: Field<number>;
    readonly Sd_m2: Field<number>;
    readonly BL_Tm: Field<number>;
    readonly Mms_kg: Field<number>;
    readonly Cms_m_per_N: Field<number>;
    readonly Rms_kg_per_s: Field<number>;
    readonly Xmax_m: Field<number>;
    readonly Xlim_m: Field<number>;
    readonly SPL_dB: Field<number>;
    readonly Pe_W: Field<number>;
    readonly Dd_m: Field<number>;
    readonly EBP_hz: Field<number>;
    readonly numVC: Field<number>;
    /** How the coils are wired. A NAME, not WinISD's 1/2 — see `VoiceCoilWiring`. */
    readonly VCCon: Field<VoiceCoilWiring>;
    // Ordinarily derived, but WinISD lets a human type any of them, and an entered value is a fact.
    readonly Dia_m: Field<number>;
    readonly Vd_m3: Field<number>;
    readonly no: Field<number>;
    readonly SPLmax_dB: Field<number>;
    readonly SPLmaxLF_dB: Field<number>;
    readonly USPL_dB: Field<number>;
    readonly alfaVC_per_K: Field<number>;
    readonly Rt_K_per_W: Field<number>;
    readonly Ct_J_per_K: Field<number>;
    /** `Bxl/Mms` — the acceleration factor, acceleration per ampere. NOT dimensionless: WinISD's
     *  own UI prints `N/(A*kg)`, which is the same dimension as cfuttrup's `m/(s²·A)`. */
    readonly gamma_m_per_s2_A: Field<number>;
    readonly Rme_kg_per_s: Field<number>;
    /** `Bxl/√Re` — the motor power factor, newtons per square-root watt. */
    readonly Mpow_N_per_sqrtW: Field<number>;
    /** `Rme·(1 + Xmax/min(Hc, Hg))` — the motor COST factor: how powerful the motor is, penalised
     *  by how far the coil is overhung or underhung. It IS meant as an indicator of what the driver
     *  costs to build, but the unit is not currency — the ratio is dimensionless, so the figure
     *  carries `Rme`'s kg/s. WinISD's own help: "an indicator on the price of the driver, but
     *  please forget about the unit". (Formula decompiled and reproduced exactly on 10 live WinISD
     *  runs: `winisd_research/GHIDRA_FINDINGS.md` §"Four advanced-panel formulas".) */
    readonly Mcost_kg_per_s: Field<number>;
    readonly Gloss: Field<number>;
    /** The air THIS DRIVER states — the conditions its own figures were measured or computed at.
     *  Not the environment a simulation runs on; `OpenISDEnvironment` on the project is that. */
    readonly c_m_per_s: Field<number>;
    readonly roo_kg_per_m3: Field<number>;
    // Descriptive and dimensional.
    readonly Vcd_m: Field<number>;
    readonly Hg_m: Field<number>;
    readonly Hc_m: Field<number>;
    readonly freq_low_hz: Field<number>;
    readonly freq_high_hz: Field<number>;
    readonly power_peak_W: Field<number>;
    readonly weight_kg: Field<number>;
    readonly Thick_m: Field<number>;
    readonly Depth_m: Field<number>;
    readonly MagDepth_m: Field<number>;
    readonly Magnet_m: Field<number>;
    readonly Basket_m: Field<number>;
    readonly Outer_m: Field<number>;
    readonly OuterX_m: Field<number>;
    readonly OuterY_m: Field<number>;
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
            {
                entered: (v: VoiceCoilWiring) => {
                    const json = record.get();
                    const spec = json.specs[section] ?? {};
                    record.set({
                        ...json,
                        specs: {...json.specs, [section]: {...spec, VCCon: enteredWiring(v)}},
                    });
                },
                clear: () => {
                    const json = record.get();
                    const spec = json.specs[section] ?? {};
                    const {VCCon: _removed, ...rest} = spec;
                    record.set({
                        ...json,
                        specs: {...json.specs, [section]: rest},
                    });
                },
                // S2-7c/d: wiring is a discrete entered input, never solver-derived (S2-3
                // ruling) — its own live `calcVCCon()` fallback inside `readCell` above is
                // independent of the solver's write path, so `calculated` has nothing to do.
                calculated: () => {},
                dq: () => {},
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
            solved = engine.solveConsistencyGroup({
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
            {
                entered: (v: number) => {
                    const json = record.get();
                    const spec = json.specs[section] ?? {};
                    record.set({
                        ...json,
                        specs: {...json.specs, [section]: {...spec, [key]: enteredEntry(v)}},
                    });
                },
                clear: () => {
                    const json = record.get();
                    const spec = json.specs[section] ?? {};
                    const {[key]: _removed, ...rest} = spec;
                    record.set({
                        ...json,
                        specs: {...json.specs, [section]: rest},
                    });
                },
                // S2-7c/d: entry-backed — every driver T/S quantity `solveDriver` may write
                // back (S2-3) reuses the same entered write until the record itself carries a
                // C/E flag for this slot.
                calculated: (v: number) => {
                    const json = record.get();
                    const spec = json.specs[section] ?? {};
                    record.set({
                        ...json,
                        specs: {...json.specs, [section]: {...spec, [key]: enteredEntry(v)}},
                    });
                },
                dq: () => {},
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
            {
                entered: (v: number) => {
                    const json = record.get();
                    const spec = json.specs[section] ?? {};
                    record.set({
                        ...json,
                        specs: {...json.specs, [section]: {...spec, numVC: enteredEntry(v)}},
                    });
                },
                clear: () => {
                    const json = record.get();
                    const spec = json.specs[section] ?? {};
                    const {numVC: _removed, ...rest} = spec;
                    record.set({
                        ...json,
                        specs: {...json.specs, [section]: rest},
                    });
                },
                // S2-7c/d: entry-backed — solveDriver writes numVC back too (S2-3).
                calculated: (v: number) => {
                    const json = record.get();
                    const spec = json.specs[section] ?? {};
                    record.set({
                        ...json,
                        specs: {...json.specs, [section]: {...spec, numVC: enteredEntry(v)}},
                    });
                },
                dq: () => {},
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
         *  export time, now available on the driver's own getter (see `AirConstantProvider`).
         *
         *  For an EMBEDDED driver this `airProvider` is the project's own live environment
         *  (`OpenISDDriverEmbedded.wrap()`), and `OpenISDDriverEmbedded.update()` strips both
         *  fields on every write, so an embedded driver's blank `c`/`roo` always resolves here to
         *  the project's air — never a value it once imported. `solveConsistencyGroup()` is
         *  overridden on `OpenISDDriverEmbedded` too, to make that the same guarantee explicit
         *  rather than an emergent property of this fallback alone. */
        const air = (key: 'c_m_per_s' | 'roo_kg_per_m3', pick: (a: Air) => number): Field<number> => new Field<number>(
            () => {
                const stated = record.get().specs[section]?.[key];
                const v = winningValue(stated);
                return v === null
                    ? createCell('', pick(engine.airFor(airProvider())), 'calculated')
                    : createCell('', v, 'entered');
            },
            {
                entered: (v: number) => {
                    const json = record.get();
                    const spec = json.specs[section] ?? {};
                    record.set({
                        ...json,
                        specs: {...json.specs, [section]: {...spec, [key]: enteredEntry(v)}},
                    });
                },
                clear: () => {
                    const json = record.get();
                    const spec = json.specs[section] ?? {};
                    const {[key]: _removed, ...rest} = spec;
                    record.set({
                        ...json,
                        specs: {...json.specs, [section]: rest},
                    });
                },
                // S2-7c/d: entry-backed — solveDriver writes c_m_per_s/roo_kg_per_m3 back too (S2-3).
                calculated: (v: number) => {
                    const json = record.get();
                    const spec = json.specs[section] ?? {};
                    record.set({
                        ...json,
                        specs: {...json.specs, [section]: {...spec, [key]: enteredEntry(v)}},
                    });
                },
                dq: () => {},
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
        data_sources: {value: {}},
        driver_type: {value: section},
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
    #slot: Lens<OpenISDDeviceJson | null>;

    /** The one calculation surface. INJECTED, exactly as `OpenISDProject`'s is — a device reports
     *  derived figures, and every one of them comes from here and nowhere else. */
    protected readonly engine: Engine;

    readonly brand: Field<string>;
    readonly model: Field<string>;
    readonly manufacturer: Field<string>;
    readonly providedBy: Field<string>;
    readonly comment: Field<string>;
    readonly added: Field<string>;

    protected constructor(slot: Lens<OpenISDDeviceJson | null>, engine: Engine) {
        this.#slot = slot;
        this.engine = engine;
        this.brand = this.#buildMeta('brand');
        this.model = this.#buildMeta('model');
        this.manufacturer = this.#buildMeta('manufacturer');
        this.providedBy = this.#buildMeta('provided_by');
        this.comment = this.#buildMeta('comment');
        this.added = this.#buildMeta('added');
    }

    /** The catalogue URL recorded for one source role — datasheet, product page, listing page —
     *  or null when the record carries none, or there is no record. The pickers show these as
     *  row and preview links, and the bundled index carries them; a URL is provenance, not a
     *  device parameter, so it is read here rather than off `spec`. */
    dataSource(role: 'manufacturer_datasheet' | 'manufacturer_product_page' | 'manufacturer_listing_page'): string | null {
        const record = this.#slot.get();
        if (record === null) return null;
        return record.data_sources.value[role] ?? null;
    }

    #buildMeta(key: MetaFieldName): Field<string> {
        return new Field<string>(
            () => {
                // The record may be ABSENT (a box's radiator slot holds nothing yet): every field
                // reads not-available, and writing to an absent record throws — see the class doc.
                const record = this.#slot.get();
                if (record === null) return createCell<string>('', null, 'not-available');
                const stated = record[key];
                return stated === undefined
                    ? createCell<string>('', null, 'not-available')
                    : createCell<string>('', stated.value, 'entered');
            },
            {
                entered: (v: string) => {
                    const record = this.#slot.get();
                    if (record === null) throw new Error('radiator slot is empty');
                    this.#slot.set({...record, [key]: {value: v, origin: 'entered'}});
                },
                clear: () => {
                    const record = this.#slot.get();
                    if (record === null) throw new Error('radiator slot is empty');
                    this.#slot.set({...record, [key]: {value: '', origin: 'entered'}});
                },
                // S2-7c/d: metadata (brand, model, …) is never solver-derived.
                calculated: () => {},
                dq: () => {},
            },
        );
    }
}

export abstract class OpenISDDriver extends OpenISDDevice {
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
    static empty(engine: Engine): OpenISDDriver {
        return OpenISDDriverStandalone.wrap(blankDeviceRecord('woofer'), engine);
    }

    /** `.owdr` text — openisd driver YAML — back to a driver, or the reasons it could not be
     *  read. The inverse of `toOwdrText()`. */
    static fromOwdrText(text: string, engine: Engine): OpenISDDriver | string[] {
        const parsed = OpenISDDeviceJson.fromOpenisdDriverYml(text);
        if ('problems' in parsed) return parsed.problems;

        const sectionProblems = driverSectionProblems(parsed.json);
        if (sectionProblems.length > 0) return sectionProblems;
        return OpenISDDriverStandalone.wrap(parsed.json, engine);
    }

    readonly section: 'woofer' | 'tweeter';

    /** The driver's spec sections. A caller that does not care which kind of driver it holds reads
     *  `driver.spec[driver.section]`. */
    readonly spec: {
        readonly woofer: OpenIsdDriverSpec;
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

    /** Every quantity `solveConsistencyGroup()`/`checkConsistency()` feed the engine, read
     *  through `extract` — the one difference between them is which values `extract` is
     *  willing to see, not which fields exist. */
    private statedDriverQuantities(
        extract: (field: Field<number>) => number | undefined,
    ): DriverSolverQuantities {
        const spec = this.spec[this.section];
        return {
            Fs_hz: extract(spec.Fs_hz), Re_ohm: extract(spec.Re_ohm), Znom_ohm: extract(spec.Znom_ohm),
            Le_H: extract(spec.Le_H), fLe_hz: extract(spec.fLe_hz), KLe_H_sqrtHz: extract(spec.KLe_H_sqrtHz),
            Qes: extract(spec.Qes), Qms: extract(spec.Qms), Qts: extract(spec.Qts), Vas_m3: extract(spec.Vas_m3),
            Sd_m2: extract(spec.Sd_m2), Dd_m: extract(spec.Dd_m), BL_Tm: extract(spec.BL_Tm),
            Mms_kg: extract(spec.Mms_kg), Cms_m_per_N: extract(spec.Cms_m_per_N),
            Rms_kg_per_s: extract(spec.Rms_kg_per_s), EBP_hz: extract(spec.EBP_hz),
            Xmax_m: extract(spec.Xmax_m), Vd_m3: extract(spec.Vd_m3), Hc_m: extract(spec.Hc_m),
            Hg_m: extract(spec.Hg_m), Pe_W: extract(spec.Pe_W), no: extract(spec.no),
            SPL_dB: extract(spec.SPL_dB), USPL_dB: extract(spec.USPL_dB),
            SPLmax_dB: extract(spec.SPLmax_dB), SPLmaxLF_dB: extract(spec.SPLmaxLF_dB),
            Rme_kg_per_s: extract(spec.Rme_kg_per_s), Mpow_N_per_sqrtW: extract(spec.Mpow_N_per_sqrtW),
            Mcost_kg_per_s: extract(spec.Mcost_kg_per_s), gamma_m_per_s2_A: extract(spec.gamma_m_per_s2_A),
            Gloss: extract(spec.Gloss), Vcd_m: extract(spec.Vcd_m), Depth_m: extract(spec.Depth_m),
            MagDepth_m: extract(spec.MagDepth_m), Magnet_m: extract(spec.Magnet_m), DVol_m3: extract(spec.DVol_m3),
            c_m_per_s: extract(spec.c_m_per_s), roo_kg_per_m3: extract(spec.roo_kg_per_m3),
            numVC: extract(spec.numVC),
            wiring: spec.VCCon.get().value === VoiceCoilWiring.Series
                ? 'series' : 'parallel',
        };
    }

    /** Everything this driver's stated values imply, filled in. Does NOT write back — a solved
     *  value is a derivation, and the record holds only what was actually stated. */
    solveConsistencyGroup(): Readonly<DriverSolverQuantities> {
        const value = (field: Field<number>): number | undefined => field.get().value ?? undefined;
        return this.engine.solveConsistencyGroup(this.statedDriverQuantities(value));
    }

    solveDriverConsistencyGroup(): Readonly<DriverSolverQuantities> {
        return this.solveConsistencyGroup();
    }

    /** Everything this driver's stated values disagree about — an over-specified driver whose
     *  numbers cannot all be true at once — or cannot yet derive, because too few of a group
     *  (e.g. Qts's Qes/Qms pair) are stated. Empty when consistent and fully solvable.
     *
     *  ENTERED ONLY: unlike `solveConsistencyGroup()` above, `extract` here refuses a
     *  `'calculated'` cell. A calculated field always agrees with whatever produced it — feeding
     *  one back in as if it had been typed could never disagree with itself, so the group could
     *  never be reported as inconsistent no matter how wrong the user's OWN numbers are. */
    checkConsistency(): DriverIssue[] {
        const entered = (field: Field<number>): number | undefined => {
            const cell = field.get();
            return cell.state === 'entered' ? cell.value ?? undefined : undefined;
        };
        return this.engine.checkConsistency(this.statedDriverQuantities(entered));
    }

    /** Voice-coil inductance, as the record states it. Not a solver quantity — nothing derives it
     *  — so it travels to `sweep` on its own, for the impedance plot alone. */
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
    detach(): OpenISDDriverStandalone {
        return OpenISDDriverStandalone.wrap(structuredClone(this.record.get()), this.engine);
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
    update(source: OpenISDDriver): void {
        this.record.set(structuredClone(source.record.get()));
    }

    /** Make this driver a copy: its `model` states so, so `<brand>/<model>` differs from the
     *  driver it was copied from and the two stand side by side rather than one replacing the
     *  other. Called on a detached copy, before it is saved; a copy is a new record identity. */
    renameToCopy(): void {
        this.model.set('Copy of ' + (this.model.get().value ?? ''));
        const copy = this.cloneDriver();
        copy.uuid = { value: newUuid() };
        this.record.set(copy);
    }

    /** The stable identity carried by the canonical driver record. */
    uuid(): string {
        return this.record.get().uuid.value;
    }

    /** The product series this driver belongs to (e.g. "Reference Series"), or null. Descriptive
     *  only — the picker's preview text, never a simulated quantity. A `ReadOnlyCalculatedField`
     *  carrying cell provenance: entered when the record states it, not-available when it omits it. */
    get series(): ReadOnlyCalculatedField<string> {
        return new ReadOnlyCalculatedField<string>(() => {
            const v = this.record.get().series?.value ?? null;
            return createCell('series', v, v === null ? 'not-available' : 'entered');
        });
    }

    /** The manufacturer's own catalogue number, derived by the scraper from brand/model. */
    get sku(): ReadOnlyCalculatedField<string> {
        return new ReadOnlyCalculatedField<string>(() => {
            const v = this.record.get().sku.value ?? null;
            return createCell('sku', v, v === null ? 'not-available' : 'entered');
        });
    }

    /** Free-text description from the datasheet, or null. Preview text only. */
    get description(): ReadOnlyCalculatedField<string> {
        return new ReadOnlyCalculatedField<string>(() => {
            const v = this.record.get().description?.value ?? null;
            return createCell('description', v, v === null ? 'not-available' : 'entered');
        });
    }

    toOpenIsdDeviceJson(): OpenISDDeviceJson {
        return this.record.get();
    }

    /** This driver as `.owdr` text — openisd driver YAML, the form `OpenISDDriver.fromOwdrText` reads
     *  back. The serialisation stays inside the domain so the record type never crosses the
     *  package boundary. */
    toOwdrText(): string {
        return OpenISDDeviceJson.toOpenisdDriverYml(this.record.get());
    }

    /** This driver as WinISD `.wdr` text — the form `OpenISDDriver.fromWdrIniText` reads back.
     *
     *  `.wdr` states far less than an openisd record does: a field WinISD has no key for is
     *  dropped, so this is a lossy write and the round trip is not an identity. `errors` carries
     *  every such loss the converter reported. */
    toWdrIniText(engine: Engine): { value: string | null; errors: DriverError[] } {
        const errors: DriverError[] = [];
        const wdr = openIsdDriverToWinIsdDriver(this, engine, errors);
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
    /** `airProvider` defaults to the reference environment — every existing caller
     *  (`conformingRecordToDriver`, tests, `driverYmlToOpenisdAndWdr.ts`) passes none. A caller
     *  holding an app-level environment (the UI, constructing a My Drivers row) passes its own. */
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
 *  driver windows its own record instead, which is the whole difference between the two.
 *
 *  An embedded driver never carries its own stored `c`/`roo`: the project's environment is the
 *  sole source while it is embedded (human ruling 2026-09-15). `update()` strips both fields on
 *  every write, `solveConsistencyGroup()` fills them from the project's live environment, and
 *  `detach()` freezes the resolved pair back in as entered so the driver leaves with a concrete
 *  value instead of reverting to the bare reference default. */
class OpenISDDriverEmbedded extends OpenISDDriver {
    readonly #airProvider: () => AirConstantProvider;

    private constructor(
        record: Lens<OpenISDDeviceJson>,
        section: 'woofer' | 'tweeter',
        engine: Engine,
        airProvider: () => AirConstantProvider,
    ) {
        super(record, section, engine, airProvider);
        this.#airProvider = airProvider;
    }

    /** Takes the lens onto the project's `driver` slot and the project's own environment — the
     *  air this driver falls back to when it states no `c`/`roo` of its own. The project owns
     *  both slots and builds the lens/environment reader, so the driver needs no reference back
     *  to the project itself. */
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

    /** Everything this driver's stated values imply — with `c`/`roo` always replaced by the
     *  project's own live environment, unconditionally. An embedded driver's own `c`/`roo` are
     *  never consulted for this, not even as a first preference: the project is the SOLE source
     *  while a driver is embedded (human ruling 2026-09-15), so there is nothing to check —
     *  `update()` below keeps the fields themselves stripped, and this method does not bother
     *  asking them regardless. `super()` would otherwise fill a blank `c`/`roo` with the bare
     *  reference default (`solver.ts`'s own `driverC`/`driverRho` fallback); that default is
     *  overwritten here the same as an entered one would be. */
    override solveConsistencyGroup(): Readonly<DriverSolverQuantities> {
        const base = super.solveConsistencyGroup();
        const air = this.engine.airFor(this.#airProvider());
        return { ...base, c_m_per_s: air.c, roo_kg_per_m3: air.rho };
    }

    /** Adopt `source`'s whole record, then strip its `c`/`roo` — an embedded driver never keeps
     *  an imported/entered value of its own, regardless of where the write came from (a project
     *  choosing a different driver, loading a `.wdr`/`.owdr`, or the generic editor's commit path,
     *  which all route through this one method). */
    override update(source: OpenISDDriver): void {
        super.update(source);
        this.spec[this.section].c_m_per_s.clear();
        this.spec[this.section].roo_kg_per_m3.clear();
    }

    /** Leaving the project: freeze the currently-resolved `c`/`roo` in as entered on the detached
     *  copy, so the driver's behaviour does not jump the instant it is no longer bound to a
     *  project's environment. */
    override detach(): OpenISDDriverStandalone {
        const resolved = this.solveConsistencyGroup();
        const copy = super.detach();
        if (resolved.c_m_per_s !== undefined) copy.spec[copy.section].c_m_per_s.set(resolved.c_m_per_s);
        if (resolved.roo_kg_per_m3 !== undefined) copy.spec[copy.section].roo_kg_per_m3.set(resolved.roo_kg_per_m3);
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
export class OpenIsdPassiveRadiatorSpec {
    readonly Fs_hz: Field<number>;
    readonly Qms: Field<number>;
    readonly Cms_m_per_N: Field<number>;
    readonly Mms_kg: Field<number>;
    readonly Rms_kg_per_s: Field<number>;
    readonly Sd_m2: Field<number>;
    readonly Vas_m3: Field<number>;
    readonly Vd_m3: Field<number>;
    readonly Xmax_m: Field<number>;
    readonly Xlim_m: Field<number>;
    readonly Dia_m: Field<number>;
    readonly Dd_m: Field<number>;
    readonly DVol_m3: Field<number>;
    readonly Thick_m: Field<number>;
    readonly Depth_m: Field<number>;
    readonly Basket_m: Field<number>;
    readonly Outer_m: Field<number>;
    readonly OuterX_m: Field<number>;
    readonly OuterY_m: Field<number>;
    readonly weight_kg: Field<number>;

    constructor(slot: Lens<OpenISDDeviceJson | null>) {
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
    protected readonly slot: Lens<OpenISDDeviceJson | null>;

    /** Which spec section this device's record carries — the radiator's counterpart to the
     *  driver's `'woofer' | 'tweeter'`. */
    readonly section = 'passive-radiator' as const;

    /** This radiator's spec section, exactly as a driver publishes `spec[section]`. */
    readonly spec: OpenIsdPassiveRadiatorSpec;


    // Every SPEC field a radiator can state, declared and built ONCE for both kinds. An embedded
    // radiator and a standalone one differ in WHERE their record lives, never in what a radiator
    // is, so a field list that differed between them was describing nothing real. The six identity
    // fields are not here: every device has those, so they live on `OpenISDDevice`.

    protected constructor(slot: Lens<OpenISDDeviceJson | null>, engine: Engine) {
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
        if (record === null) throw new Error('cannot adopt a radiator from an absent record');
        this.slot.set({...record});
    }

    /** The stable identity carried by the canonical record — the radiator's counterpart to
     *  `OpenISDDriver.uuid()`. The bundled index lists radiators by it and favourites key on it.
     *  Throws on an empty slot: a box with no radiator chosen has no identity to give. */
    uuid(): string {
        const record = this.slot.get();
        if (record === null) throw new Error('no radiator is chosen');
        return record.uuid.value;
    }
}

class OpenISDPassiveRadiatorEmbedded extends OpenISDPassiveRadiator {

    constructor(slot: Lens<OpenISDDeviceJson | null>, engine: Engine) {
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
    detach(): OpenISDPassiveRadiatorStandalone {
        const record = this.slot.get();
        if (record === null) throw new Error('no radiator is chosen');
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
export class OpenISDPassiveRadiatorStandalone extends OpenISDPassiveRadiator {
    /** A radiator stating nothing — the counterpart of `OpenISDDriver.empty()`, and how a PR
     *  comes into existence before anyone has typed its parameters. `configurePR()` accepts it,
     *  so a box can adopt one and the editor fills it in from there. */
    static empty(engine: Engine): OpenISDPassiveRadiatorStandalone {
        return OpenISDPassiveRadiatorStandalone.wrap(blankDeviceRecord('passive-radiator'), engine);
    }

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
        super({get, set: (json) => set(json!)}, engine);
        // The refusal in `prSpec` can never fire here: `window()` rejects a record with no
        // `passive-radiator` section, so a standalone always has one.
    }

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
 * Wraps an `OpenISDProjectJson` directly and holds three records: `#saved` is the project as of the
 * last save, `#edited` is ordinary work since that save, and `#whatif` is a transient tuning copy.
 * `#edited` and `#whatif` are null until their first write/session, so an untouched project costs
 * one record.
 *
 * `driver` and `box` are live WINDOWS over slices of whichever record is current. The what-if
 * layer is never included in persistence and can only be discarded or reset to its opening copy.
 */
function freshEmbeddedDriver(json: OpenISDProjectJson, appContext: AppContext = realAppContext): OpenISDProjectJson {
    const copy = structuredClone(json);
    copy.driverEmbedding.device.uuid = {value: appContext.newId()};
    return copy;
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
     *
     * The radiator is present FROM THE START, in every project, whatever its box type. A radiator
     * slot that is null until someone calls `configurePR()` makes switching to a passive-radiator
     * box throw on the first write to a radiator field, which is the box type being unreachable
     * rather than unconfigured.
     */
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

    private constructor(saved: OpenISDProjectJson, uuid: string, engine: Engine) {
        this.#saved = saved;
        this.#uuid = uuid;
        this.#engine = engine;
    }

    /** The embedded driver — built fresh from the current record on every access, never held: the
     *  project has exactly three stored fields (`#saved`/`#edited`/`#engine`, John 2026-09-06),
     *  and every other public member is a getter mirroring the record's own structure. */
    get driver(): OpenISDDriverEmbedded {
        return OpenISDDriverEmbedded.wrap(
            focus(this.#slot('driverEmbedding'), 'device'),
            this.#engine,
            () => this.#current().environment,
        );
    }

    /** Replace the embedded driver's whole record with `source`'s — the project adopting a
     *  different driver (choosing one from the library, loading a `.wdr`/`.owdr` file).
     *  Array-level facts (`nDrivers`, `wiring`, ...) are untouched; only `driverEmbedding.device`
     *  changes. */
    setDriver(source: OpenISDDriver): void {
        this.driver.update(source.copyAsNew());
        this.#resynchronizeSignalVoltage();
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
        this.#resynchronizeSignalVoltage();
    }

    /** Keep the project's established power when its driver changes; voltage follows the new Re. */
    #resynchronizeSignalVoltage(): void {
        const power_W = this.#slot('signal').get().power_W;
        if (power_W !== null && this.driver.solveConsistencyGroup().Re_ohm !== undefined) {
            this.powerDrive_W.setProjectEstablished(power_W);
        }
    }

    /** How many units of the embedded driver this project's array uses, and how they're wired
     *  together — array-level facts, not facts about the driver itself (John 2026-09-06). */
    get nDrivers(): RawField<number> {
        return focus(this.#slot('driverEmbedding'), 'nDrivers');
    }

    get wiring(): RawField<'series' | 'parallel'> {
        return focus(this.#slot('driverEmbedding'), 'wiring');
    }

    /** Thermal power compression: coil temperature rise under drive, Kelvin. */
    get vcTempRise_K(): RawField<number> {
        return focus(this.#slot('driverEmbedding'), 'vcTempRise_K');
    }

    /** The amplifier's own source/output resistance loading this array. */
    get Rs_ohm(): RawField<number> {
        return focus(this.#slot('driverEmbedding'), 'Rs_ohm');
    }

    /** Mass this project's array adds to the driver — its own hardware, not a fact about the
     *  driver itself. */
    get driverAddedMass_kg(): RawField<number> {
        return focus(this.#slot('driverEmbedding'), 'driverAddedMass_kg');
    }

    /** This array's own voice-coil resistance temperature coefficient, SI 1/K — independent of
     *  the driver's own datasheet `driver.alfaVC_per_K` (WinISD stores these separately, and
     *  they can diverge). */
    get alfaVC_per_K(): RawField<number> {
        return focus(this.#slot('driverEmbedding'), 'alfaVC_per_K');
    }

    /** WinISD Driver tab "Standard" / "Iso-Barik" radio. */
    get loading(): RawField<'standard' | 'isobaric'> {
        return focus(this.#slot('driverEmbedding'), 'loading');
    }

    /** The box — handed the DRIVER and the ENGINE: a chamber's resonance depends on the driver it
     *  loads, and the box reads the driver through its PUBLIC field surface, never its record.
     *  Built fresh on every access, same reasoning as `driver`. */
    get box(): Box {
        return OpenISDBox.wrap(
            this.#slot('box'), this.driver, this.#engine,
            // The amplifier's source impedance loading this array — the `Rg` WinISD folds into
            // its sealed Fsc/Qtc readouts (winisd_research SEALED_FSC_MODEL.md §5).
            () => this.Rs_ohm.get(),
        );
    }

    /** What the user calls this project. A LABEL, not an identity — two projects may share one,
     *  which is exactly why `uuid()` exists. */
    get name(): RawField<string> {
        return focus(this.#slot('meta'), 'name');
    }

    /** WinISD Project tab: who made this project, and when. */
    get creator(): RawField<string> {
        return focus(this.#slot('meta'), 'creator');
    }

    get created(): RawField<string> {
        return focus(this.#slot('meta'), 'created');
    }

    get modified(): RawField<string> {
        return focus(this.#slot('meta'), 'modified');
    }

    /** WinISD Project tab: the user's own note about this project. Stored, never interpreted. The
     *  meta schema requires `description`, so the cell is always entered with a string. */
    get description(): Field<string> {
        const lens = this.#slot('meta');
        return new Field<string>(
            () => createCell('description', lens.get().description, 'entered'),
            {
                entered: (v: string) => lens.set({...lens.get(), description: v}),
                clear: () => lens.set({...lens.get(), description: ''}),
                // S2-7c/d: a project note is never solver-derived.
                calculated: () => {},
                dq: () => {},
            },
        );
    }

    /** The signal-chain filter list. */
    get filters(): RawField<readonly Filter[]> {
        return focus(this.#slot('filters'), 'filters');
    }

    /** Force-flat auto-EQ — WinISD Advanced "Force flat response". */
    get forceFlatResponse(): RawField<boolean> {
        return focus(this.#slot('advanced'), 'forceFlatResponse');
    }

    /** Model ports as a lossy transmission line instead of a lumped mass — WinISD Advanced
     *  "Use transmission line-model for port simulation". */
    get useTransmissionLinePortModel(): RawField<boolean> {
        return focus(this.#slot('advanced'), 'useTransmissionLinePortModel');
    }

    /** WinISD Advanced "Rg is at driver side" — whether the amplifier's source resistance
     *  (`Rs_ohm`) is applied per driver or once across the whole array. */
    get rgAtDriverSide(): RawField<boolean> {
        return focus(this.#slot('advanced'), 'rgAtDriverSide');
    }

    /** WinISD Advanced "Simulate voice coil inductance" — includes Le in the acoustic circuit
     *  model (gyrator) rather than just the impedance plot (winisd). */
    get circuitModel(): RawField<'winisd' | 'gyrator'> {
        return focus(this.#slot('advanced'), 'circuitModel');
    }

    /** WinISD Advanced "SPL graph is Xmax limited" — whether the SPL chart shows the
     *  Xmax-backed-off curve instead of the unclamped one. Display only. */
    get splGraphIsXmaxLimited(): RawField<boolean> {
        return focus(this.#slot('advanced'), 'splGraphIsXmaxLimited');
    }

    /** The frequency range every chart panel sweeps and is plotted over — shared across all
     *  panels (John 2026-09-07), unlike each panel's own Y-axis zoom (`yRangeForChart`/
     *  `setYRangeForChart` below). Absent means the engine's own sweep defaults. */
    get sweepFmin_hz(): RawField<number | undefined> {
        return focus(this.#slot('charts'), 'fmin_hz');
    }

    get sweepFmax_hz(): RawField<number | undefined> {
        return focus(this.#slot('charts'), 'fmax_hz');
    }

    get sweepN(): RawField<number | undefined> {
        return focus(this.#slot('charts'), 'N');
    }

    /** This project's saved Y-axis zoom for one chart (`chartId` is the UI's `ChartTabId`,
     *  carried here as a plain string per `domain/index.ts`'s "no packages/ui types" rule) —
     *  null when that panel is on auto-scale. */
    yRangeForChart(chartId: string): {ymin: number; ymax: number} | null {
        return this.#current().charts.perTab[chartId] ?? null;
    }

    /** Sets (or, passing null, clears back to auto-scale) the saved Y-axis zoom for one
     *  chart. */
    setYRangeForChart(chartId: string, range: {ymin: number; ymax: number} | null): void {
        const charts = this.#current().charts;
        const perTab = {...charts.perTab};
        if (range) perTab[chartId] = range; else delete perTab[chartId];
        this.#slot('charts').set({...charts, perTab});
    }

    /** Clears the shared sweep range and every chart's Y-axis zoom back to auto/engine
     *  defaults — the chart top bar's Reset button. */
    resetCharts(): void {
        this.#slot('charts').set({perTab: {}});
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

    /** Enter the transient what-if state from the currently committed design. */
    #ensureWhatIf(): OpenISDProjectJson {
        if (!this.#whatif) this.#whatif = structuredClone(this.#committed());
        return this.#whatif;
    }

    /** A get/set pair addressing ONE top-level field of the record. Reads whichever record is
     *  current; every write lands in the active what-if, otherwise in `#edited`.
     *
     *  The write REPLACES the record rather than mutating one, so a caller holding an earlier
     *  record sees no change through it — copy-on-write, with the copy being the spread that a
     *  write performs anyway. */
    #slot<K extends keyof OpenISDProjectJson>(key: K): Lens<OpenISDProjectJson[K]> {
        return {
            get: () => this.#current()[key],
            set: (value) => {
                const base = this.#whatif ? this.#ensureWhatIf() : this.#ensureEditing();
                if (this.#whatif) this.#whatif = {...base, [key]: value};
                else this.#edited = {...base, [key]: value};
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

    /** A DQ is reserved for a persisted pair that disagrees; absence alone is not a defect. */
    #signalConsistencyDq(): readonly string[] {
        const {power_W, voltage_V} = this.#slot('signal').get();
        const Re_ohm = this.driver.solveConsistencyGroup().Re_ohm;
        if (power_W === null || voltage_V === null || Re_ohm === undefined) return [];
        const expectedVoltage_V = this.#engine.driveVoltage(power_W, Re_ohm);
        const tolerance = Math.max(1e-9, Math.abs(expectedVoltage_V) * 1e-9);
        return Math.abs(voltage_V - expectedVoltage_V) <= tolerance
            ? []
            : [`Signal inputs are inconsistent: ${power_W} W requires ${expectedVoltage_V} V at Re=${Re_ohm} ohm, not ${voltage_V} V.`];
    }

    /**
     * N-way Field over the drive power — WinISD's Signal-tab "Input Power". One end of the
     * power↔voltage pair: `.get()` reads the stated power, or derives `V²/Re` from the stated
     * voltage when power is the end left blank; `.set(w)` derives `√(w·Re)` and stores the
     * matching voltage too, so the pair never disagrees. `.clear()` blanks POWER only — the
     * stated voltage survives and power re-derives from it. Requires a usable `Re` for a write
     * (throws, as `setPowerDrive_W` always did).
     */
    get powerDrive_W(): Field<number> {
        const slot = this.#slot('signal');
        return new Field<number>(
            () => {
                const w = slot.get().power_W;
                if (w !== null) return createCell('power_W', w, 'entered', this.#signalConsistencyDq());
                const voltage_V = slot.get().voltage_V;
                const Re_ohm = this.driver.solveConsistencyGroup().Re_ohm;
                const derived = voltage_V === null || Re_ohm === undefined ? null : this.#engine.driveFromVoltage(voltage_V, Re_ohm);
                return derived === null
                    ? createCell<number>('power_W', null, 'not-available')
                    : createCell<number>('power_W', derived, 'calculated');
            },
            {
                entered: (w: number) => {
                    const Re_ohm = this.driver.solveConsistencyGroup().Re_ohm;
                    if (Re_ohm === undefined) {
                        throw new Error('setPowerDrive_W cannot solve a voltage: the driver has no usable Re_ohm yet.');
                    }
                    const voltage_V = this.#engine.driveVoltage(w, Re_ohm);
                    slot.set({power_W: w, voltage_V});
                },
                clear: () => {
                    const voltage_V = slot.get().voltage_V;
                    const Re_ohm = this.driver.solveConsistencyGroup().Re_ohm;
                    if (voltage_V !== null && Re_ohm !== undefined) {
                        this.powerDrive_W.setProjectEstablished(this.#engine.driveFromVoltage(voltage_V, Re_ohm));
                    } else {
                        slot.set({power_W: null, voltage_V: null});
                    }
                },
                // S2-7c/d: the signal chain (T5) is out of scope for the driver/vent/PR/sealed
                // solves this step wires — never solver-derived here.
                calculated: () => {},
                dq: () => {},
            },
        );
    }

    /**
     * N-way Field over the effective drive voltage — the `eg` every sweep runs at. `.get()` reads
     * the stated voltage, or derives `√(Pin·Re)` from the stated power when voltage is the end
     * left blank; `.set(v)` derives `v²/Re` and stores both. `.clear()` blanks VOLTAGE only — the
     * stated power survives and voltage re-derives from it. Same `Re` requirement as `powerDrive_W`.
     */
    get driveVoltage_V(): Field<number> {
        const slot = this.#slot('signal');
        return new Field<number>(
            () => {
                const stored = slot.get().voltage_V;
                if (stored !== null) return createCell('voltage_V', stored, 'entered', this.#signalConsistencyDq());
                const power_W = slot.get().power_W;
                const Re_ohm = this.driver.solveConsistencyGroup().Re_ohm;
                const derived = power_W === null || Re_ohm === undefined ? null : this.#engine.driveVoltage(power_W, Re_ohm);
                return derived === null
                    ? createCell<number>('voltage_V', null, 'not-available')
                    : createCell<number>('voltage_V', derived, 'calculated');
            },
            {
                entered: (v: number) => {
                    const Re_ohm = this.driver.solveConsistencyGroup().Re_ohm;
                    if (Re_ohm === undefined) {
                        throw new Error('setDriveVoltage_V cannot solve a power: the driver has no usable Re_ohm yet.');
                    }
                    const power_W = this.#engine.driveFromVoltage(v, Re_ohm);
                    slot.set({power_W, voltage_V: v});
                },
                clear: () => {
                    const power_W = slot.get().power_W;
                    const Re_ohm = this.driver.solveConsistencyGroup().Re_ohm;
                    if (power_W !== null && Re_ohm !== undefined) {
                        this.driveVoltage_V.setProjectEstablished(this.#engine.driveVoltage(power_W, Re_ohm));
                    } else {
                        slot.set({power_W: null, voltage_V: null});
                    }
                },
                // S2-7c/d: the signal chain (T5) is out of scope for this step — never
                // solver-derived here.
                calculated: () => {},
                dq: () => {},
            },
        );
    }

    /** Field over the stated drive voltage — `signal.voltage_V`, the value stored when a drive
     *  level was entered. `.set(v)` forwards to `driveVoltage_V.set(v)` so the pair stays
     *  consistent (voltage was never writable alone). `.clear()` re-stores the pair from power. */
    get statedVoltage_V(): Field<number> {
        const slot = this.#slot('signal');
        return new Field<number>(
            () => {
                const v = slot.get().voltage_V;
                if (v !== null) return createCell('voltage_V', v, 'entered', this.#signalConsistencyDq());
                const power_W = slot.get().power_W;
                const Re_ohm = this.driver.solveConsistencyGroup().Re_ohm;
                const derived = power_W === null || Re_ohm === undefined ? null : this.#engine.driveVoltage(power_W, Re_ohm);
                return derived === null
                    ? createCell<number>('voltage_V', null, 'not-available')
                    : createCell<number>('voltage_V', derived, 'calculated');
            },
            {
                entered: (v: number) => this.driveVoltage_V.set(v),
                clear: () => {
                    const power_W = slot.get().power_W;
                    const Re_ohm = this.driver.solveConsistencyGroup().Re_ohm;
                    if (power_W !== null && Re_ohm !== undefined) {
                        this.driveVoltage_V.setProjectEstablished(this.#engine.driveVoltage(power_W, Re_ohm));
                    } else {
                        slot.set({power_W: null, voltage_V: null});
                    }
                },
                // S2-7c/d: the signal chain (T5) is out of scope for this step — never
                // solver-derived here.
                calculated: () => {},
                dq: () => {},
            },
        );
    }

    /** State the drive level as a power, in watts — solves and stores the matching voltage too
     *  (`√(Pin·Re)`), so `driveVoltage_V`/`statedVoltage_V` never disagree with what was just
     *  set. Requires the driver to have a usable `Re`; a caller with an incomplete driver cannot
     *  state a drive level in these terms yet.
     *  @deprecated Use `project.powerDrive_W.set(power_W)` instead. */
    setPowerDrive_W(power_W: number): void {
        this.powerDrive_W.set(power_W);
    }

    /** State the drive level as a voltage — solves and stores the matching power too
     *  (`V²/Re`), the inverse of `setPowerDrive_W`. Same `Re` requirement.
     *  @deprecated Use `project.driveVoltage_V.set(voltage_V)` instead. */
    setDriveVoltage_V(voltage_V: number): void {
        this.driveVoltage_V.set(voltage_V);
    }

    // ── ENVIRONMENT ───────────────────────────────────────────────────────────────────────────

    /** This project's stated air temperature, WinISD Advanced "Temperature". Null until stated —
     *  the reference value lives in `@openisd/engine` (`air.ts`), never duplicated here. */
    get envTempK(): InputField<number> {
        return nullableField(this.#slot('environment'), 'temperature_K');
    }

    /** @deprecated Use `project.envTempK.set(tempK)` instead. */
    setEnvTempK(tempK: number): void {
        this.envTempK.set(tempK);
    }

    /** This project's stated relative humidity, WinISD Advanced "Humidity". Null until stated. */
    get envHumidityPct(): InputField<number> {
        return nullableField(this.#slot('environment'), 'humidity_pct');
    }

    /** @deprecated Use `project.envHumidityPct.set(humidityPct)` instead. */
    setEnvHumidityPct(humidityPct: number): void {
        this.envHumidityPct.set(humidityPct);
    }

    /** This project's stated atmospheric pressure, WinISD Advanced "Pressure". Null until
     *  stated. */
    get envPressurePa(): InputField<number> {
        return nullableField(this.#slot('environment'), 'pressure_Pa');
    }

    /** @deprecated Use `project.envPressurePa.set(pressurePa)` instead. */
    setEnvPressurePa(pressurePa: number): void {
        this.envPressurePa.set(pressurePa);
    }

    /** Which air formula this project's sweeps use — WinISD's parity model when true, OpenISD's
     *  physical CIPM-2007 model when false. Null reads as true (QO95): a new project matches
     *  WinISD out of the box. See `engine/air.ts` for the two models. */
    get envUseWinisdAirModel(): RawField<boolean> {
        const slot = this.#slot('environment');
        return {
            get: () => slot.get().useWinisdAirModel ?? true,
            set: (useWinisdAirModel: boolean) => {
                slot.set({ ...slot.get(), useWinisdAirModel });
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
    #enclosureParams(): EnclosureParams {
        const boxType = this.box.boxType.get();
        const {Vf, Sp, prSd, prCms, prMmd} = this.#boxSpecificParams(boxType);
        return {Vb: this.#boxVolume_m3() ?? undefined, Vf, Sp, prSd, prCms, prMmd};
    }

    #sweepParams(P: FrequencyGrid): SweepParams | null {
        const Vb = this.#boxVolume_m3();
        const Re_ohm = this.driver.solveConsistencyGroup().Re_ohm;
        const {power_W, voltage_V} = this.#slot('signal').get();
        if ((power_W === null) !== (voltage_V === null)) return null;
        // WinISD sweeps at a 1 W reference until a drive level is stated — the chart always draws
        // for a simulatable driver. The stored signal stays null ("not told", and flagged with a
        // DQ on the unset input fields); only the sweep falls back. Still refuses when there is no
        // usable Re to derive the reference from.
        const eg = this.driveVoltage_V.value ?? (Re_ohm === undefined ? null : this.#engine.driveVoltage(1, Re_ohm));
         if (Vb === null) return null;

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
             Vb, eg: eg ?? 0,
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
                return {Vf: box.bandpass4.chambers.front.volume_m3.get().value ?? undefined, Sp: Sp ?? undefined, Leff: Leff ?? undefined};
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
    #engineBoxType(): SimulatableBoxType | null {
        return this.#engine.simulatableBoxType(this.box.boxType.get());
    }

    /** The frequency response, impedance and excursion this design produces — or the issues that
     *  stopped it, each NAMING the quantity the driver does not state. A bare null would say only
     *  "cannot simulate", which is what a caller cannot act on. `value` is null with an empty
     *  `errors` when the active topology is one the engine has no model for, or a field this
     *  project itself needs to sweep (its box volume, its drive voltage) is not yet stated. */
    sweep(P: FrequencyGrid): SweepSolveResult {
        const box = this.#engineBoxType();
        const params = box ? this.#sweepParams(P) : null;
        if (!box) return {values: null, issues: []};
        if (!params) return {values: null, issues: this.#engine.solveBoxParams(box, this.#enclosureParams()).issues};
        const boxIssues = this.#boxSweepIssues(box);
        if (boxIssues.length) return {values: null, issues: boxIssues};
        return this.#engine.sweep(this.driver.solveConsistencyGroup(), this.driver.Le_H(), box, params);
    }

    /** The excursion- and power-limited maximum SPL curves. Reports on the same terms as `sweep`. */
    maxCurves(P: FrequencyGrid): MaxCurvesSolveResult {
        const box = this.#engineBoxType();
        const params = box ? this.#sweepParams(P) : null;
        if (!box || !params) return {values: null, issues: [], driverPrerequisites: []};
        const boxIssues = this.#boxSweepIssues(box);
        if (boxIssues.length) return {values: null, issues: boxIssues, driverPrerequisites: []};
        return this.#engine.maxCurves(this.driver.solveConsistencyGroup(), this.driver.Le_H(), box, params);
    }

    /** The active box's own sweep-level blockers, beyond what `solveBoxParams()` already reports:
     *  a vented/bandpass4 port with neither a stated tuning nor a stated port length, or a
     *  passive-radiator mismatch target with neither a stated added mass nor a stated tuning. */
    #boxSweepIssues(box: SimulatableBoxType): readonly SweepIssue[] {
        if (box === 'vented' || box === 'bandpass4') return this.#ventSweepIssues(box);
        if (box === 'box-passive-radiator') return this.#prSweepIssues();
        return [];
    }

    /** The one air pair the vent/PR solvers need — the project's OWN resolved air, read from the
     *  embedded driver exactly the way the box's windows derive theirs (`openisdDomain.ts` ~543). */
    #sweepAir(): Air {
        const d = this.driver.solveConsistencyGroup();
        return {rho: d.roo_kg_per_m3!, c: d.c_m_per_s!};
    }

    /** Assembled exactly as the per-field vent getters do (~582), for the ACTIVE vent — `vented`'s
     *  or `bandpass4`'s front — so the sweep reports the same VentIssue a cell would. `solveVent`'s
     *  issues deliberately stay empty when NO target is stated at all (pinned by
     *  `engine/vent-pr-consistency.test.ts`: "no target chosen yet" is not a per-field error), so
     *  this guard adds the no-resonance case on top: a port that still has neither `tuning_hz` nor
     *  `length_m` after solving blocks the whole sweep, in the terms the sweep's `Leff` actually
     *  runs by. */
    #ventSweepIssues(box: 'vented' | 'bandpass4'): readonly VentIssue[] {
        const b = this.box;
        const tuningCell = box === 'vented'
            ? b.vented.tuning_hz.get()
            : b.bandpass4.chambers.front.tuning_hz.get();
        const vent = box === 'vented' ? b.vented.vent : b.bandpass4.vents.front;
        const Vb = box === 'vented'
            ? b.vented.volume_m3.get().value
            : b.bandpass4.chambers.front.volume_m3.get().value;
        const lengthCell = vent.length_m.get();
        const solved = this.#engine.solveVentConsistencyGroup({
            tuning_hz: tuningCell.state === 'entered' ? tuningCell.value ?? undefined : undefined,
            length_m: lengthCell.state === 'entered' ? lengthCell.value ?? undefined : undefined,
            Vb_m3: Vb ?? undefined,
            area_m2: vent.area_m2() ?? undefined,
            endCorrection_m: vent.endCorrection_m.get(),
        }, this.#sweepAir());
        const issues = this.#engine.checkVentConsistency(solved);
        if (issues.length) return issues;
        if (solved.tuning_hz == null && solved.length_m == null) {
            const required = ['tuning_hz', 'Vb_m3', 'area_m2'] as const;
            const missing = required.filter((f) => {
                const v = solved[f];
                return !(typeof v === 'number' && v > 0);
            });
            return [{
                kind: 'missing-dependencies', target: 'length_m',
                routes: [{formula: 'length_m from tuning_hz + Vb_m3 + area_m2 (Helmholtz)', required, missing}],
            }];
        }
        return [];
    }

    /** The PR equivalent of `#ventSweepIssues` — assembled as the per-field PR getters do (~700).
     *  `solvePr`'s issues fire exactly when a tuning/mass target is stated and one target is
     *  stated but the resonator geometry (the radiator's own `prMmd_kg`/`prSd_m2`/`prCms_m_per_N`,
     *  or `Vb_m3`) needed to derive the other is incomplete. A configured radiator with NEITHER
     *  target stated still sweeps — that un-tuned state is simulable (pinned by
     *  `test/engine-wiring.test.ts` "a passive-radiator box simulates"), so there is deliberately
     *  no both-missing gate here, unlike `#ventSweepIssues`. */
    #prSweepIssues(): readonly PrIssue[] {
        const pr = this.box.passiveRadiator;
        const r = pr.radiator;
        const tuningCell = pr.tuning_hz.get();
        const massCell = pr.addedMass_kg.get();
        const Vb = pr.volume_m3.get() || this.box.vented.volume_m3.get().value;
        const issues = this.#engine.checkPrConsistency(this.#engine.solvePrConsistencyGroup({
            tuning_hz: tuningCell.state === 'entered' ? tuningCell.value ?? undefined : undefined,
            addedMass_kg: massCell.state === 'entered' ? massCell.value ?? undefined : undefined,
            Vb_m3: Vb ?? undefined,
            prMmd_kg: r?.spec.Mms_kg.get().value ?? undefined,
            prSd_m2: r?.spec.Sd_m2.get().value ?? undefined,
            prCms_m_per_N: r?.spec.Cms_m_per_N.get().value ?? undefined,
            prNum: pr.count.get(),
        }, this.#sweepAir()));
        if (issues.length) return issues;
        return [];
    }

    /** What is wrong with this project's enclosure parameters — checked BEFORE a sweep, so a
     *  caller can refuse rather than plot nonsense. Empty when nothing is wrong, and also empty
     *  (rather than a false accusation) when the topology cannot be simulated at all. */
    boxParamsIssues(): readonly BoxParamsIssue[] {
        const box = this.#engineBoxType();
        return box ? this.#engine.solveBoxParams(box, this.#enclosureParams()).issues : [];
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
        const Re_ohm = this.driver.solveConsistencyGroup().Re_ohm;
        return Re_ohm === undefined ? null : this.#engine.findImpedancePeak(sw, Re_ohm);
    }

    /** Start a transient what-if session from the current committed design. */
    beginWhatIf(): void {
        if (this.#whatif) return;
        this.#whatif = structuredClone(this.#committed());
        this.#notify();
    }

    /** Whether this project currently has a transient what-if layer. */
    isWhatIfActive(): boolean {
        return this.#whatif !== null;
    }

    /** Discard the what-if layer without touching saved or ordinary edited state. */
    cancelWhatIf(): void {
        if (!this.#whatif) return;
        this.#whatif = null;
        this.#notify();
    }

    /** Reset the what-if to the committed design while keeping the session open. */
    resetWhatIf(): void {
        if (!this.#whatif) return;
        this.#whatif = structuredClone(this.#committed());
        this.#notify();
    }

    /** Promote the edited record. A no-op when nothing has been edited. */
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
    get ventAchievedFb(): ReadOnlyCalculatedField<number> {
        return new ReadOnlyCalculatedField<number>(() => {
            if (this.box.boxType.get() !== 'vented') {
                return createCell<number>('ventAchievedFb', null, 'not-available');
            }
            const Vb = this.box.vented.volume_m3.get().value;
            const v = this.box.vented.vent.tuningIn_hz(Vb);
            return v === null
                ? createCell<number>('ventAchievedFb', null, 'not-available')
                : createCell<number>('ventAchievedFb', v, 'calculated');
        });
    }

    /** The highest tuning this vent can reach in this volume (its L=0 ceiling). A precomputed
     *  readout — not-available when the box is not vented or the geometry is incomplete. */
    get ventMaxReachableFb(): ReadOnlyCalculatedField<number> {
        return new ReadOnlyCalculatedField<number>(() => {
            if (this.box.boxType.get() !== 'vented') {
                return createCell<number>('ventMaxReachableFb', null, 'not-available');
            }
            const Vb = this.box.vented.volume_m3.get().value;
            const Sp = this.box.vented.vent.area_m2();
            if (Vb === null || !(Vb > 0) || Sp === null) {
                return createCell<number>('ventMaxReachableFb', null, 'not-available');
            }
            const resolvedAir = this.driver.solveConsistencyGroup();
            const v = this.#engine.tuningFromLength(Vb ?? undefined, 0, Sp,
                { rho: resolvedAir.roo_kg_per_m3!, c: resolvedAir.c_m_per_s! },
                this.box.vented.vent.endCorrection_m.get());
            return v === null
                ? createCell<number>('ventMaxReachableFb', null, 'not-available')
                : createCell<number>('ventMaxReachableFb', v, 'calculated');
        });
    }

    /** Whether the stated tuning is beyond what this vent can reach. Derived from the tuning
     *  cell's DQ — the consistency check is the single source of truth; this is a presentation
     *  aggregation of it, never a second copy of the negative-length arithmetic. False (calculated)
     *  when the box is not vented or nothing relevant is stated. */
    get ventTargetUnreachable(): ReadOnlyCalculatedField<boolean> {
        return new ReadOnlyCalculatedField<boolean>(() => {
            if (this.box.boxType.get() !== 'vented') {
                return createCell<boolean>('ventTargetUnreachable', false, 'calculated');
            }
            const fbCell = this.box.vented.tuning_hz.get();
            return createCell<boolean>('ventTargetUnreachable', fbCell.state === 'entered' && fbCell.dq().length > 0, 'calculated');
        });
    }

    /** @deprecated Use `recalc()` instead. */
    notifyPrChanged(): void {
        this.#notify();
    }


    solveDriverConsistencyGroup(): Readonly<DriverSolverQuantities> {
        return this.driver.solveDriverConsistencyGroup();
    }

    /** Whether the stated tuning is beyond what this radiator can reach. Derived from the tuning
     *  cell's DQ — the consistency check is the single source of truth (the same flag that
     *  redlines the entered Fp as the cause and its derived outputs as symptoms); this is a
     *  presentation aggregation of it, never a second copy of the negative-mass arithmetic. False
     *  on the same terms as `ventTargetUnreachable`. */
    get prTargetUnreachable(): ReadOnlyCalculatedField<boolean> {
        return new ReadOnlyCalculatedField<boolean>(() => {
            if (this.box.boxType.get() !== 'box-passive-radiator') {
                return createCell<boolean>('prTargetUnreachable', false, 'calculated');
            }
            const fpCell = this.box.passiveRadiator.tuning_hz.get();
            return createCell<boolean>('prTargetUnreachable', fpCell.state === 'entered' && fpCell.dq().length > 0, 'calculated');
        });
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
