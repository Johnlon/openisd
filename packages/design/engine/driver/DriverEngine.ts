/**
 * Thiele-Small driver parameter derivation.
 *
 * Equations:
 *   https://en.wikipedia.org/wiki/Thiele/Small_parameters#Small_signal_parameters
 *
 * Authoritative source (paywalled):
 *   Small, R.H. "Direct-Radiator Loudspeaker System Analysis." JAES 20(5) 1972.
 *   https://aes.org/e-lib/browse.cfm?elib=2008
 *
 * WinISD .wdr parse/serialise and ParState provenance live in @openisd/winisd, not
 * here — this module is pure physics with no file-format concern (ARCHITECTURE.md §2).
 */

import type {Air} from '../air.js';
import {
    referenceEfficiency,
    splFromEfficiency
} from '../efficiency.js';
import type {
    DriverSolverParams,
    DriverValues,
    SolverField,
    SolverInput,
} from '../solverTypes.js';
import {inconsistentInputs, missingDependencies} from '../consistency.js';
import type {CalculationIssue, CalculationPrerequisite, OutOfRangeIssue} from '../consistency.js';
import {checkRange, isPhysicallyPlausible} from '../physicalRange.js';
import type {DriverWorkingSet} from '../solvers/driverQuantities.js';
import {hotRe, terminalBL_Tm, terminalRe_ohm} from '../solvers/driverQuantities.js';
import type {EbpSuitability, SweepResult, Wiring} from '../types.js';
import {
  CMS_FROM_VAS_SD_ROUTE, DRIVER_RELATIONS, DriverAir, MMS_FROM_FS_CMS_ROUTE, RMS_FROM_FS_MMS_QMS_ROUTE, RouteGroup,
  type RelationValues,
} from './routes/index.js';
import type {DriverRoute} from './routes/index.js';

export type DriverQuantityName = keyof DriverSolverParams;
export type DriverIssue = CalculationIssue<DriverQuantityName> | OutOfRangeIssue;
export type DriverPrerequisite = CalculationPrerequisite<DriverQuantityName>;

// ---------------------------------------------------------------------------------------------
// DRIVER CONSISTENCY — moved from consistency.ts (S2-10): `checkConsistency` needs
// `solveValues`, which became private to this file, so the two live together, same as
// every other node's solve+check pair above. `consistency.ts` keeps only the generic
// CalculationIssue/SolveRoute vocabulary every node's issues share.
// ---------------------------------------------------------------------------------------------

/** Every field this module's relations read or predict is numeric — `wiring` is the one
 *  non-numeric driver quantity, and `numVC` is a `SolverInput` with no `.precision` of its own
 *  (the domain defaults a not-entered coil count itself); no relation below names either. */
type NumericDriverQuantityName = Exclude<DriverQuantityName, 'wiring' | 'numVC'>;

type Values = RelationValues;

/** Every field name any relation above reads, deduplicated — the closed set `Values` covers. */
const RELATION_FIELDS: readonly NumericDriverQuantityName[] = Object.freeze(
  Array.from(new Set(DRIVER_RELATIONS.flatMap(rel => rel.fields))),
);

/** Every numeric driver quantity — what a calculated value's inherited width is measured over. */
const NUMERIC_QUANTITY_NAMES = Object.freeze([
  'Fs_hz', 'Re_ohm', 'Znom_ohm', 'Le_H', 'fLe_hz', 'KLe_H_sqrtHz', 'Qes', 'Qms', 'Qts', 'Vas_m3',
  'Sd_m2', 'Dd_m', 'BL_Tm', 'Mms_kg', 'Cms_m_per_N', 'Rms_kg_per_s', 'EBP_hz', 'Xmax_m', 'Vd_m3',
  'Hc_m', 'Hg_m', 'Pe_W', 'no', 'SPLref_dB', 'SPL_dB', 'USPL_dB', 'SPLmax_dB', 'SPLmaxLF_dB',
  'Rme_kg_per_s', 'Mpow_N_per_sqrtW', 'Mcost_kg_per_s', 'gamma_m_per_s2_A', 'Gloss', 'Vcd_m',
  'Depth_m', 'MagDepth_m', 'Magnet_m', 'DVol_m3', 'c_m_per_s', 'roo_kg_per_m3',
  'Re_terminal_ohm', 'BL_terminal_Tm',
] as const satisfies readonly NumericDriverQuantityName[]);
/** Fails to compile when a numeric quantity is added to `DriverSolverParams` and not listed above. */
type _MissingFromNumericQuantityNames = Exclude<NumericDriverQuantityName, typeof NUMERIC_QUANTITY_NAMES[number]>;
type _AssertNumericQuantityNamesComplete = _MissingFromNumericQuantityNames extends never ? true : never;
const _assertNumericQuantityNamesComplete: _AssertNumericQuantityNamesComplete = true;
void _assertNumericQuantityNamesComplete;

