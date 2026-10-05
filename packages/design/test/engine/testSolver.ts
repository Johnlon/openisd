import type {
  Air,
  DriverSolverParams,
  PrSolverParams,
  SealedAlignmentSolverParams,
  SolverField,
  SolverInput,
  SweepDriver,
  VentSolverParams,
} from '@openisd/design/engine';
import {createEngine} from '@openisd/design/engine';
import {halfUlp} from '../../domain/precision.js';

// S2-10: the bag types every solve used to take/return are gone from the public engine surface
// (`solverQuantities.ts` deleted) — every real solve now takes `SolverField` HANDLES. These bag
// shapes are TEST-ONLY fixtures, private to this file: a test states what it knows as a plain
// object, this module builds fake handles from it, runs the real PUBLIC handle-based solve
// (`Engine.solveDriver`/`solvePr`/`solveVent`/`solveSealedAlignment`), and hands back a bag
// again — so every existing bag-shaped fixture and assertion in the 17 files using this module
// keeps working unchanged, while the solve itself is provably the same one the domain calls.

export interface TestSolverQuantities {
  Fs_hz?: number; Re_ohm?: number; Znom_ohm?: number; Le_H?: number; fLe_hz?: number;
  KLe_H_sqrtHz?: number; Qes?: number; Qms?: number; Qts?: number; Vas_m3?: number;
  Sd_m2?: number; Dd_m?: number; BL_Tm?: number; Mms_kg?: number; Cms_m_per_N?: number;
  Rms_kg_per_s?: number; EBP_hz?: number; Xmax_m?: number; Vd_m3?: number; Hc_m?: number;
  Hg_m?: number; Pe_W?: number; no?: number; SPLref_dB?: number; SPL_dB?: number;
  USPL_dB?: number; SPLmax_dB?: number; SPLmaxLF_dB?: number; Rme_kg_per_s?: number;
  Mpow_N_per_sqrtW?: number; Mcost_kg_per_s?: number; gamma_m_per_s2_A?: number;
  Gloss?: number; Vcd_m?: number; Depth_m?: number; MagDepth_m?: number;
  Magnet_m?: number; DVol_m3?: number; c_m_per_s?: number; roo_kg_per_m3?: number;
  Re_terminal_ohm?: number; BL_terminal_Tm?: number; numVC?: number;
  wiring?: 'series' | 'parallel';
}

export interface TestPrQuantities {
  addedMass_kg?: number;
  tuning_goal_hz?: number;
  Vb_m3?: number;
  prMmd_kg?: number;
  prSd_m2?: number;
  prCms_m_per_N?: number;
  resonanceWithAddedMass_hz?: number;
  systemTuning_hz?: number;
}

export interface TestVentQuantities {
  tuning_goal_hz?: number;
  length_m?: number;
  Vb_m3?: number;
  area_m2?: number;
  count?: number;
  endCorrection_m?: number;
}

export interface TestSealedAlignmentQuantities {
  Qts?: number;
  Vas_m3?: number;
  Qtc?: number;
  Vb_m3?: number;
  /** S10: the Vb→Qtc route's loss-aware inputs. Fs_hz absent (the default) keeps every existing
   *  fixture on the pre-S10 lossless route unchanged. */
  Fs_hz?: number;
  Ql?: number;
  Qa?: number;
}

const engine = createEngine();
const REFERENCE_AIR = (): Air => engine.environment.solve({}).values;

/** A test seam for the engine's `SolverField` handle contracts (T10): the value is "entered"
 *  when seeded, and records whatever the solve writes (`calculated` with its precision, or
 *  `not-available`). `precision`
 *  left unspecified defaults to `halfUlp(value)` for a numeric entered value — the same fallback
 *  D13's real field factories use when no reading's own `read_precision` is available — so an
 *  existing fixture that never mentioned precision keeps testing the same rounding-derived
 *  tolerance the old inline `halfUlp` call inside `checkConsistency` used to compute; pass an
 *  explicit `precision` to state a reading's own stated accuracy instead. */
