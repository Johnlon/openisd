import type {
    Air, AirEnvironment, BoxParamsIssue, Engine, MaxCurvesSolveResult, PrIssue, SimulatableBoxType,
    SweepDriver, SweepIssue, SweepParams, SweepSolveResult, VentIssue,
} from '../../engine/index.js';
import type { Filter, EnclosureParams } from '../../engine/index.js';
import type { LossMode } from '../../fields/lossMode.js';
import { CalculatedFieldImpl, absentCell, calculatedCell } from '../cell.js';
import type { Calculated, Readable, SimpleField } from '../cell.js';
import type { Box } from '../box/box.js';
import type { Bandpass6Box } from '../box/bandpass6Box.js';
import type { FrequencyGrid } from '../box/frequencyGrid.js';
import { engineCircuitModel } from '../driver/engineCircuitModel.js';
import type { OpenISDDriverEmbedded } from '../driver/openISDDriverEmbedded.js';

/** Everything the engine's sweep/max-curves/enclosure-check needs beyond the frequency grid,
 *  read off THIS project — PLAN_openisdproject_split.md module 8. A structural interface, not
 *  the concrete `OpenISDProject`, so this module never imports it back (avoids the cycle
 *  `OpenISDProject` -> `projectSweep` -> `OpenISDProject` would make). `OpenISDProject` builds a
 *  fresh one on every sweep/maxCurves/boxParamsIssues/ventAchievedFb/ventMaxReachableFb call, the
 *  same "built fresh" reasoning `driver`/`box` already follow.
 *
 *  `air`/`airEnvironment`/`useWinisdAirModel`/`driveVoltage_V` are already-read VALUES, not
 *  fields or closures: the original private methods read them once per call too (`this.#air(this
 *  .#root())` inside `#sweepParams`/`sweep`/`maxCurves`/`ventMaxReachableFb`), so reading them
 *  once while building the source changes nothing. */
export interface ProjectSweepSource {
    readonly driver: OpenISDDriverEmbedded;
    readonly box: Box;
    readonly nDrivers: SimpleField<number>;
    readonly wiring: SimpleField<'series' | 'parallel'>;
    readonly Rs_ohm: SimpleField<number>;
    readonly circuitModel: SimpleField<'winisd' | 'gyrator' | 'winisdGyrator'>;
    readonly winisdDriverModel: SimpleField<boolean>;
    readonly winisdVaModel: SimpleField<boolean>;
    readonly winisdDriverCountModel: SimpleField<boolean>;
    readonly winisdFlatModel: SimpleField<boolean>;
    readonly lossMode: SimpleField<LossMode>;
    readonly rgAtDriverSide: SimpleField<boolean>;
    readonly useTransmissionLinePortModel: SimpleField<boolean>;
    readonly forceFlatResponse: SimpleField<boolean>;
    readonly filters: SimpleField<readonly Filter[]>;
    readonly driverAddedMass_kg: SimpleField<number>;
    readonly vcTempRise_K: SimpleField<number>;
    readonly loading: SimpleField<'standard' | 'isobaric'>;
    readonly alfaVC_per_K: SimpleField<number>;
    readonly sweepN: SimpleField<number | null>;
    readonly driveVoltage_V: number;
    readonly airEnvironment: AirEnvironment;
    readonly useWinisdAirModel: boolean;
    readonly air: Air;
    readonly engine: Engine;
    readonly ventIssues: readonly VentIssue[];
    readonly prIssues: readonly PrIssue[];
}

/** The ENCLOSURE parameters alone — what `solveBoxParams` reads (`engine/params.ts`: `Vb`, `Vf`,
 *  `Sp`, `prSd`, `prCms`, `prMmd`), with no drive level and no sweep settings. See
 *  `boxParamsIssuesOf` for why this is separate from `sweepParamsOf`. */
function enclosureParamsOf(source: ProjectSweepSource, boxType: SimulatableBoxType): EnclosureParams {
    const {Vf, Sp, prSd, prCms, prMmd} = boxSpecificParamsOf(source, boxType);
    return {Vb: boxVolume_m3Of(source, boxType), Vf, Sp, prSd, prCms, prMmd};
}