/** A computed field's uncertainty can collapse to zero when the solve is insensitive to every
 *  entered value; this is a representation floor, not a tolerance. */
const FLOAT_NOISE = 1e-9;

/** Only the fields any relation reads, as a closed `Values` bag — never the full solved record
 *  (which also carries `wiring` and everything else no relation names). */
function valuesFrom(r: DriverWorkingSet): Values {
  const out: Partial<Record<NumericDriverQuantityName, number>> = {};
  for (const field of RELATION_FIELDS) {
    const v = r[field];
    if (typeof v === 'number') out[field] = v;
  }
  return out;
}

/** `base` with `field` set to `value` — the one place a `NumericDriverQuantityName` is written
 *  into a fresh `DriverWorkingSet`, so every caller shares the same, single assignment the
 *  compiler checks once. */
function withNumericField(
  base: DriverWorkingSet, field: NumericDriverQuantityName, value: number,
): DriverWorkingSet {
  const next: DriverWorkingSet = { ...base };
  next[field] = value;
  return next;
}

/** Central-difference step, as a fraction of an input's own half-width: small enough that the
 *  slope is the derivative, large enough to stay clear of float noise. */
const DERIVATIVE_STEP = 1e-3;

/** A handle's own value, entered-only — a value the solver itself derived is never fed back in
 *  as if it had been typed (matches `checkConsistency`'s own contract). */
function enteredDriverValue(field: SolverInput): number | undefined {
  return field.entered ? field.value ?? undefined : undefined;
}

/** Write `value` onto a non-entered handle: derived, with the width its entered inputs give
 *  it, when present; `not-available` when not. An entered handle is never touched. */
function writeDriverBack(field: SolverField, value: number | undefined, width: number | undefined): void {
  if (field.entered) return;
  if (value != null) field.setCalculated(value, undefined, width); else field.setNotAvailable();
}

/**
 * Efficiency Bandwidth Product — criterion for enclosure type selection.
 * EBP = Fs / Qes.  EBP < 50 → sealed preferred; EBP > 100 → vented preferred.
 * https://en.wikipedia.org/wiki/Thiele/Small_parameters#Other_parameters
 */
function ebp(Fs_hz: number, Qes: number): number { return Fs_hz / Qes; }

/** The driver area of the engine: the T/S consistency solve over a driver's own handles, the
 *  derived indicators a picker shows (EBP and its verdict, reference efficiency and SPL, the
 *  source-loaded Qts), the terminal quantities of a multi-coil driver, and the physical-range
 *  check on one raw value. */