export function fakeSolverField<T = number>(value: T | null, precision?: number | null): SolverField<T> {
  let current: T | null = value;
  let state: 'entered' | 'calculated' | 'not-available' = value === null ? 'not-available' : 'entered';
  const ownPrecision = precision !== undefined ? precision : (typeof value === 'number' ? halfUlp(value) : null);
  let calculatedPrecision: number | null = null;
  return {
    get value() { return current; },
    get entered() { return state === 'entered'; },
    get calculated() { return state === 'calculated'; },
    get precision() { return state === 'entered' ? ownPrecision : state === 'calculated' ? calculatedPrecision : null; },
    get dq() { return []; },
    setCalculated(v: T, _dq?: unknown, p?: number) { current = v; state = 'calculated'; calculatedPrecision = p ?? null; },
    setDq() {},
    setNotAvailable() { current = null; state = 'not-available'; },
  };
}

/** A read-only `SolverInput` test double — for the params members the real solves only ever
 *  read (`Vb_m3`, `area_m2`, `prMmd_kg`, …), never write back. */
function fakeInput(value: number | undefined): SolverInput<number> {
  const v = value ?? null;
  return { value: v, entered: v !== null };
}


/** Handles built from a plain bag, entered wherever the bag states a value — for a test that
 *  calls `Engine.sweep()`/`maxCurves()` directly (S2-10: they now take handles, not a bag). */
/** The plain driver `SimulationEngine.sweep`/`maxCurves` take. A stated BL counts as entered, as
 *  `driverParams`' handles mark every stated value. */
export function sweepDriver(d: TestSolverQuantities): SweepDriver {
  return {
    values: {
      Fs_hz: d.Fs_hz ?? null, Re_ohm: d.Re_ohm ?? null, Znom_ohm: d.Znom_ohm ?? null, Le_H: d.Le_H ?? null,
      fLe_hz: d.fLe_hz ?? null, KLe_H_sqrtHz: d.KLe_H_sqrtHz ?? null, Qes: d.Qes ?? null,
      Qms: d.Qms ?? null, Qts: d.Qts ?? null, Vas_m3: d.Vas_m3 ?? null, Sd_m2: d.Sd_m2 ?? null,
      Dd_m: d.Dd_m ?? null, BL_Tm: d.BL_Tm ?? null, Mms_kg: d.Mms_kg ?? null, Cms_m_per_N: d.Cms_m_per_N ?? null,
      Rms_kg_per_s: d.Rms_kg_per_s ?? null, EBP_hz: d.EBP_hz ?? null, Xmax_m: d.Xmax_m ?? null,
      Vd_m3: d.Vd_m3 ?? null, Hc_m: d.Hc_m ?? null, Hg_m: d.Hg_m ?? null, Pe_W: d.Pe_W ?? null,
      no: d.no ?? null, SPLref_dB: d.SPLref_dB ?? null, SPL_dB: d.SPL_dB ?? null, USPL_dB: d.USPL_dB ?? null,
      SPLmax_dB: d.SPLmax_dB ?? null, SPLmaxLF_dB: d.SPLmaxLF_dB ?? null, Rme_kg_per_s: d.Rme_kg_per_s ?? null,
      Mpow_N_per_sqrtW: d.Mpow_N_per_sqrtW ?? null, Mcost_kg_per_s: d.Mcost_kg_per_s ?? null,
      gamma_m_per_s2_A: d.gamma_m_per_s2_A ?? null, Gloss: d.Gloss ?? null, Vcd_m: d.Vcd_m ?? null,
      Depth_m: d.Depth_m ?? null, MagDepth_m: d.MagDepth_m ?? null, Magnet_m: d.Magnet_m ?? null,
      DVol_m3: d.DVol_m3 ?? null, c_m_per_s: d.c_m_per_s ?? null, roo_kg_per_m3: d.roo_kg_per_m3 ?? null,
      Re_terminal_ohm: d.Re_terminal_ohm ?? null, BL_terminal_Tm: d.BL_terminal_Tm ?? null,
      numVC: d.numVC ?? null, wiring: d.wiring ?? null,
    },
    winisdBL_Tm: d.BL_Tm ?? null,
  };
}

export function driverParams(d: TestSolverQuantities): DriverSolverParams {
  return driverHandlesFrom(d);
}