/** `eg` is the drive voltage the sweep runs at: `sweepOf` passes the solved `driveVoltage_V`
 *  (gated non-null first), `maxCurvesOf` the 2.83 V reference the engine runs those curves at. */
function sweepParamsOf(source: ProjectSweepSource, P: FrequencyGrid, eg: number, boxType: SimulatableBoxType): SweepParams {
    const Vb = boxVolume_m3Of(source, boxType);
    const box = source.box;
    let losses: {Ql?: number; Qa?: number; Qp?: number} = {};
    switch (boxType) {
        case 'sealed': losses = {Ql: box.sealed.losses.Ql.value, Qa: box.sealed.losses.Qa.value}; break;
        case 'vented': losses = {Ql: box.vented.losses.Ql.value, Qa: box.vented.losses.Qa.value, Qp: box.vented.losses.Qp.value}; break;
        case 'bandpass4': losses = {Ql: box.bandpass4.chambers.rear.losses.Ql.value, Qa: box.bandpass4.chambers.rear.losses.Qa.value}; break;
        case 'box-passive-radiator': losses = {Ql: box.passiveRadiator.losses.Ql.value, Qa: box.passiveRadiator.losses.Qa.value}; break;
        // Same "rear chamber feeds the shared slot" convention as `bandpass4` above — the
        // `winisd-lossy` branch never reads this shared `Ql`/`Qa` at all (it reads each
        // chamber's own `Qlr`/`Qar`/`Qlf`/`Qaf` off `boxSpecificParamsOf` below); this only
        // backstops `lossless`/`conventional-lossy`.
        case 'bandpass6': losses = {Ql: box.bandpass6.chambers.rear.losses.Ql.value, Qa: box.bandpass6.chambers.rear.losses.Qa.value}; break;
        case 'abc': losses = {Ql: box.abc.chambers.rear.losses.Ql.value, Qa: box.abc.chambers.rear.losses.Qa.value}; break;
    }

    return {
         Vb, eg,
        fmin: P.fmin,
        fmax: P.fmax,
        N: P.N ?? source.sweepN.value ?? undefined,
        nDrivers: source.nDrivers.value,
        wiring: source.wiring.value,
        Rs: source.Rs_ohm.value,
        circuitModel: engineCircuitModel(source.circuitModel.value, source.winisdDriverModel.value),
        winisdVaModel: source.winisdVaModel.value,
        winisdDriverCountModel: source.winisdDriverCountModel.value,
        winisdFlatModel: source.winisdFlatModel.value,
        lossMode: source.lossMode.value.value,
        Ql: losses.Ql, Qa: losses.Qa, Qp: losses.Qp,
        ...boxSpecificParamsOf(source, boxType),
        ...source.airEnvironment,
        useWinisdAirModel: source.useWinisdAirModel,
        driverAddedMass: source.driverAddedMass_kg.value,
        vcTempRise: source.vcTempRise_K.value,
        loading: source.loading.value,
        alfaVC: source.alfaVC_per_K.value,
        rgAtDriverSide: source.rgAtDriverSide.value,
        tlPortModel: source.useTransmissionLinePortModel.value,
        forceFlatResponse: source.forceFlatResponse.value,
        filters: [...source.filters.value],
    };
}

/** This project's box volume, WHICHEVER topology is active — `Vb` in `SweepParams` is always the
 *  driver-side chamber's own volume, sealed or the equivalent for every other topology. */
function boxVolume_m3Of(source: ProjectSweepSource, boxType: SimulatableBoxType): number {
    const box = source.box;
    switch (boxType) {
        case 'sealed': return box.sealed.volume_m3.value;
        case 'vented': return box.vented.volume_m3.value;
        case 'bandpass4': return box.bandpass4.chambers.rear.volume_m3.value;
        case 'box-passive-radiator': return box.passiveRadiator.volume_m3.value;
        case 'bandpass6': return box.bandpass6.chambers.rear.volume_m3.value;
        case 'abc': return box.abc.chambers.rear.volume_m3.value;
    }
}