export interface DriverEngine {
  /** The one driver call to reach for (T10/T11): every entered T/S value's own handle, read
   *  into a private working set, solved and checked by the consistency group, with every derived
   *  value written back onto its handle via `setCalculated` (or `setNotAvailable`). Entered
   *  values — including `wiring` — are never overwritten. `air` is the project's own resolved
   *  `{ rho, c }`; a not-entered `c_m_per_s`/`roo_kg_per_m3` defaults to it and writes back as
   *  `'C'`. */
  solve(params: DriverSolverParams, air: Air): DriverIssue[];
  /** The consistency relations over plain values: every quantity derivable from the stated ones,
   *  returned with the stated ones. A stated value is never overwritten. The handle solve above
   *  runs this same group. */
  solveValues(stated: DriverWorkingSet): DriverWorkingSet;
  /** `values` as WinISD's own circuit takes them (the "Use WinISD driver calculations" switch):
   *  Cms from Vas and Sd, Mms from Fs and that Cms, Rms from Fs, that Mms and Qms, and the
   *  terminal BL from Re, Fs, Qes and that Cms. Each is replaced only where its own inputs are
   *  positive and the result is positive; otherwise the entered value stands. `air` is the
   *  project's; with none, Cms stays as entered and so do the three that follow it. */
  winisdCircuitValues(values: DriverValues, air: Air | null): DriverValues;
  /** Efficiency bandwidth product — Fs/Qes, the sealed-vs-vented indicator. */
  ebp(Fs_hz: number, Qes: number): number;
  /** The enclosure type an EBP points at: below 50 sealed, above 100 vented, else either. */
  ebpSuitability(EBP_hz: number): EbpSuitability;
  /** Reference efficiency, in the stated air. Takes `Air` — the DERIVED pair — because a driver
   *  record can state its own ρ and c directly (`.wdr` allows arbitrary values), and no
   *  temperature/humidity/pressure triple reproduces an arbitrary pair. */
  referenceEfficiency(Fs: number, Vas: number, Qes: number, air: Air): number;
  /** SPL for a given efficiency, in the stated air. */
  splFromEfficiency(no: number, air: Air): number;
  /** Qts as the amplifier's source impedance loads it: WinISD folds Rg into Qes before
   *  designing — Qes' = Qes·(Re+Rg)/Re, Qts = 1/(1/Qms + 1/Qes'). Falls back to `fallbackQts`
   *  when Qms/Qes/Re are unavailable (a driver carrying only Qts).
   *  winisd_research/SEALED_FSC_MODEL.md §5. */
  sourceLoadedQts(qms: number, qes: number, re: number, rg: number, fallbackQts: number): number;
  /** Re as the amplifier sees it: N coils of resistance r are r/N in parallel, N·r in series.
   *  A separate answer from `Re_ohm`, never a replacement for it. */
  terminalRe_ohm(Re_ohm: number, numVC: number | undefined, wiring: Wiring | undefined): number;
  /** BL as the amplifier sees it — `bl` per coil, `N·bl` in series, unchanged in parallel. */
  terminalBL_Tm(BL_Tm: number, numVC: number | undefined, wiring: Wiring | undefined): number;
  /** Re at a voice-coil temperature rise: `Re·(1 + alfaVC·ΔT)`. WinISD drives from it and
   *  states maximum power into it. */
  hotRe(Re_ohm: number, alfaVC_per_K: number, dT_K: number): number;
  /** Whether a single RAW value would sit inside `PHYSICAL_RANGE`'s band for `field` (D9
   *  tier 1) — the domain's one door into that table. */
  isPhysicallyPlausible(field: string, value: number): boolean;
  /** Sealed resonance and Qtc read off a swept impedance curve, rather than computed. */
  findImpedancePeak(result: SweepResult | null, Re: number): { Fsc: number; Qtc: number } | null;
}

export class DriverEngineImpl implements DriverEngine {
  constructor(
    private readonly routes: RouteGroup,
    private readonly air: DriverAir,
  ) {}

  /** Shared with the consistency group and the sweep, so these stay free functions and the
   *  area publishes them as-is. */
  readonly ebp = ebp;
  readonly terminalRe_ohm = terminalRe_ohm;
  readonly hotRe = hotRe;
  readonly terminalBL_Tm = terminalBL_Tm;
  readonly isPhysicallyPlausible = isPhysicallyPlausible;

  winisdCircuitValues(values: DriverValues, air: Air | null): DriverValues {
    const positive = (x: number | null | undefined): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0;
    const {Fs_hz, Qms, Qes, Vas_m3, Sd_m2} = values;
    const routeValue = (route: DriverRoute, working: DriverWorkingSet): number | null => {
      const v = route.value(working, this.air);
      return positive(v) ? v : null;
    };
    const Cms = air !== null && positive(air.c) && positive(air.rho) && positive(Vas_m3) && positive(Sd_m2)
      ? routeValue(CMS_FROM_VAS_SD_ROUTE, {Vas_m3, Sd_m2, c_m_per_s: air.c, roo_kg_per_m3: air.rho}) : null;
    const Cms_m_per_N = Cms ?? values.Cms_m_per_N;
    const Mms = positive(Fs_hz) && positive(Cms_m_per_N)
      ? routeValue(MMS_FROM_FS_CMS_ROUTE, {Fs_hz, Cms_m_per_N}) : null;
    const Mms_kg = Mms ?? values.Mms_kg;
    const Rms = positive(Fs_hz) && positive(Qms) && positive(Mms_kg)
      ? routeValue(RMS_FROM_FS_MMS_QMS_ROUTE, {Fs_hz, Qms, Mms_kg}) : null;
    const Re_terminal_ohm = values.Re_terminal_ohm;
    const BL = positive(Re_terminal_ohm) && positive(Fs_hz) && positive(Qes) && positive(Cms_m_per_N)
      ? Math.sqrt(Re_terminal_ohm / (2 * Math.PI * Fs_hz * Qes * Cms_m_per_N)) : null;
    return {
      ...values, Cms_m_per_N, Mms_kg, Rms_kg_per_s: Rms ?? values.Rms_kg_per_s,
      BL_terminal_Tm: positive(BL) ? BL : values.BL_terminal_Tm,
    };
  }