function driverHandlesFrom(d: TestSolverQuantities): DriverSolverParams {
  return {
    Fs_hz: fakeSolverField(d.Fs_hz ?? null), Re_ohm: fakeSolverField(d.Re_ohm ?? null),
    Znom_ohm: fakeSolverField(d.Znom_ohm ?? null), Le_H: fakeSolverField(d.Le_H ?? null),
    fLe_hz: fakeSolverField(d.fLe_hz ?? null), KLe_H_sqrtHz: fakeSolverField(d.KLe_H_sqrtHz ?? null),
    Qes: fakeSolverField(d.Qes ?? null), Qms: fakeSolverField(d.Qms ?? null), Qts: fakeSolverField(d.Qts ?? null),
    Vas_m3: fakeSolverField(d.Vas_m3 ?? null), Sd_m2: fakeSolverField(d.Sd_m2 ?? null), Dd_m: fakeSolverField(d.Dd_m ?? null),
    BL_Tm: fakeSolverField(d.BL_Tm ?? null), Mms_kg: fakeSolverField(d.Mms_kg ?? null),
    Cms_m_per_N: fakeSolverField(d.Cms_m_per_N ?? null), Rms_kg_per_s: fakeSolverField(d.Rms_kg_per_s ?? null),
    EBP_hz: fakeSolverField(d.EBP_hz ?? null), Xmax_m: fakeSolverField(d.Xmax_m ?? null), Vd_m3: fakeSolverField(d.Vd_m3 ?? null),
    Hc_m: fakeSolverField(d.Hc_m ?? null), Hg_m: fakeSolverField(d.Hg_m ?? null), Pe_W: fakeSolverField(d.Pe_W ?? null),
    no: fakeSolverField(d.no ?? null), SPLref_dB: fakeSolverField(d.SPLref_dB ?? null), SPL_dB: fakeSolverField(d.SPL_dB ?? null),
    USPL_dB: fakeSolverField(d.USPL_dB ?? null), SPLmax_dB: fakeSolverField(d.SPLmax_dB ?? null),
    SPLmaxLF_dB: fakeSolverField(d.SPLmaxLF_dB ?? null), Rme_kg_per_s: fakeSolverField(d.Rme_kg_per_s ?? null),
    Mpow_N_per_sqrtW: fakeSolverField(d.Mpow_N_per_sqrtW ?? null), Mcost_kg_per_s: fakeSolverField(d.Mcost_kg_per_s ?? null),
    gamma_m_per_s2_A: fakeSolverField(d.gamma_m_per_s2_A ?? null), Gloss: fakeSolverField(d.Gloss ?? null),
    Vcd_m: fakeSolverField(d.Vcd_m ?? null), Depth_m: fakeSolverField(d.Depth_m ?? null), MagDepth_m: fakeSolverField(d.MagDepth_m ?? null),
    Magnet_m: fakeSolverField(d.Magnet_m ?? null), DVol_m3: fakeSolverField(d.DVol_m3 ?? null),
    c_m_per_s: fakeSolverField(d.c_m_per_s ?? null), roo_kg_per_m3: fakeSolverField(d.roo_kg_per_m3 ?? null),
    Re_terminal_ohm: fakeSolverField(d.Re_terminal_ohm ?? null), BL_terminal_Tm: fakeSolverField(d.BL_terminal_Tm ?? null),
    numVC: fakeSolverField(d.numVC ?? null),
    wiring: fakeSolverField<'series' | 'parallel'>(d.wiring ?? null),
  };
}

/** Named field-by-field, matching `bagFromPrHandles`/`bagFromVentHandles`/
 *  `bagFromSealedAlignmentHandles` below — `DriverSolverParams`' own keys are not a `string[]`
 *  the compiler can hand back typed, so a loop over `Object.keys` can only read them by casting. */
