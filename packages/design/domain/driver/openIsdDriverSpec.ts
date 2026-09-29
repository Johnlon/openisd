import type {Air, CalculationIssue, DqIssue, DriverEngine, DriverIssue, DriverQuantityName, DriverSolverParams, IssueEngine, OutOfRangeIssue, SolverInput, Wiring} from '../../engine/index.js';
import {NumberField} from '../../fields/field.js';
import type {ValueFloor} from '../../fields/field.js';
import type {
    Calculatable,
    Calculated,
    Clearable,
    Entered,
    Precise,
    Readable,
    SimpleField,
    Unsolvable,
    Writable
} from '../cell.js';
import {absentCell, calculatedCell, DualWriteFieldImpl, enteredCell, entryField, writeEntryDq} from '../cell.js';
import type {DriverDeviceJson, DriverSpecsSection, SpecEntryJson} from '../openisdSchema.js';
import {
    calcNumVC,
    calculatedWiring,
    calcVCCon,
    enteredWiring,
    VoiceCoilWiring,
    wiringFromRecord
} from '../voiceCoilWiring.js';
import {computedSlot} from './computedSlot.js';
import {winisdBLterminal_Tm} from './winisdBLterminal.js';
import {winisdCms_m_per_N} from './winisdCms.js';
import {winisdMms_kg} from './winisdMms.js';
import {winisdRms_kg_per_s} from './winisdRms.js';
import {driverSection} from './driverSection.js';
import {DRIVER_SPEC_FIELD_NAMES} from './driverSpecFieldName.js';
import type {DriverSpecFieldName} from './driverSpecFieldName.js';
import {NO_SLOT} from './noSlot.js';

/**
 * The floor for the `DriverSpecFieldName`s the field registry has no entry for. Every other
 * spec field states its floor on its own `NumberField`, beside its two bands.
 *
 * `VCCon` is a wiring name, never a number, and never reaches this mechanism (see `f()`).
 * The six others are spec fields nobody has stated a band for, so there is no `NumberField` to
 * carry the floor; `driver-spec-floor-coverage.test.ts` fails if this table and the registry
 * ever stop covering every name between them.
 */
const FLOOR_WITHOUT_FIELD: Partial<Record<DriverSpecFieldName, ValueFloor>> = Object.freeze({
    VCCon: 'none',
    Dia_m: 'positive', freq_low_hz: 'positive', freq_high_hz: 'positive',
    weight_kg: 'positive', OuterX_m: 'positive', OuterY_m: 'positive',
});

/** Every `DriverSpecFieldName` the registry has a `NumberField` for, indexed once from the
 *  registry's own members — never a per-key literal that could fall out of step with it. A name
 *  in `FLOOR_WITHOUT_FIELD` above is absent here, not present with a `NumberField` that isn't one. */
const FIELD_FOR_SPEC_NAME: Partial<Record<DriverSpecFieldName, NumberField>> = Object.freeze(
    DRIVER_SPEC_FIELD_NAMES.reduce<Partial<Record<DriverSpecFieldName, NumberField>>>((map, name) => {
        const field = NumberField.ALL.find(f => f.value === name);
        if (field !== undefined) map[name] = field;
        return map;
    }, {}),
);

/** `key`'s own floor — the field's, where the registry has the field. */
export function driverSpecFloor(key: DriverSpecFieldName): ValueFloor {
    return FIELD_FOR_SPEC_NAME[key]?.floor ?? FLOOR_WITHOUT_FIELD[key] ?? 'none';
}

/** `key`'s own floor, applied to `v` — no default arm: a `ValueFloor` variant added without a
 *  case here fails to compile. */
function floorIssue(key: DriverSpecFieldName, v: number, issues: IssueEngine): DqIssue | null {
    switch (driverSpecFloor(key)) {
        case 'positive':
            return issues.positiveValueIssue(v);
        case 'non-negative':
            return issues.nonNegativeValueIssue(v);
        case 'none':
            return null;
    }
}