/** The fields only one box topology reads — the vent's `Sp`/`Leff` for `vented`/`bandpass4`, the
 *  passive radiator's five for `box-passive-radiator`. Geometry only (`area_m2()`,
 *  `effectiveLength_m()`), never acoustics, per the original file's header ruling. */
function boxSpecificParamsOf(source: ProjectSweepSource, boxType: SimulatableBoxType): Partial<SweepParams> {
    const box = source.box;
    switch (boxType) {
        case 'vented': {
            const Sp = box.vented.vent.totalArea_m2();
            const Leff = box.vented.vent.effectiveLength_m();
            // Fb for circuit.ts's winisd-lossy port mass (Map = 1/(ωb²·Cab), never from Leff).
            // Null only when the vent's tuning ↔ length pair is itself unsolved, which
            // ventSweepIssuesOf already refuses the sweep over before this is read.
            const Fb = box.vented.tuning_goal_hz.value;
            const portEndCorrection_m = box.vented.vent.endCorrectionLength_m() ?? undefined;
            return {Sp: Sp ?? undefined, Leff: Leff ?? undefined, Fb: Fb ?? undefined, portEndCorrection_m};
        }
        case 'bandpass4': {
            const Sp = box.bandpass4.vents.front.totalArea_m2();
            const Leff = box.bandpass4.vents.front.effectiveLength_m();
            const rear = box.bandpass4.chambers.rear.losses;
            const front = box.bandpass4.chambers.front;
            // circuit.ts's bandpass4 `winisd-lossy` branch reads each chamber's OWN losses and
            // the front's own tuning — never the shared Ql/Qa/Qp above (engine/types.ts
            // `SweepParams.Qlr` doc, bugs/archive/BUG_20260927_bandpass4-box-not-winisd-form.md).
            return {
                Vf: front.volume_m3.value, Sp: Sp ?? undefined, Leff: Leff ?? undefined,
                Qlr: rear.Ql.value, Qar: rear.Qa.value, Qiclfr: rear.Qicl.value,
                Qlf: front.losses.Ql.value, Qaf: front.losses.Qa.value, Qpf: front.losses.Qp.value,
                Ff: front.tuning_goal_hz.value ?? undefined,
                portEndCorrection_m: box.bandpass4.vents.front.endCorrectionLength_m() ?? undefined,
            };
        }
        case 'box-passive-radiator': {
            const r = box.passiveRadiator.radiator.spec;
            // Fr for circuit.ts's winisd-lossy Ral/Raa (fixed at the box's own tuning, never
            // per-frequency). Null only when the volume/radiator/tuning-pair is itself unsolved,
            // which prSweepIssuesOf already refuses the sweep over before this is read.
            const Fr = box.passiveRadiator.systemTuning_hz.value;
            return {
                prSd: r.Sd_m2.value ?? undefined,
                prNum: box.passiveRadiator.count.value,
                prMmd: r.Mms_kg.value ?? undefined,
                prMadd: box.passiveRadiator.addedMass_kg.value ?? undefined,
                prCms: r.Cms_m_per_N.value ?? undefined,
                prRms: r.Rms_kg_per_s.value ?? undefined,
                Fr: Fr ?? undefined,
            };
        }
        case 'bandpass6': {
            const rear = box.bandpass6.chambers.rear;
            const front = box.bandpass6.chambers.front;
            const Sp = box.bandpass6.vents.front.totalArea_m2();
            const Spr = box.bandpass6.vents.rear.totalArea_m2();
            const ends = ventEndCorrections_m(box.bandpass6.vents);
            // Same "each chamber's own losses, never the shared Ql/Qa/Qp" reasoning as
            // `bandpass4` above — `Bandpass6Box`'s `winisd-lossy` branch reads these directly
            // (`SweepParams.Qpr`'s own doc).
            return {
                Vf: front.volume_m3.value, Sp: Sp ?? undefined, Spr: Spr ?? undefined,
                Qlr: rear.losses.Ql.value, Qar: rear.losses.Qa.value, Qpr: rear.losses.Qp.value,
                Qiclfr: rear.losses.Qicl.value,
                Qlf: front.losses.Ql.value, Qaf: front.losses.Qa.value, Qpf: front.losses.Qp.value,
                Fr: rear.tuning_goal_hz.value ?? undefined, Ff: front.tuning_goal_hz.value ?? undefined,
                ...ends,
            };
        }
        case 'abc': {
            const rear = box.abc.chambers.rear;
            const front = box.abc.chambers.front;
            const Sp = box.abc.vents.front.totalArea_m2();
            const Spr = box.abc.vents.rear.totalArea_m2();
            const SpIntra = box.abc.vents.intra.totalArea_m2();
            const LeffIntra = box.abc.vents.intra.effectiveLength_m();
            const ends = ventEndCorrections_m(box.abc.vents);
            return {
                Vf: front.volume_m3.value, Sp: Sp ?? undefined, Spr: Spr ?? undefined,
                Qlr: rear.losses.Ql.value, Qar: rear.losses.Qa.value, Qpr: rear.losses.Qp.value,
                Qiclfr: rear.losses.Qicl.value,
                Qlf: front.losses.Ql.value, Qaf: front.losses.Qa.value, Qpf: front.losses.Qp.value,
                Fr: rear.tuning_goal_hz.value ?? undefined, Ff: front.tuning_goal_hz.value ?? undefined,
                SpIntra: SpIntra ?? undefined, LeffIntra: LeffIntra ?? undefined,
                ...ends,
            };
        }
        // sealed has no vent or radiator.
        case 'sealed':
            return {};
    }
}