function bagFromDriverHandles(p: DriverSolverParams): TestSolverQuantities {
  return {
    Fs_hz: p.Fs_hz.value ?? undefined, Re_ohm: p.Re_ohm.value ?? undefined,
    Znom_ohm: p.Znom_ohm.value ?? undefined, Le_H: p.Le_H.value ?? undefined,
    fLe_hz: p.fLe_hz.value ?? undefined, KLe_H_sqrtHz: p.KLe_H_sqrtHz.value ?? undefined,
    Qes: p.Qes.value ?? undefined, Qms: p.Qms.value ?? undefined, Qts: p.Qts.value ?? undefined,
    Vas_m3: p.Vas_m3.value ?? undefined, Sd_m2: p.Sd_m2.value ?? undefined, Dd_m: p.Dd_m.value ?? undefined,
    BL_Tm: p.BL_Tm.value ?? undefined, Mms_kg: p.Mms_kg.value ?? undefined,
    Cms_m_per_N: p.Cms_m_per_N.value ?? undefined, Rms_kg_per_s: p.Rms_kg_per_s.value ?? undefined,
    EBP_hz: p.EBP_hz.value ?? undefined, Xmax_m: p.Xmax_m.value ?? undefined, Vd_m3: p.Vd_m3.value ?? undefined,
    Hc_m: p.Hc_m.value ?? undefined, Hg_m: p.Hg_m.value ?? undefined, Pe_W: p.Pe_W.value ?? undefined,
    no: p.no.value ?? undefined, SPLref_dB: p.SPLref_dB.value ?? undefined, SPL_dB: p.SPL_dB.value ?? undefined,
    USPL_dB: p.USPL_dB.value ?? undefined, SPLmax_dB: p.SPLmax_dB.value ?? undefined,
    SPLmaxLF_dB: p.SPLmaxLF_dB.value ?? undefined, Rme_kg_per_s: p.Rme_kg_per_s.value ?? undefined,
    Mpow_N_per_sqrtW: p.Mpow_N_per_sqrtW.value ?? undefined, Mcost_kg_per_s: p.Mcost_kg_per_s.value ?? undefined,
    gamma_m_per_s2_A: p.gamma_m_per_s2_A.value ?? undefined, Gloss: p.Gloss.value ?? undefined,
    Vcd_m: p.Vcd_m.value ?? undefined, Depth_m: p.Depth_m.value ?? undefined, MagDepth_m: p.MagDepth_m.value ?? undefined,
    Magnet_m: p.Magnet_m.value ?? undefined, DVol_m3: p.DVol_m3.value ?? undefined,
    c_m_per_s: p.c_m_per_s.value ?? undefined, roo_kg_per_m3: p.roo_kg_per_m3.value ?? undefined,
    Re_terminal_ohm: p.Re_terminal_ohm.value ?? undefined, BL_terminal_Tm: p.BL_terminal_Tm.value ?? undefined,
    numVC: p.numVC.value ?? undefined,
    wiring: p.wiring.value ?? undefined,
  };
}

/** Every quantity `d` states, solved against each other, exactly as `Engine.solveDriver()`
 *  derives it — a SUPERSET bag back, the same contract the deleted `solveConsistencyGroup()`
 *  had. `air` defaults to the reference condition, matching every existing fixture that predates
 *  air being a parameter at all. */
export function solveConsistencyGroup(d: TestSolverQuantities, air: Air = REFERENCE_AIR()): TestSolverQuantities {
  const handles = driverHandlesFrom(d);
  engine.driver.solve(handles, air);
  return bagFromDriverHandles(handles);
}

/** `d`'s own disagreements/gaps — the same issues `Engine.solveDriver()` returns, since that is
 *  the ONE place this check now runs (co-located with the solve it validates, S2-10). `d` is
 *  entered-only, matching the deleted `checkConsistency()`'s own contract. */
export function checkConsistency(d: TestSolverQuantities, air: Air = REFERENCE_AIR()) {
  return engine.driver.solve(driverHandlesFrom(d), air);
}

function prHandlesFrom(p: TestPrQuantities): PrSolverParams {
  return {
    addedMass_kg: fakeSolverField(p.addedMass_kg ?? null),
    tuning_goal_hz: fakeSolverField(p.tuning_goal_hz ?? null),
    Vb_m3: fakeInput(p.Vb_m3),
    prMmd_kg: fakeInput(p.prMmd_kg),
    prSd_m2: fakeInput(p.prSd_m2),
    prCms_m_per_N: fakeInput(p.prCms_m_per_N),
    prNum: fakeInput(1),
    resonanceWithAddedMass_hz: fakeSolverField(p.resonanceWithAddedMass_hz ?? null),
    systemTuning_hz: fakeSolverField(p.systemTuning_hz ?? null),
  };
}