/** Every `DriverQuantityName`, exactly once — the field list `#markDq` clears before
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
// compile here and the error NAMES it, rather than `#markDq` silently never clearing it.
type _MissingFromDriverQuantityNames = Exclude<DriverQuantityName, typeof DRIVER_QUANTITY_NAMES[number]>;
type _AssertDriverQuantityNamesComplete = _MissingFromDriverQuantityNames extends never ? true : never;
const _assertDriverQuantityNamesComplete: _AssertDriverQuantityNamesComplete = true;
void _assertDriverQuantityNamesComplete;

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

    readonly #driver: DriverEngine;
    #issues: readonly DriverIssue[] = [];

    constructor(
        record: SimpleField<DriverDeviceJson>,
        section: 'woofer' | 'tweeter',
        driver: DriverEngine,
        issues: IssueEngine,
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
        this.#driver = driver;

        /** One `SpecEntryJson` slot inside this section — deletes the key when set to `undefined`
         *  (T11: absence is 'N', not a stored null). */
        const sectionLens = driverSection(record, section);
        const sectionSlot = (key: keyof DriverSpecsSection): SimpleField<SpecEntryJson | undefined> => ({
            get value() {
                return sectionLens.value[key];
            },
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
        /** The issues `key` is named by, out of a durable list — the same split `#markDq`
         *  makes: a `field`-carrying issue names one field, everything else names whatever
         *  `issueFields` says. */
        const dqFor = (key: keyof DriverSpecsSection): (() => readonly DqIssue[]) | undefined =>
            durableIssues === undefined ? undefined : () => durableIssues().filter(issue =>
                'field' in issue ? issue.field === key : issue.fields.some(f => f === key));
        /** Every numeric spec field's OWN floor (`driverSpecFloor`, not one floor for every field —
         *  BUG_20260927_driver-bad-value-decided-in-ui.md's follow-up), computed fresh from the
         *  CURRENT value on every read so it shows up immediately on `.set()`, not only after
         *  the next `resolve()`. */
        const f =
            (key: DriverSpecFieldName):
                Readable<number | null> &
                Entered & Calculated &
                Precise &
                Writable<number> &
                Clearable &
                Calculatable<number> &
                Unsolvable =>

                entryField(
                    sectionSlot(key),
                    key,
                    dqFor(key),
                    (v) => floorIssue(key, v, issues)
                );

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
                const wiring = wiringFromRecord(entry.value);
                if (wiring === null) return absentCell<VoiceCoilWiring>('VCCon', wiringDq);
                return entry.state === 'E'
                    ? enteredCell<VoiceCoilWiring | null>('VCCon', wiring, wiringDq)
                    : calculatedCell<VoiceCoilWiring | null>('VCCon', wiring, wiringDq);
            },
            {
                entered: (v: VoiceCoilWiring) => {
                    wiringDq = [];
                    wiringSlot.set(enteredWiring(v));
                },
                calculated: (v: VoiceCoilWiring) => {
                    wiringDq = [];
                    wiringSlot.set(calculatedWiring(v));
                },
                clear: () => {
                    wiringDq = [];
                    wiringSlot.set(undefined);
                },
                dq: (list) => {
                    wiringDq = list;
                    writeEntryDq(wiringSlot, list);
                },
            },
        );

        this.numVC = f('numVC');
        this.Fs_hz = f('Fs_hz');
        this.Re_ohm = f('Re_ohm');
        this.Le_H = f('Le_H');
        this.fLe_hz = f('fLe_hz');
        this.KLe_H_sqrtHz = f('KLe_H_sqrtHz');
        this.Znom_ohm = f('Znom_ohm');
        this.Qts = f('Qts');
        this.Qes = f('Qes');
        this.Qms = f('Qms');
        this.Vas_m3 = f('Vas_m3');
        this.Sd_m2 = f('Sd_m2');
        this.BL_Tm = f('BL_Tm');
        this.Mms_kg = f('Mms_kg');
        this.Cms_m_per_N = f('Cms_m_per_N');
        this.Rms_kg_per_s = f('Rms_kg_per_s');
        this.Xmax_m = f('Xmax_m');
        this.Xlim_m = f('Xlim_m');
        this.SPL_dB = f('SPL_dB');
        this.Pe_W = f('Pe_W');
        this.Dd_m = f('Dd_m');
        this.EBP_hz = f('EBP_hz');
        this.Dia_m = f('Dia_m');
        this.Vd_m3 = f('Vd_m3');
        this.no = f('no');
        this.SPLmax_dB = f('SPLmax_dB');
        this.SPLmaxLF_dB = f('SPLmaxLF_dB');
        this.USPL_dB = f('USPL_dB');
        this.alfaVC_per_K = f('alfaVC_per_K');
        this.Rt_K_per_W = f('Rt_K_per_W');
        this.Ct_J_per_K = f('Ct_J_per_K');
        this.gamma_m_per_s2_A = f('gamma_m_per_s2_A');
        this.Rme_kg_per_s = f('Rme_kg_per_s');
        this.Mpow_N_per_sqrtW = f('Mpow_N_per_sqrtW');
        this.Mcost_kg_per_s = f('Mcost_kg_per_s');
        this.Gloss = f('Gloss');
        // The air THIS DRIVER states, entry-backed like every other quantity: a not-entered
        // c_m_per_s/roo_kg_per_m3 no longer needs a live read-time fallback — `resolve()`'s own
        // working set defaults it to the driver's `air` and writes the default back as `'C'`
        // (engine `consistency.ts#solveDriver`), so the record always carries a real value by
        // the time anything outside this constructor can read it.
        //
        // Purpose unconfirmed (John, 2026-09-26, speculation): this may just record the
        // condition the driver was measured at, in which case no calculation should ever read
        // it — or it may be meant to let a calculation adapt the driver's measured readings to
        // the project's own air. Until decided, treat it as display-only: every real
        // calculation (box, vent, PR, sweep) reads the project's air, never this field
        // (BUG_20260924_driver-solve-and-sweep-use-different-air-models.md).
        this.c_m_per_s = f('c_m_per_s');
        this.roo_kg_per_m3 = f('roo_kg_per_m3');
        this.Vcd_m = f('Vcd_m');
        this.Hg_m = f('Hg_m');
        this.Hc_m = f('Hc_m');
        this.freq_low_hz = f('freq_low_hz');
        this.freq_high_hz = f('freq_high_hz');
        this.power_peak_W = f('power_peak_W');
        this.weight_kg = f('weight_kg');
        this.Thick_m = f('Thick_m');
        this.Depth_m = f('Depth_m');
        this.MagDepth_m = f('MagDepth_m');
        this.Magnet_m = f('Magnet_m');
        this.Basket_m = f('Basket_m');
        this.Outer_m = f('Outer_m');
        this.OuterX_m = f('OuterX_m');
        this.OuterY_m = f('OuterY_m');
        this.DVol_m3 = f('DVol_m3');
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
        this.#issues = this.#driver.solve(params, air);
        this.#markDq(params, this.#issues);
        return this.#issues;
    }

    /** Clears `dq` on every quantity, then applies each issue's OWN formula only to the handles
     *  that issue names — 44 independent quantities, where one relation's DQ has nothing to do
     *  with an unrelated field (S2-7d2). `DRIVER_QUANTITY_NAMES` is the handle list stated where
     *  the compiler can check it; `Object.keys(handles)` would answer `string[]`. */
    #markDq(
        handles: Readonly<Record<DriverQuantityName, Pick<Calculatable<unknown>, 'setDq'>>>,
        issues: readonly (CalculationIssue<DriverQuantityName> | OutOfRangeIssue)[],
    ): void {
        const mark = (key: DriverQuantityName, dq: readonly DqIssue[]): void => handles[key].setDq(dq);
        // An `OutOfRangeIssue.field` is plain `string` (D14's mark shape is shared across every
        // domain), so it is validated against the quantity list before it is narrowed.
        const fieldNames: readonly string[] = DRIVER_QUANTITY_NAMES;
        const isField = (candidate: string): candidate is DriverQuantityName => fieldNames.includes(candidate);
        DRIVER_QUANTITY_NAMES.forEach(key => mark(key, []));
        issues.forEach(issue => {
            if ('field' in issue) {
                if (isField(issue.field)) mark(issue.field, [issue]);
                return;
            }
            issue.fields.forEach(field => mark(field, [issue]));
        });
    }

    /** This spec's 44 handles, shaped as `DriverSolverParams` for `SimulationEngine.sweep()`/
     *  `maxCurves()` (S2-10: "`OpenIsdDriverSpec` structurally satisfies `DriverSolverParams`")
     *  — true for 40 of the 44 by name; the other four are ADAPTED: `SPLref_dB`/
     *  `Re_terminal_ohm`/`BL_terminal_Tm` have no storage slot (`NO_SLOT`), and `wiring` is
     *  spelled `VCCon` here and carries a `VoiceCoilWiring` member, not the bare
     *  `'series'|'parallel'` union.
     *
     *  `winisdDriverModel`: WinISD's simulation reads Fs, Vas, Qes, Qms, Sd and Re, and nothing
     *  else — it keeps entered Cms, Mms, BL and Rms untouched and its circuit names none of them
     *  outside CLe (measured against 0.7.0.950, winisd_research/PROBE_FINDINGS.md). So the flag
     *  substitutes the four, each only where its own inputs are present and positive, and each
     *  downstream one off the substituted Cms — every one an identity on a self-consistent
     *  driver. The entered BL still reaches the engine as `BL_Tm`, which the 'winisdGyrator'
     *  inductance model scales Le by; WinISD reads the entered BL there too.
     *
     *  `air`: the circuit's air is the PROJECT's, when one is given — the driver's own
     *  `c_m_per_s`/`roo_kg_per_m3` are display-only and feed no calculation
     *  (BUG_20260924_driver-solve-and-sweep-use-different-air-models.md). A caller with no
     *  project (a standalone driver's own chart) passes none, and the spread already carries the
     *  driver's own stated pair. */
    solverParams(winisdDriverModel: boolean = false, air: Air | null = null): DriverSolverParams {
        const wiring: Wiring = this.VCCon.value === VoiceCoilWiring.Series ? 'series' : 'parallel';
        const Re_ohm = this.Re_ohm.value;
        const BL_Tm = this.BL_Tm.value;
        const numVC = this.numVC.value ?? undefined;
        const wiringInput: SolverInput<Wiring> = { value: wiring, entered: this.VCCon.entered };

        const Re_terminal_ohm = Re_ohm == null ? null : this.#driver.terminalRe_ohm(Re_ohm, numVC, wiring);
        const BL_terminal_entered_Tm = BL_Tm == null ? null : this.#driver.terminalBL_Tm(BL_Tm, numVC, wiring);

        const cmsField = winisdDriverModel ? winisdCms_m_per_N(this, air) : this.Cms_m_per_N;
        const mmsField = winisdDriverModel ? winisdMms_kg(this, cmsField.value) : this.Mms_kg;
        const rmsField = winisdDriverModel ? winisdRms_kg_per_s(this, mmsField) : this.Rms_kg_per_s;
        const blTerminal = winisdDriverModel
            ? winisdBLterminal_Tm(this, Re_terminal_ohm, cmsField.value, BL_terminal_entered_Tm)
            : BL_terminal_entered_Tm;

        return {
            ...this,
            Cms_m_per_N: cmsField,
            Mms_kg: mmsField,
            Rms_kg_per_s: rmsField,
            SPLref_dB: NO_SLOT,
            Re_terminal_ohm: computedSlot(Re_terminal_ohm),
            BL_terminal_Tm: computedSlot(blTerminal),
            wiring: wiringInput,
            ...(air !== null ? { c_m_per_s: computedSlot(air.c), roo_kg_per_m3: computedSlot(air.rho) } : {}),
        };
    }

    /** The issues the last `resolve()` produced — empty before the first one has run. */
    issues(): readonly DriverIssue[] {
        return this.#issues;
    }
}