/** Which of the engine's simulable topologies this project is, or null — see the original
 *  `OpenISDProject.#engineBoxType`'s doc comment for why null is not a failure. */
function engineBoxTypeOf(source: ProjectSweepSource): SimulatableBoxType | null {
    return source.engine.box.simulatableBoxType(source.box.boxType.value);
}

/** The front and rear vents' end corrections, for WinISD's transmission-line port model. */
function ventEndCorrections_m(vents: Bandpass6Box['vents']): Pick<SweepParams, 'portEndCorrection_m' | 'rearPortEndCorrection_m'> {
    return {
        portEndCorrection_m: vents.front.endCorrectionLength_m() ?? undefined,
        rearPortEndCorrection_m: vents.rear.endCorrectionLength_m() ?? undefined,
    };
}

/** One port's own "neither tuning nor length stated" check — the body `ventSweepIssuesOf` used
 *  to run inline for `vented`'s single port, generalised so `bandpass6`/`abc` can run it once per
 *  chamber (each of their two ports is a `VentedChamber`/`Vent` pair on the SAME terms as
 *  `vented`'s own). `solveVent`'s issues deliberately stay empty when NO target is stated at all
 *  (pinned by `engine/vent-pr-consistency.test.ts`: "no target chosen yet" is not a per-field
 *  error), so this guard adds the no-resonance case on top: a port that still has neither
 *  `tuning_goal_hz` nor `length_m` blocks the whole sweep, in the terms the sweep's `Leff`
 *  actually runs by. */
function portTuningIssuesOf(
    engine: ProjectSweepSource['engine'], tuningCell: {value: number | null}, vent: Box['vented']['vent'], Vb: number | null,
): readonly VentIssue[] {
    if (tuningCell.value != null || vent.length_m.value != null) return [];
    const area = vent.area_m2.value;
    const required = ['tuning_goal_hz', 'Vb_m3', 'area_m2'] as const;
    const values: Readonly<Record<typeof required[number], number | null>> =
        { tuning_goal_hz: null, Vb_m3: Vb, area_m2: area };
    const missing = required.filter((f) => !(typeof values[f] === 'number' && values[f]! > 0));
    return [engine.issues.missingDependencies('length_m',
        [{formula: 'length_m from tuning_goal_hz + Vb_m3 + area_m2 (Helmholtz)', required, missing}])];
}