  /** The driver handle solve (T10/T11): build a private, entered-only `DriverWorkingSet` working
   *  set from the handles, run `solveValues`/`checkConsistency` on it unchanged, write
   *  every derived (non-entered) value back via `setCalculated` (or `setNotAvailable` when it
   *  cannot solve), and return the issues. `wiring` is a discrete entered input, never derived, so
   *  it is read but never written back. `air` is the project's own resolved `{ rho, c }` — a
   *  not-entered `c_m_per_s`/`roo_kg_per_m3` defaults to it (matching `VentEngine.solve`/`PrEngine.solve`'s own
   *  `air` parameter), and the default then writes back as `'C'`. */
  solve(params: DriverSolverParams, air: Air): DriverIssue[] {
    const working: DriverWorkingSet = {
      Fs_hz: enteredDriverValue(params.Fs_hz), Re_ohm: enteredDriverValue(params.Re_ohm),
      Znom_ohm: enteredDriverValue(params.Znom_ohm), Le_H: enteredDriverValue(params.Le_H),
      fLe_hz: enteredDriverValue(params.fLe_hz), KLe_H_sqrtHz: enteredDriverValue(params.KLe_H_sqrtHz),
      Qes: enteredDriverValue(params.Qes), Qms: enteredDriverValue(params.Qms), Qts: enteredDriverValue(params.Qts),
      Vas_m3: enteredDriverValue(params.Vas_m3), Sd_m2: enteredDriverValue(params.Sd_m2), Dd_m: enteredDriverValue(params.Dd_m),
      BL_Tm: enteredDriverValue(params.BL_Tm), Mms_kg: enteredDriverValue(params.Mms_kg),
      Cms_m_per_N: enteredDriverValue(params.Cms_m_per_N), Rms_kg_per_s: enteredDriverValue(params.Rms_kg_per_s),
      EBP_hz: enteredDriverValue(params.EBP_hz), Xmax_m: enteredDriverValue(params.Xmax_m), Vd_m3: enteredDriverValue(params.Vd_m3),
      Hc_m: enteredDriverValue(params.Hc_m), Hg_m: enteredDriverValue(params.Hg_m), Pe_W: enteredDriverValue(params.Pe_W),
      no: enteredDriverValue(params.no), SPLref_dB: enteredDriverValue(params.SPLref_dB), SPL_dB: enteredDriverValue(params.SPL_dB),
      USPL_dB: enteredDriverValue(params.USPL_dB), SPLmax_dB: enteredDriverValue(params.SPLmax_dB),
      SPLmaxLF_dB: enteredDriverValue(params.SPLmaxLF_dB), Rme_kg_per_s: enteredDriverValue(params.Rme_kg_per_s),
      Mpow_N_per_sqrtW: enteredDriverValue(params.Mpow_N_per_sqrtW), Mcost_kg_per_s: enteredDriverValue(params.Mcost_kg_per_s),
      gamma_m_per_s2_A: enteredDriverValue(params.gamma_m_per_s2_A), Gloss: enteredDriverValue(params.Gloss),
      Vcd_m: enteredDriverValue(params.Vcd_m), Depth_m: enteredDriverValue(params.Depth_m), MagDepth_m: enteredDriverValue(params.MagDepth_m),
      Magnet_m: enteredDriverValue(params.Magnet_m), DVol_m3: enteredDriverValue(params.DVol_m3),
      c_m_per_s: enteredDriverValue(params.c_m_per_s) ?? air.c,
      roo_kg_per_m3: enteredDriverValue(params.roo_kg_per_m3) ?? air.rho,
      Re_terminal_ohm: enteredDriverValue(params.Re_terminal_ohm),
      BL_terminal_Tm: enteredDriverValue(params.BL_terminal_Tm), numVC: enteredDriverValue(params.numVC),
      wiring: params.wiring.value ?? undefined,
    };

    const solved = this.solveValues(working);
    const issues: DriverIssue[] = [...this.checkConsistency(working, params), ...checkRange(params)];
    const widths = this.calculatedWidths(working, solved, field => params[field].precision ?? 0);

    writeDriverBack(params.Fs_hz, solved.Fs_hz, widths.Fs_hz); writeDriverBack(params.Re_ohm, solved.Re_ohm, widths.Re_ohm);
    writeDriverBack(params.Znom_ohm, solved.Znom_ohm, widths.Znom_ohm); writeDriverBack(params.Le_H, solved.Le_H, widths.Le_H);
    writeDriverBack(params.fLe_hz, solved.fLe_hz, widths.fLe_hz); writeDriverBack(params.KLe_H_sqrtHz, solved.KLe_H_sqrtHz, widths.KLe_H_sqrtHz);
    writeDriverBack(params.Qes, solved.Qes, widths.Qes); writeDriverBack(params.Qms, solved.Qms, widths.Qms); writeDriverBack(params.Qts, solved.Qts, widths.Qts);
    writeDriverBack(params.Vas_m3, solved.Vas_m3, widths.Vas_m3); writeDriverBack(params.Sd_m2, solved.Sd_m2, widths.Sd_m2); writeDriverBack(params.Dd_m, solved.Dd_m, widths.Dd_m);
    writeDriverBack(params.BL_Tm, solved.BL_Tm, widths.BL_Tm); writeDriverBack(params.Mms_kg, solved.Mms_kg, widths.Mms_kg);
    writeDriverBack(params.Cms_m_per_N, solved.Cms_m_per_N, widths.Cms_m_per_N); writeDriverBack(params.Rms_kg_per_s, solved.Rms_kg_per_s, widths.Rms_kg_per_s);
    writeDriverBack(params.EBP_hz, solved.EBP_hz, widths.EBP_hz); writeDriverBack(params.Xmax_m, solved.Xmax_m, widths.Xmax_m); writeDriverBack(params.Vd_m3, solved.Vd_m3, widths.Vd_m3);
    writeDriverBack(params.Hc_m, solved.Hc_m, widths.Hc_m); writeDriverBack(params.Hg_m, solved.Hg_m, widths.Hg_m); writeDriverBack(params.Pe_W, solved.Pe_W, widths.Pe_W);
    writeDriverBack(params.no, solved.no, widths.no); writeDriverBack(params.SPLref_dB, solved.SPLref_dB, widths.SPLref_dB); writeDriverBack(params.SPL_dB, solved.SPL_dB, widths.SPL_dB);
    writeDriverBack(params.USPL_dB, solved.USPL_dB, widths.USPL_dB); writeDriverBack(params.SPLmax_dB, solved.SPLmax_dB, widths.SPLmax_dB);
    writeDriverBack(params.SPLmaxLF_dB, solved.SPLmaxLF_dB, widths.SPLmaxLF_dB); writeDriverBack(params.Rme_kg_per_s, solved.Rme_kg_per_s, widths.Rme_kg_per_s);
    writeDriverBack(params.Mpow_N_per_sqrtW, solved.Mpow_N_per_sqrtW, widths.Mpow_N_per_sqrtW); writeDriverBack(params.Mcost_kg_per_s, solved.Mcost_kg_per_s, widths.Mcost_kg_per_s);
    writeDriverBack(params.gamma_m_per_s2_A, solved.gamma_m_per_s2_A, widths.gamma_m_per_s2_A); writeDriverBack(params.Gloss, solved.Gloss, widths.Gloss);
    writeDriverBack(params.Vcd_m, solved.Vcd_m, widths.Vcd_m); writeDriverBack(params.Depth_m, solved.Depth_m, widths.Depth_m); writeDriverBack(params.MagDepth_m, solved.MagDepth_m, widths.MagDepth_m);
    writeDriverBack(params.Magnet_m, solved.Magnet_m, widths.Magnet_m); writeDriverBack(params.DVol_m3, solved.DVol_m3, widths.DVol_m3); writeDriverBack(params.Re_terminal_ohm, solved.Re_terminal_ohm, widths.Re_terminal_ohm);
    writeDriverBack(params.BL_terminal_Tm, solved.BL_terminal_Tm, widths.BL_terminal_Tm);
    if (!params.c_m_per_s.entered) params.c_m_per_s.setCalculated(air.c);
    if (!params.roo_kg_per_m3.entered) params.roo_kg_per_m3.setCalculated(air.rho);

    return issues;
  }