function bagFromPrHandles(p: PrSolverParams): TestPrQuantities {
  return {
    addedMass_kg: p.addedMass_kg.value ?? undefined, tuning_goal_hz: p.tuning_goal_hz.value ?? undefined,
    Vb_m3: p.Vb_m3.value ?? undefined, prMmd_kg: p.prMmd_kg.value ?? undefined,
    prSd_m2: p.prSd_m2.value ?? undefined, prCms_m_per_N: p.prCms_m_per_N.value ?? undefined,
    resonanceWithAddedMass_hz: p.resonanceWithAddedMass_hz.value ?? undefined,
    systemTuning_hz: p.systemTuning_hz.value ?? undefined,
  };
}

/** `air` defaults to the reference condition — every EXISTING test fixture using this helper
 *  predates air being a parameter at all, so preserving that default here (test-only) keeps
 *  every one of them unchanged; a test specifically proving air-sensitivity passes its own. */
export function solvePrConsistencyGroup(d: TestPrQuantities, air: Air = REFERENCE_AIR()): TestPrQuantities {
  const handles = prHandlesFrom(d);
  engine.pr.solve(handles, air);
  return bagFromPrHandles(handles);
}

export function checkPrConsistency(d: TestPrQuantities, air: Air = REFERENCE_AIR()) {
  return engine.pr.solve(prHandlesFrom(d), air);
}

function ventHandlesFrom(v: TestVentQuantities): VentSolverParams {
  return {
    tuning_goal_hz: fakeSolverField(v.tuning_goal_hz ?? null),
    length_m: fakeSolverField(v.length_m ?? null),
    Vb_m3: fakeInput(v.Vb_m3),
    area_m2: fakeInput(v.area_m2),
    count: fakeInput(v.count),
    endCorrection_m: fakeInput(v.endCorrection_m),
  };
}

function bagFromVentHandles(v: VentSolverParams): TestVentQuantities {
  return {
    tuning_goal_hz: v.tuning_goal_hz.value ?? undefined, length_m: v.length_m.value ?? undefined,
    Vb_m3: v.Vb_m3.value ?? undefined, area_m2: v.area_m2.value ?? undefined,
    count: v.count.value ?? undefined, endCorrection_m: v.endCorrection_m.value ?? undefined,
  };
}

export function solveVentConsistencyGroup(d: TestVentQuantities, air: Air = REFERENCE_AIR()): TestVentQuantities {
  const handles = ventHandlesFrom(d);
  engine.vent.solve(handles, air);
  return bagFromVentHandles(handles);
}

export function checkVentConsistency(d: TestVentQuantities, air: Air = REFERENCE_AIR()) {
  return engine.vent.solve(ventHandlesFrom(d), air);
}

function sealedAlignmentHandlesFrom(s: TestSealedAlignmentQuantities): SealedAlignmentSolverParams {
  return {
    Qts: fakeInput(s.Qts),
    Vas_m3: fakeInput(s.Vas_m3),
    Fs_hz: fakeInput(s.Fs_hz),
    Ql: fakeInput(s.Ql),
    Qa: fakeInput(s.Qa),
    Qtc: fakeSolverField(s.Qtc ?? null),
    Vb_m3: fakeSolverField(s.Vb_m3 ?? null),
  };
}

function bagFromSealedAlignmentHandles(s: SealedAlignmentSolverParams): TestSealedAlignmentQuantities {
  return {
    Qts: s.Qts.value ?? undefined, Vas_m3: s.Vas_m3.value ?? undefined,
    Qtc: s.Qtc.value ?? undefined, Vb_m3: s.Vb_m3.value ?? undefined,
    Fs_hz: s.Fs_hz.value ?? undefined, Ql: s.Ql.value ?? undefined,
    Qa: s.Qa.value ?? undefined,
  };
}

export function solveSealedAlignmentGroup(s: TestSealedAlignmentQuantities): TestSealedAlignmentQuantities {
  const handles = sealedAlignmentHandlesFrom(s);
  engine.sealed.solve(handles);
  return bagFromSealedAlignmentHandles(handles);
}

export function checkSealedAlignment(s: TestSealedAlignmentQuantities) {
  return engine.sealed.solve(sealedAlignmentHandlesFrom(s));
}