/** The ACTIVE vent(s)' cached issues (S2-7d2: `#resolve()` already ran `solveVent` for whichever
 *  is active, so this is a thin read, not a second solve) plus `portTuningIssuesOf`'s own guard —
 *  `vented`'s single port, `bandpass4`'s front, or BOTH of `bandpass6`/`abc`'s (their rear port is
 *  vented too, unlike `bandpass4`'s sealed rear chamber). */
function ventSweepIssuesOf(source: ProjectSweepSource, box: 'vented' | 'bandpass4' | 'bandpass6' | 'abc'): readonly VentIssue[] {
    if (source.ventIssues.length) return source.ventIssues;
    const b = source.box;
    switch (box) {
        case 'vented':
            return portTuningIssuesOf(source.engine, b.vented.tuning_goal_hz, b.vented.vent, b.vented.volume_m3.value);
        case 'bandpass4':
            return portTuningIssuesOf(source.engine, b.bandpass4.chambers.front.tuning_goal_hz,
                b.bandpass4.vents.front, b.bandpass4.chambers.front.volume_m3.value);
        case 'bandpass6':
        case 'abc': {
            const twoChamber = box === 'bandpass6' ? b.bandpass6 : b.abc;
            return [
                ...portTuningIssuesOf(source.engine, twoChamber.chambers.rear.tuning_goal_hz,
                    twoChamber.vents.rear, twoChamber.chambers.rear.volume_m3.value),
                ...portTuningIssuesOf(source.engine, twoChamber.chambers.front.tuning_goal_hz,
                    twoChamber.vents.front, twoChamber.chambers.front.volume_m3.value),
            ];
        }
    }
}

/** The PR equivalent of `ventSweepIssuesOf` — the cached issues from `#resolve()`'s own
 *  `solvePr` call. A configured radiator with NEITHER target stated still sweeps — that un-tuned
 *  state is simulable (pinned by `test/engine-wiring.test.ts` "a passive-radiator box
 *  simulates"), and `solvePr`'s own issues already stay empty on that terms, so there is
 *  deliberately no extra gate here, unlike `ventSweepIssuesOf`. */
function prSweepIssuesOf(source: ProjectSweepSource): readonly PrIssue[] {
    return source.prIssues;
}

/** The active box's own sweep-level blockers, beyond what `solveBoxParams()` already reports: a
 *  vented/bandpass4 port with neither a stated tuning nor a stated port length, or a
 *  passive-radiator mismatch target with neither a stated added mass nor a stated tuning. */
function boxSweepIssuesOf(source: ProjectSweepSource, box: SimulatableBoxType): readonly SweepIssue[] {
    if (box === 'vented' || box === 'bandpass4' || box === 'bandpass6' || box === 'abc') {
        return ventSweepIssuesOf(source, box);
    }
    if (box === 'box-passive-radiator') return prSweepIssuesOf(source);
    return [];
}

/** A sweep the engine runs as given: `SimulationEngine.sweep(driver, Le_H, box, sweep)` and
 *  `maxCurves(driver, Le_H, box, maxCurves)`. Plain data, so it crosses a Worker boundary. */
export interface SweepJob {
    readonly driver: SweepDriver;
    readonly Le_H: number | undefined;
    readonly box: SimulatableBoxType;
    readonly sweep: SweepParams;
    /** At the 2.83 V reference: the engine runs max curves there whatever `eg` it is handed. */
    readonly maxCurves: SweepParams;
}

/** The job this project's sweep runs, or the issues that stop it. `issues` is empty when the
 *  topology is one the engine has no model for. */
export type SweepPlan =
    | { readonly kind: 'ready'; readonly job: SweepJob }
    | { readonly kind: 'blocked'; readonly issues: readonly SweepIssue[] };