  /**
   * Solve every derivable Thiele/Small field from whatever is already present in `p`, without
   * requiring a complete set: an entered (non-null) value is NEVER overwritten (WinISD's
   * fixed-E override semantics). The routes that derive each quantity live in `./routes`
   * (`DRIVER_ROUTES`, in WinISD's own site order); this adds the values that come after the
   * fixed point. Callers that need partial derivation (an in-progress edit, not yet complete
   * enough to simulate, e.g. the live driver editor) call this directly.
   *
   * All equations: https://en.wikipedia.org/wiki/Thiele/Small_parameters#Small_signal_parameters
   *
   * The result is a SUPERSET of the input: every quantity handed in comes back out, plus what the
   * solver derived. `numVC` and `wiring` ride along untouched: the solver READS them, to finish the
   * terminal values below, and never consumes them; dropping them would make re-solving lossy.
   */
  solveValues(p: DriverWorkingSet): DriverWorkingSet {
    const r = this.routes.run(p);

    // The air a record carries is itself a derivable field, exactly like any other: entered
    // (a .wdr's own c/roo) wins, else recomputed exactly as `DriverAir` does —
    // surfacing it here in the output record is what lets every caller treat c/roo through the
    // SAME entered-or-computed path as Fs/Qes/EBP, with no special case anywhere above this module.
    //
    // The two guards below are unreachable and deleted: `solveValues` is module-private,
    // and its only two call sites (`checkConsistency`'s direct call, and the `bumped` recompute
    // inside it) both pass a working set that ultimately traces back to `solveDriver`'s own
    // construction of `working`, which ALWAYS pre-fills `c_m_per_s: enteredDriverValue(...) ??
    // air.c` and `roo_kg_per_m3: enteredDriverValue(...) ?? air.rho` — and `Air.c`/`Air.rho`
    // (air.ts) are non-optional `number`, never null/undefined. So `r.c_m_per_s`/`r.roo_kg_per_m3`
    // are never null by the time this function is reached through any current call path.
    r.c_m_per_s = this.air.c(r);
    r.roo_kg_per_m3 = this.air.rho(r);

    // EBP (Fs/Qes) likewise: a real derivable field, computed once every input it needs is
    // available, through the SAME `ebp` formula the area publishes for every other caller —
    // never recomputed ad hoc downstream.
    if (r.EBP_hz == null && r.Fs_hz != null && r.Qes != null && r.Qes > 0) {
      r.EBP_hz = ebp(r.Fs_hz, r.Qes);
    }

    // THE TERMINAL VALUES, LAST. Not a relation — nothing else in the group constrains them, and
    // they answer a question about the WIRING rather than about the driver's parameters. So they
    // are computed once, after the fixpoint, from whatever `Re_ohm` and `BL_Tm` finally are:
    // `Re_ohm` is itself derivable, so computing these earlier would fix them to a value the solve
    // then moved.
    //
    // Here rather than at the caller because `sweep` REQUIRES this pair. A solver that stopped short
    // of it left every caller to finish the job, and a caller that forgot got a driver the engine
    // refused with a message naming a field it had never been able to supply.
    if (r.Re_terminal_ohm == null && r.Re_ohm != null) {
      r.Re_terminal_ohm = terminalRe_ohm(r.Re_ohm, r.numVC, r.wiring);
    }
    if (r.BL_terminal_Tm == null && r.BL_Tm != null) {
      r.BL_terminal_Tm = terminalBL_Tm(r.BL_Tm, r.numVC, r.wiring);
    }

    return r;
  }

