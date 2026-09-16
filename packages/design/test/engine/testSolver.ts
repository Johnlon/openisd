import { Engine } from '@openisd/design/engine';
import type {
  Air, SolverField, SolverInput,
  DriverSolverParams, PrSolverParams, VentSolverParams, SealedAlignmentSolverParams,
} from '@openisd/design/engine';

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
  tuning_hz?: number;
  Vb_m3?: number;
  prMmd_kg?: number;
  prSd_m2?: number;
  prCms_m_per_N?: number;
  prNum?: number;
  resonanceWithAddedMass_hz?: number;
  systemTuning_hz?: number;
}

export interface TestVentQuantities {
  tuning_hz?: number;
  length_m?: number;
  Vb_m3?: number;
  area_m2?: number;
  endCorrection_m?: number;
}

export interface TestSealedAlignmentQuantities {
  Qts?: number;
  Vas_m3?: number;
  Qtc?: number;
  Vb_m3?: number;
}

const engine = new Engine();
const REFERENCE_AIR = (): Air => engine.solveEnvironment({}).values;

/** A test seam for the engine's `SolverField` handle contracts (T10): the value is "entered"
 *  when seeded, and records whatever the solve writes (`calculated`/`not-available`). */
export function fakeSolverField<T = number>(value: T | null): SolverField<T> {
  let current: T | null = value;
  let state: 'entered' | 'calculated' | 'not-available' = value === null ? 'not-available' : 'entered';
  return {
    get value() { return current; },
    get entered() { return state === 'entered'; },
    get calculated() { return state === 'calculated'; },
    get notAvailable() { return state === 'not-available'; },
    get dq() { return [] as string[]; },
    setCalculated(v: T) { current = v; state = 'calculated'; },
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

function bagFromDriverHandles(p: DriverSolverParams): TestSolverQuantities {
  const out: TestSolverQuantities = {};
  for (const key of Object.keys(p) as (keyof DriverSolverParams)[]) {
    const v = p[key].value;
    if (v == null) continue;
    (out as Record<string, unknown>)[key] = v;
  }
  return out;
}

/** Every quantity `d` states, solved against each other, exactly as `Engine.solveDriver()`
 *  derives it — a SUPERSET bag back, the same contract the deleted `solveConsistencyGroup()`
 *  had. `air` defaults to the reference condition, matching every existing fixture that predates
 *  air being a parameter at all. */
export function solveConsistencyGroup(d: TestSolverQuantities, air: Air = REFERENCE_AIR()): TestSolverQuantities {
  const handles = driverHandlesFrom(d);
  engine.solveDriver(handles, air);
  return bagFromDriverHandles(handles);
}

/** `d`'s own disagreements/gaps — the same issues `Engine.solveDriver()` returns, since that is
 *  the ONE place this check now runs (co-located with the solve it validates, S2-10). `d` is
 *  entered-only, matching the deleted `checkConsistency()`'s own contract. */
export function checkConsistency(d: TestSolverQuantities, air: Air = REFERENCE_AIR()) {
  return engine.solveDriver(driverHandlesFrom(d), air);
}

function prHandlesFrom(p: TestPrQuantities): PrSolverParams {
  return {
    addedMass_kg: fakeSolverField(p.addedMass_kg ?? null),
    tuning_hz: fakeSolverField(p.tuning_hz ?? null),
    Vb_m3: fakeInput(p.Vb_m3),
    prMmd_kg: fakeInput(p.prMmd_kg),
    prSd_m2: fakeInput(p.prSd_m2),
    prCms_m_per_N: fakeInput(p.prCms_m_per_N),
    prNum: fakeInput(p.prNum),
    resonanceWithAddedMass_hz: fakeSolverField(p.resonanceWithAddedMass_hz ?? null),
    systemTuning_hz: fakeSolverField(p.systemTuning_hz ?? null),
  };
}

function bagFromPrHandles(p: PrSolverParams): TestPrQuantities {
  return {
    addedMass_kg: p.addedMass_kg.value ?? undefined, tuning_hz: p.tuning_hz.value ?? undefined,
    Vb_m3: p.Vb_m3.value ?? undefined, prMmd_kg: p.prMmd_kg.value ?? undefined,
    prSd_m2: p.prSd_m2.value ?? undefined, prCms_m_per_N: p.prCms_m_per_N.value ?? undefined,
    prNum: p.prNum.value ?? undefined,
    resonanceWithAddedMass_hz: p.resonanceWithAddedMass_hz.value ?? undefined,
    systemTuning_hz: p.systemTuning_hz.value ?? undefined,
  };
}

/** `air` defaults to the reference condition — every EXISTING test fixture using this helper
 *  predates air being a parameter at all, so preserving that default here (test-only) keeps
 *  every one of them unchanged; a test specifically proving air-sensitivity passes its own. */
export function solvePrConsistencyGroup(d: TestPrQuantities, air: Air = REFERENCE_AIR()): TestPrQuantities {
  const handles = prHandlesFrom(d);
  engine.solvePr(handles, air);
  return bagFromPrHandles(handles);
}

export function checkPrConsistency(d: TestPrQuantities, air: Air = REFERENCE_AIR()) {
  return engine.solvePr(prHandlesFrom(d), air);
}

function ventHandlesFrom(v: TestVentQuantities): VentSolverParams {
  return {
    tuning_hz: fakeSolverField(v.tuning_hz ?? null),
    length_m: fakeSolverField(v.length_m ?? null),
    Vb_m3: fakeInput(v.Vb_m3),
    area_m2: fakeInput(v.area_m2),
    endCorrection_m: fakeInput(v.endCorrection_m),
  };
}

function bagFromVentHandles(v: VentSolverParams): TestVentQuantities {
  return {
    tuning_hz: v.tuning_hz.value ?? undefined, length_m: v.length_m.value ?? undefined,
    Vb_m3: v.Vb_m3.value ?? undefined, area_m2: v.area_m2.value ?? undefined,
    endCorrection_m: v.endCorrection_m.value ?? undefined,
  };
}

export function solveVentConsistencyGroup(d: TestVentQuantities, air: Air = REFERENCE_AIR()): TestVentQuantities {
  const handles = ventHandlesFrom(d);
  engine.solveVent(handles, air);
  return bagFromVentHandles(handles);
}

export function checkVentConsistency(d: TestVentQuantities, air: Air = REFERENCE_AIR()) {
  return engine.solveVent(ventHandlesFrom(d), air);
}

function sealedAlignmentHandlesFrom(s: TestSealedAlignmentQuantities): SealedAlignmentSolverParams {
  return {
    Qts: fakeInput(s.Qts),
    Vas_m3: fakeInput(s.Vas_m3),
    Qtc: fakeSolverField(s.Qtc ?? null),
    Vb_m3: fakeSolverField(s.Vb_m3 ?? null),
  };
}

function bagFromSealedAlignmentHandles(s: SealedAlignmentSolverParams): TestSealedAlignmentQuantities {
  return {
    Qts: s.Qts.value ?? undefined, Vas_m3: s.Vas_m3.value ?? undefined,
    Qtc: s.Qtc.value ?? undefined, Vb_m3: s.Vb_m3.value ?? undefined,
  };
}

export function solveSealedAlignmentGroup(s: TestSealedAlignmentQuantities): TestSealedAlignmentQuantities {
  const handles = sealedAlignmentHandlesFrom(s);
  engine.solveSealedAlignment(handles);
  return bagFromSealedAlignmentHandles(handles);
}

export function checkSealedAlignment(s: TestSealedAlignmentQuantities) {
  return engine.solveSealedAlignment(sealedAlignmentHandlesFrom(s));
}