export function sweepPlanOf(source: ProjectSweepSource, P: FrequencyGrid): SweepPlan {
    const box = engineBoxTypeOf(source);
    if (!box) return {kind: 'blocked', issues: []};
    const boxIssues = boxSweepIssuesOf(source, box);
    if (boxIssues.length) return {kind: 'blocked', issues: boxIssues};
    return {kind: 'ready', job: {
        driver: source.driver.specs.sweepDriver(source.winisdDriverModel.value, source.air),
        Le_H: source.driver.specs.Le_H.value ?? undefined,
        box,
        sweep: sweepParamsOf(source, P, source.driveVoltage_V, box),
        maxCurves: sweepParamsOf(source, P, 2.83, box),
    }};
}

/** The frequency response, impedance and excursion this design produces — or the issues that
 *  stopped it, each NAMING the quantity the driver does not state. A bare null would say only
 *  "cannot simulate", which is what a caller cannot act on. `value` is null with an empty
 *  `errors` when the active topology is one the engine has no model for, or a field this project
 *  itself needs to sweep (its box volume, its drive voltage) is not yet stated. */
export function sweepOf(source: ProjectSweepSource, P: FrequencyGrid): SweepSolveResult {
    const plan = sweepPlanOf(source, P);
    if (plan.kind === 'blocked') return {values: null, issues: [...plan.issues]};
    const {driver, Le_H, box, sweep} = plan.job;
    return source.engine.simulation.sweep(driver, Le_H, box, sweep);
}

/** The excursion- and power-limited maximum SPL curves. Reports on the same terms as `sweepOf`,
 *  but does not need a stated drive level: the engine runs these curves at the 2.83 V reference
 *  whatever `eg` it is handed, so that reference is passed here outright. */
export function maxCurvesOf(source: ProjectSweepSource, P: FrequencyGrid): MaxCurvesSolveResult {
    const plan = sweepPlanOf(source, P);
    if (plan.kind === 'blocked') return {values: null, issues: [...plan.issues], driverPrerequisites: []};
    const {driver, Le_H, box, maxCurves} = plan.job;
    return source.engine.simulation.maxCurves(driver, Le_H, box, maxCurves);
}

/** What is wrong with this project's enclosure parameters — checked BEFORE a sweep, so a caller
 *  can refuse rather than plot nonsense. Empty when nothing is wrong, and also empty (rather than
 *  a false accusation) when the topology cannot be simulated at all. */
export function boxParamsIssuesOf(source: ProjectSweepSource): readonly BoxParamsIssue[] {
    const box = engineBoxTypeOf(source);
    return box ? source.engine.simulation.solveBoxParams(box, enclosureParamsOf(source, box)).issues : [];
}

/** The tuning the vent as built actually produces. A precomputed readout — null, with a
 *  not-available cell, when the box is not vented or the geometry is incomplete. */
export function ventAchievedFbOf(source: ProjectSweepSource): Readable<number | null> & Calculated {
    return new CalculatedFieldImpl<number | null>(() => {
        if (source.box.boxType.value !== 'vented') {
            return absentCell<number>('ventAchievedFb');
        }
        const Vb = source.box.vented.volume_m3.value;
        const v = source.box.vented.vent.tuningIn_hz(Vb);
        return v === null
            ? absentCell<number>('ventAchievedFb')
            : calculatedCell<number | null>('ventAchievedFb', v);
    });
}

/** The highest tuning this vent can reach in this volume (its L=0 ceiling). A precomputed
 *  readout — not-available when the box is not vented or the geometry is incomplete. */
export function ventMaxReachableFbOf(source: ProjectSweepSource): Readable<number | null> & Calculated {
    return new CalculatedFieldImpl<number | null>(() => {
        if (source.box.boxType.value !== 'vented') {
            return absentCell<number>('ventMaxReachableFb');
        }
        const Vb = source.box.vented.volume_m3.value;
        const Sp = source.box.vented.vent.area_m2.value;
        if (!(Vb > 0) || Sp === null) {
            return absentCell<number>('ventMaxReachableFb');
        }
        const count = source.box.vented.vent.count.value;
        const v = source.engine.vent.tuningFromLength(Vb, 0, Sp, count, source.air, source.box.vented.vent.endCorrection_m.value);
        return calculatedCell<number | null>('ventMaxReachableFb', v);
    });
}