  /**
   * How far each not-entered quantity in `observed` moves when each entered quantity in
   * `perturbed` is bumped by its own half-width (`widthOf`), summed: the worst-case width the
   * entered values' own rounding gives a derived value. A quantity nothing moves is absent.
   */
  private inheritedWidths(
    entered: DriverWorkingSet,
    resolved: DriverWorkingSet,
    perturbed: readonly NumericDriverQuantityName[],
    observed: readonly NumericDriverQuantityName[],
    widthOf: (field: NumericDriverQuantityName) => number,
  ): Partial<Record<NumericDriverQuantityName, number>> {
    const widths: Partial<Record<NumericDriverQuantityName, number>> = {};
    for (const field of perturbed) {
      const enteredValue = entered[field];
      const ownWidth = widthOf(field);
      if (typeof enteredValue !== 'number' || !(ownWidth > 0)) continue;
      const bumped = this.solveValues(withNumericField(entered, field, enteredValue + ownWidth));
      for (const other of observed) {
        if (entered[other] != null) continue; // only derived quantities inherit a width
        const moved = bumped[other];
        const base = resolved[other];
        if (typeof moved === 'number' && typeof base === 'number' && isFinite(moved - base) && moved !== base) {
          widths[other] = (widths[other] ?? 0) + Math.abs(moved - base);
        }
      }
    }
    return widths;
  }

  /**
   * Each derived quantity's half-width: Σ |∂f/∂x|·d(x) over every entered input x with a
   * half-width d(x) — the guaranteed first-order bound, winisd_tools' former `lib/precision.py`
   * (CALCULATIONS.md §1.3, interval arithmetic). Slopes are central differences through the
   * solve itself. A quantity no entered width reaches is absent.
   */
  private calculatedWidths(
    entered: DriverWorkingSet,
    resolved: DriverWorkingSet,
    widthOf: (field: NumericDriverQuantityName) => number,
  ): Partial<Record<NumericDriverQuantityName, number>> {
    const widths: Partial<Record<NumericDriverQuantityName, number>> = {};
    for (const field of NUMERIC_QUANTITY_NAMES) {
      const x = entered[field];
      const d = widthOf(field);
      if (typeof x !== 'number' || !(d > 0)) continue;
      const step = d * DERIVATIVE_STEP;
      const up = this.solveValues(withNumericField(entered, field, x + step));
      const down = this.solveValues(withNumericField(entered, field, x - step));
      for (const other of NUMERIC_QUANTITY_NAMES) {
        if (entered[other] != null || typeof resolved[other] !== 'number') continue;
        const hi = up[other];
        const lo = down[other];
        if (typeof hi !== 'number' || typeof lo !== 'number') continue;
        const contribution = Math.abs((hi - lo) / (2 * step)) * d;
        if (contribution > 0 && isFinite(contribution)) widths[other] = (widths[other] ?? 0) + contribution;
      }
    }
    return widths;
  }

