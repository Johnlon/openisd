import { Engine } from '../../engine/index.js';
import type { Air, DqIssue, DriverIssue, DriverQuantityName, DriverSolverParams } from '../../engine/index.js';
import { DualWriteFieldImpl, absentCell, calculatedCell, enteredCell, entryField, writeEntryDq } from '../cell.js';
import type { Calculatable, Calculated, Clearable, Entered, Precise, Readable, SimpleField, Unsolvable, Writable } from '../cell.js';
import { VoiceCoilWiring, calcNumVC, calcVCCon, calculatedWiring, enteredWiring, winningValue, wiringFromRecord } from '../openisdSchema.js';
import type { DriverDeviceJson, DriverSpecsSection, SpecEntryJson } from '../openisdSchema.js';
import { projectFormulaDq } from '../project/projectFormulaDq.js';
import { driverSection } from './driverSection.js';
import type { DriverSpecFieldName } from './driverSpecFieldName.js';
import { NO_SLOT } from './noSlot.js';

/**
 * The floor a driver spec field's value must clear, per BUG_20260927_driver-bad-value-decided-
 * in-ui.md's follow-up (John, 2026-09-27): applying ONE floor ("must be positive") to every
 * numeric field was wrong — a decibel figure can be zero or negative (it is a level relative to
 * a reference, not a magnitude), and some non-dB fields are legitimately zero.
 *
 * - `'positive'` — zero, negative or non-finite is not physical (`Engine.positiveValueIssue`).
 * - `'non-negative'` — negative or non-finite is not physical, but zero is a real, stated fact
 *   (`Engine.nonNegativeValueIssue`).
 * - `'none'` — no floor from this mechanism; the field's own range (if any) is a different check.
 */
type ValueFloor = 'positive' | 'non-negative' | 'none';

/**
 * Every `DriverSpecFieldName`, exactly once — the compiler fails to build this object if a key
 * is missing or misspelled (a `Record` over a union requires every member), so a new field added
 * to `DriverSpecsSection` fails here rather than silently inheriting a default. `VCCon` is a
 * wiring name, never a number, and never reaches this mechanism (see `f()`) — `'none'` for it is
 * a formality, not a decision.
 *
 * Per-field reasoning (`docs/FIELD_REFERENCE.md` gives the definition and formula for each):
 * - Decibel LEVELS relative to a reference can be zero or negative: `SPL_dB`, `SPLmax_dB`,
 *   `SPLmaxLF_dB`, `USPL_dB`. `Gloss` LOOKS like a percentage figure but is not decibel — it is
 *   the fraction `g/((2π·Fs)²·Xmax)`, strictly positive for any positive Fs/Xmax.
 * - `Le_H` can be zero (no measurable inductance). `KLe_H_sqrtHz = Le·√(2π·fLe)` inherits the
 *   same zero case through `Le`, and can never be negative since `fLe` is a frequency.
 *   `alfaVC_per_K` (temperature coefficient of resistance) can be zero for an idealised
 *   zero-drift material; no real conductor has a negative one.
 * - `Znom_ohm` is genuinely 0 in some real `.wdr` files (`docs/FIELD_REFERENCE.md`) and is not
 *   used in simulation at all — a stated fact, not an error.
 * - Every other field is a magnitude (a frequency, a mass, a resistance, a physical dimension, a
 *   Q factor, a ratio of two positive quantities such as `EBP_hz = Fs/Qes` or
 *   `gamma_m_per_s2_A = BL/Mms`) that is strictly positive for any driver that actually works;
 *   `Rms_kg_per_s` is included because `Qms = 2π·Fs·Mms/Rms` divides by it.
 */
const FIELD_FLOOR: Record<DriverSpecFieldName, ValueFloor> = Object.freeze({
    VCCon: 'none',
    Fs_hz: 'positive', Re_ohm: 'positive', Le_H: 'non-negative', fLe_hz: 'positive',
    KLe_H_sqrtHz: 'non-negative', Znom_ohm: 'non-negative', Qts: 'positive', Qes: 'positive',
    Qms: 'positive', Vas_m3: 'positive', Sd_m2: 'positive', BL_Tm: 'positive', Mms_kg: 'positive',
    Cms_m_per_N: 'positive', Rms_kg_per_s: 'positive', Xmax_m: 'positive', Xlim_m: 'positive',
    SPL_dB: 'none', Pe_W: 'positive', Dd_m: 'positive', EBP_hz: 'positive', numVC: 'positive',
    Dia_m: 'positive', Vd_m3: 'positive', no: 'positive', SPLmax_dB: 'none', SPLmaxLF_dB: 'none',
    USPL_dB: 'none', alfaVC_per_K: 'non-negative', Rt_K_per_W: 'positive', Ct_J_per_K: 'positive',
    gamma_m_per_s2_A: 'positive', Rme_kg_per_s: 'positive', Mpow_N_per_sqrtW: 'positive',
    Mcost_kg_per_s: 'positive', Gloss: 'positive', c_m_per_s: 'positive', roo_kg_per_m3: 'positive',
    Vcd_m: 'positive', Hg_m: 'positive', Hc_m: 'positive', freq_low_hz: 'positive',
    freq_high_hz: 'positive', power_peak_W: 'positive', weight_kg: 'positive', Thick_m: 'positive',
    Depth_m: 'positive', MagDepth_m: 'positive', Magnet_m: 'positive', Basket_m: 'positive',
    Outer_m: 'positive', OuterX_m: 'positive', OuterY_m: 'positive', DVol_m3: 'positive',
});

/** `key`'s own floor, applied to `v` — no default arm: a `ValueFloor` variant added without a
 *  case here fails to compile. */
function floorIssue(key: DriverSpecFieldName, v: number, engine: Engine): DqIssue | null {
    switch (FIELD_FLOOR[key]) {
        case 'positive': return engine.positiveValueIssue(v);
        case 'non-negative': return engine.nonNegativeValueIssue(v);
        case 'none': return null;
    }
}

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
        /** Every numeric spec field's OWN floor (`FIELD_FLOOR`, not one floor for every field —
         *  BUG_20260927_driver-bad-value-decided-in-ui.md's follow-up), computed fresh from the
         *  CURRENT value on every read so it shows up immediately on `.set()`, not only after
         *  the next `resolve()`. */
        const f = (key: DriverSpecFieldName): Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable => entryField(sectionSlot(key), key, engine, dqFor(key), (v) => floorIssue(key, v, engine));

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
        //
        // Purpose unconfirmed (John, 2026-09-26, speculation): this may just record the
        // condition the driver was measured at, in which case no calculation should ever read
        // it — or it may be meant to let a calculation adapt the driver's measured readings to
        // the project's own air. Until decided, treat it as display-only: every real
        // calculation (box, vent, PR, sweep) reads the project's air, never this field
        // (BUG_20260924_driver-solve-and-sweep-use-different-air-models.md).
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