  /**
   * Every entered value's disagreement with what the OTHER entered values imply for it, beyond
   * their own combined rounding precision — plus, for `Qts`, whether the group can even be
   * solved at all. `entered` is the driver's own stated numerics; a value the solver itself
   * derived is never fed back in as if the human had typed it. `params` supplies each entered
   * field's own precision (D13: the reading's stated `read_precision`, or else half the last
   * decimal it was typed to) — the source of truth for how wide that field's own rounding
   * interval is, never recomputed from the resolved number here.
   */
  private checkConsistency(entered: DriverWorkingSet, params: DriverSolverParams): DriverIssue[] {
    const resolved = this.solveValues(entered);

    // Each field's own uncertainty: an ENTERED field carries its own stated precision (D13); a
    // COMPUTED one starts at the float-representation floor and accumulates however far each
    // entered field's own rounding can move it (below).
    const inherited = this.inheritedWidths(entered, resolved, RELATION_FIELDS, RELATION_FIELDS,
      field => params[field].precision ?? 0);
    const delta: Partial<Record<NumericDriverQuantityName, number>> = {};
    for (const field of RELATION_FIELDS) {
      const value = resolved[field];
      if (typeof value !== 'number') continue;
      delta[field] = entered[field] != null
        ? (params[field].precision ?? 0)
        : Math.abs(value) * FLOAT_NOISE + (inherited[field] ?? 0);
    }

    const resolvedValues = valuesFrom(resolved);
    const issues: DriverIssue[] = [];
    for (const rel of DRIVER_RELATIONS) {
      if (!rel.fields.every(f => typeof resolvedValues[f] === 'number')) continue;
      const expected = rel.predict(resolvedValues);
      if (!isFinite(expected)) continue;

      // `rel.target` is always one of `rel.fields` (every relation names its own target among its
      // fields), and the `.every()` above just confirmed `resolvedValues[rel.target]` — hence
      // `resolved[rel.target]` — is a number; the population loop above sets `delta[field]` for
      // every `RELATION_FIELDS` member with a numeric resolved value, so it is already set.
      let tolerance = delta[rel.target]!;
      for (const f of rel.fields) {
        const fieldDelta = delta[f];
        if (f === rel.target || !(fieldDelta! > 0)) continue;
        const bumpedValues: Partial<Record<NumericDriverQuantityName, number>> = { ...resolvedValues };
        bumpedValues[f] = resolvedValues[f]! + fieldDelta!;
        const moved = rel.predict(bumpedValues);
        if (isFinite(moved)) tolerance += Math.abs(moved - expected);
      }

      const actual = resolvedValues[rel.target]!;
      const residual = Math.abs(expected - actual);
      if (residual > tolerance) {
        // `residual` is the gap between the two intervals' CENTRES; `tolerance` is how much of
        // that gap their own half-widths already close. What is left over — the gap between the
        // two intervals' NEAREST EDGES — is the genuine, unexplained disagreement.
        const shortfall = residual - tolerance;
        issues.push(inconsistentInputs(rel.target, rel.fields, rel.formula, expected, actual,
          shortfall / Math.max(Math.abs(actual), Math.abs(expected))));
      }
    }

    // Qts has no route besides Qes+Qms (WinISD has no third input to this triple) — a driver
    // stating fewer than two of the three cannot solve it, and the caller needs to know exactly
    // which field is missing to unblock it. Checked on ENTERED COUNT, not on whether Qts resolved
    // to a number: an entered Qts always "resolves" to its own stated value regardless of whether
    // the group is otherwise solvable, so checking `resolvedValues.Qts` alone let a driver stating
    // Qts ALONE pass as consistent — the group structurally still has no independent route to
    // confirm it (S9a Cluster 6).
    const enteredTrioCount = (['Qts', 'Qes', 'Qms'] as const).filter(f => entered[f] != null).length;
    if (enteredTrioCount < 2) {
      const missing: NumericDriverQuantityName[] = (['Qes', 'Qms'] as const).filter(f => entered[f] == null);
      issues.push(missingDependencies('Qts',
        [{ formula: 'Qts = Qes·Qms/(Qes+Qms)', required: ['Qes', 'Qms'], missing }]));
    }

    return issues;
  }

  ebpSuitability(EBP_hz: number): EbpSuitability {
    if (EBP_hz < 50) return 'sealed';
    if (EBP_hz > 100) return 'vented';
    return 'either';
  }

  referenceEfficiency(Fs: number, Vas: number, Qes: number, air: Air): number {
    return referenceEfficiency(Fs, Vas, Qes, air.c);
  }

  splFromEfficiency(no: number, air: Air): number {
    return splFromEfficiency(no, air.rho, air.c);
  }

  /**
   * Driver total Q loaded by a series source resistance Rg (amplifier output impedance + wiring +
   * crossover DCR — the Signal tab's "Series resistance", state.P.Rs). Rg adds to the voice-coil
   * Re in the electrical-loss branch, so it RAISES the electrical Q: Qes' = Qes·(Re+Rg)/Re, and
   * hence the total Q Qts = 1/(1/Qms + 1/Qes'). WinISD folds this into the sealed Fsc/Qtc it
   * reports; ignoring Rg gives a visibly wrong resonance and Qtc (e.g. the Dayton E150HE-44 in a
   * 6 L box at Ql=10/Qa=100/Rg=0.1 reads 63.22 Hz/0.592 instead of WinISD's 63.18 Hz/0.599).
   *
   * Falls back to `fallbackQts` when Qms/Qes/Re are unavailable (a driver carrying only Qts).
   * Reference: winisd_research/SEALED_FSC_MODEL.md §5.
   */
  sourceLoadedQts(
    qms: number, qes: number, re: number, rg: number, fallbackQts: number,
  ): number {
    if (!(qms > 0) || !(qes > 0) || !(re > 0)) return fallbackQts;
    const qesLoaded = (qes * (re + Math.max(0, rg))) / re;
    return 1 / (1 / qms + 1 / qesLoaded);
  }

  /**
   * Finds the actual system resonance (Fsc) and Q (Qtc) from the simulated impedance curve
   * of a sealed/closed box, taking box leakage/absorption losses into account (TS method).
   */
  findImpedancePeak(result: SweepResult | null, Re: number): { Fsc: number; Qtc: number } | null {
    if (!result || result.fs.length === 0 || !Re || Re <= 0) return null;

    let maxZ = -1;
    let peakIdx = -1;
    for (let i = 0; i < result.fs.length; i++) {
      if (result.zmag[i] > maxZ) {
        maxZ = result.zmag[i];
        peakIdx = i;
      }
    }

    if (peakIdx === -1 || maxZ <= Re) return null;

    const peakFreq = result.fs[peakIdx];
    // r0 = maxZ/Re is always > 1 here: the guard above already refused maxZ <= Re, and Re > 0
    // was refused earlier still, so a "r0 <= 1" guard here could never fire — removed rather
    // than left as dead defensive code.
    const r0 = maxZ / Re;
    const Z_target = Re * Math.sqrt(r0);

    // Find f1 (below peakIdx)
    let f1 = -1;
    for (let i = peakIdx; i >= 0; i--) {
      if (result.zmag[i] <= Z_target) {
        const fA = result.fs[i];
        const fB = result.fs[i + 1];
        const zA = result.zmag[i];
        const zB = result.zmag[i + 1];
        // zB is the previous loop iteration's point (one step towards the peak): it failed this
        // same "<= Z_target" test, so zB > Z_target >= zA strictly — zA and zB can never be
        // equal, so the interpolation denominator is never zero.
        f1 = fA + (Z_target - zA) * (fB - fA) / (zB - zA);
        break;
      }
    }

    // Find f2 (above peakIdx)
    let f2 = -1;
    for (let i = peakIdx; i < result.fs.length; i++) {
      if (result.zmag[i] <= Z_target) {
        const fA = result.fs[i - 1];
        const fB = result.fs[i];
        const zA = result.zmag[i - 1];
        const zB = result.zmag[i];
        // zA is the previous loop iteration's point (one step towards the peak): it failed this
        // same "<= Z_target" test, so zA > Z_target >= zB strictly — never equal to zB.
        f2 = fA + (Z_target - zA) * (fB - fA) / (zB - zA);
        break;
      }
    }

    if (f1 === -1 || f2 === -1 || f2 <= f1) {
      return { Fsc: peakFreq, Qtc: 0 };
    }

    const Qmc = (peakFreq * Math.sqrt(r0)) / (f2 - f1);
    const Qtc = Qmc / r0;

    return { Fsc: peakFreq, Qtc };
  }
}
