/**
 * The inputs of `driver-solver-characterization.test.ts`: a fixed, deterministic grid of stated
 * driver quantities. The expected outputs are in `driverSolverGolden.ts`, produced once from the
 * solver as it stood before the componentisation (bugs/BUG_20261003_driver-consistency-solver-
 * is-one-925-line-function.md). Adding a case means regenerating its golden entry.
 */
import type {Engine} from '../../domain/index.js';

/** Plain stated quantities, SI, as `engine.driver.solveValues` takes them. */
export type StatedQuantities = Parameters<Engine['driver']['solveValues']>[0];

/** Every numeric quantity the solver can return, in the order the golden lists them. */
export const SOLVED_FIELDS = [
  'Fs_hz', 'Re_ohm', 'Znom_ohm', 'Le_H', 'fLe_hz', 'KLe_H_sqrtHz', 'Qes', 'Qms', 'Qts', 'Vas_m3',
  'Sd_m2', 'Dd_m', 'BL_Tm', 'Mms_kg', 'Cms_m_per_N', 'Rms_kg_per_s', 'EBP_hz', 'Xmax_m', 'Vd_m3',
  'Hc_m', 'Hg_m', 'Pe_W', 'no', 'SPLref_dB', 'SPL_dB', 'USPL_dB', 'SPLmax_dB', 'SPLmaxLF_dB',
  'Rme_kg_per_s', 'Mpow_N_per_sqrtW', 'Mcost_kg_per_s', 'gamma_m_per_s2_A', 'Gloss', 'Vcd_m',
  'Depth_m', 'MagDepth_m', 'Magnet_m', 'DVol_m3', 'c_m_per_s', 'roo_kg_per_m3',
  'Re_terminal_ohm', 'BL_terminal_Tm',
] as const satisfies readonly (keyof StatedQuantities)[];

export type SolvedField = typeof SOLVED_FIELDS[number];

/** The quantities a driver record can state, i.e. the ones the handle path (`driver.resolve()`) is
 *  fed in these cases. */
export const RECORD_FIELDS = [
  'Fs_hz', 'Re_ohm', 'Le_H', 'Qes', 'Qms', 'Qts', 'Vas_m3', 'Sd_m2', 'BL_Tm', 'Mms_kg',
  'Cms_m_per_N', 'Rms_kg_per_s', 'Xmax_m', 'Pe_W',
] as const satisfies readonly SolvedField[];

export type RecordField = typeof RECORD_FIELDS[number];

/** Plain stated values for a record, keyed by the record's own spec names. */
export type RecordStated = Readonly<Partial<Record<RecordField, number>>>;

export interface SolverCase {
  readonly name: string;
  readonly stated: StatedQuantities;
  /** When present the same case is also run through `driver.resolve()` as an entered-only record,
   *  recording each field's value and entered flag and every issue. */
  readonly record?: RecordStated;
}

/** W5-1138SMF as its datasheet states it (probe pair `openisd.json` / `winisd.wdr`). Not exactly
 *  self-consistent, as real records are not. */
const W5_DATASHEET: StatedQuantities = {
  Fs_hz: 45, Qes: 0.57, Qms: 3.56, Qts: 0.49, Vas_m3: 0.00485, Sd_m2: 0.0094, Re_ohm: 3.4,
  BL_Tm: 7.17, Le_H: 0.00034, Cms_m_per_N: 0.00036872, Mms_kg: 0.02881,
  Rms_kg_per_s: 2.2881560650261163, Xmax_m: 0.00925, Pe_W: 40,
};

/** A self-consistent set: Cms from Vas and Sd in the default air, Mms from Fs and Cms, Rms from Qms,
 *  Qts from Qes and Qms, BL from Qes. Values are rounded to what a datasheet prints, so it is
 *  consistent within record precision, not to the last digit. */
const CONSISTENT: StatedQuantities = {
  Fs_hz: 40, Qes: 0.5, Qms: 4, Qts: 0.4444444444444444, Vas_m3: 0.02, Sd_m2: 0.0132, Re_ohm: 6,
  Cms_m_per_N: 0.0006, Mms_kg: 0.026388, BL_Tm: 7.5, Xmax_m: 0.006, Pe_W: 100,
};

/** The T/S quantities the leave-one-out and leave-two-out grids drop from `CONSISTENT`. */
const CORE_FIELDS = [
  'Fs_hz', 'Qes', 'Qms', 'Qts', 'Vas_m3', 'Sd_m2', 'Re_ohm', 'Cms_m_per_N', 'Mms_kg', 'BL_Tm',
  'Xmax_m', 'Pe_W',
] as const satisfies readonly RecordField[];

function without(base: StatedQuantities, dropped: readonly RecordField[]): StatedQuantities {
  const kept: StatedQuantities = {...base};
  for (const field of dropped) delete kept[field];
  return kept;
}

function recordOf(stated: StatedQuantities): RecordStated {
  const record: Partial<Record<RecordField, number>> = {};
  for (const field of RECORD_FIELDS) {
    const value = stated[field];
    if (typeof value === 'number') record[field] = value;
  }
  return record;
}

function withRecord(name: string, stated: StatedQuantities): SolverCase {
  return {name, stated, record: recordOf(stated)};
}

const leaveOneOut: readonly SolverCase[] = CORE_FIELDS.map(field =>
  withRecord(`consistent minus ${field}`, without(CONSISTENT, [field])));

const leaveTwoOut: readonly SolverCase[] = CORE_FIELDS.flatMap((first, i) =>
  CORE_FIELDS.slice(i + 1).map(second =>
    ({name: `consistent minus ${first} and ${second}`, stated: without(CONSISTENT, [first, second])})));

/** Each block of the solver fires alone, from the smallest input set that reaches it. */
const BLOCKS_ALONE: readonly SolverCase[] = [
  {name: 'absent everything', stated: {}},
  {name: 'block 1 Dd gives Sd', stated: {Dd_m: 0.13}},
  {name: 'block 1 Sd gives Dd', stated: {Sd_m2: 0.0132}},
  {name: 'block 2 Qes and Qms give Qts', stated: {Qes: 0.5, Qms: 4}},
  {name: 'block 2 Qts and Qms give Qes', stated: {Qts: 0.4, Qms: 4}},
  {name: 'block 2 Qts and Qes give Qms', stated: {Qts: 0.4, Qes: 0.5}},
  {name: 'block 2 Qts at or above Qms gives no Qes', stated: {Qts: 4, Qms: 4}},
  {name: 'block 3 Fs rel 11 from Mms and Cms', stated: {Mms_kg: 0.026, Cms_m_per_N: 0.0006}},
  {name: 'block 3 Fs rel 14 from no, Qes and Vas', stated: {no: 0.004, Qes: 0.5, Vas_m3: 0.02}},
  {name: 'block 3 Fs rel 2 from Qes, BL, Mms and Re', stated: {Qes: 0.5, BL_Tm: 7.5, Mms_kg: 0.026, Re_ohm: 6}},
  {name: 'block 3 Fs rel 4 from Rme, Qes and Mms', stated: {Rme_kg_per_s: 9, Qes: 0.5, Mms_kg: 0.026}},
  {name: 'block 3 Fs rel 12 from EBP and Qes', stated: {EBP_hz: 80, Qes: 0.5}},
  {name: 'block 3b Mms from Fs and Cms', stated: {Fs_hz: 40, Cms_m_per_N: 0.0006}},
  {name: 'block 4 Cms from Vas and Sd', stated: {Vas_m3: 0.02, Sd_m2: 0.0132}},
  {name: 'block 4 Cms from Fs and Mms', stated: {Fs_hz: 40, Mms_kg: 0.026}},
  {name: 'block 4 Sd from Vas and Cms', stated: {Vas_m3: 0.02, Cms_m_per_N: 0.0006}},
  {name: 'block 4 no from Fs, Vas and Qes', stated: {Fs_hz: 40, Vas_m3: 0.02, Qes: 0.5}},
  {name: 'block 4 no from motor', stated: {BL_Tm: 7.5, Sd_m2: 0.0132, Mms_kg: 0.026, Re_ohm: 6}},
  {name: 'block 4 no from SPL', stated: {SPL_dB: 88}},
  {name: 'block 4 no from SPLref', stated: {SPLref_dB: 88}},
  {name: 'block 4 Vas from no, Qes and Fs', stated: {no: 0.004, Qes: 0.5, Fs_hz: 40}},
  {name: 'block 4 Vas from Cms and Sd', stated: {Cms_m_per_N: 0.0006, Sd_m2: 0.0132}},
  {name: 'block 5 Rms from Fs, Mms and Qms', stated: {Fs_hz: 40, Mms_kg: 0.026, Qms: 4}},
  {name: 'block 5 Qms from Fs, Mms and Rms', stated: {Fs_hz: 40, Mms_kg: 0.026, Rms_kg_per_s: 1.6}},
  {name: 'block 5 Mms from Fs, Qms and Rms', stated: {Fs_hz: 40, Qms: 4, Rms_kg_per_s: 1.6}},
  {name: 'block 6 Qes from Fs, Mms, Re and BL', stated: {Fs_hz: 40, Mms_kg: 0.026, Re_ohm: 6, BL_Tm: 7.5}},
  {name: 'block 6 Re from Qes, BL, Fs and Mms', stated: {Qes: 0.5, BL_Tm: 7.5, Fs_hz: 40, Mms_kg: 0.026}},
  {name: 'block 6 BL from Qes, Re, Fs and Mms', stated: {Qes: 0.5, Re_ohm: 6, Fs_hz: 40, Mms_kg: 0.026}},
  {name: 'block 6 Mms from Qes, BL, Fs and Re', stated: {Qes: 0.5, BL_Tm: 7.5, Fs_hz: 40, Re_ohm: 6}},
  {name: 'block 7 Xmax from Hc and Hg', stated: {Hc_m: 0.012, Hg_m: 0.004}},
  {name: 'block 7 equal Hc and Hg give no Xmax', stated: {Hc_m: 0.008, Hg_m: 0.008}},
  {name: 'block 7 equal Hc and Hg fall through to Vd over Sd', stated: {Hc_m: 0.008, Hg_m: 0.008, Vd_m3: 0.00008, Sd_m2: 0.0132}},
  {name: 'block 7 Hc from Xmax and Hg, Hg above 2 Xmax', stated: {Xmax_m: 0.003, Hg_m: 0.01}},
  {name: 'block 7 Hc from Xmax and Hg, Hg below 2 Xmax', stated: {Xmax_m: 0.006, Hg_m: 0.004}},
  {name: 'block 7 Hg from Xmax and Hc, Hc above 2 Xmax', stated: {Xmax_m: 0.003, Hc_m: 0.01}},
  {name: 'block 7 Hg from Xmax and Hc, Hc below 2 Xmax', stated: {Xmax_m: 0.006, Hc_m: 0.004}},
  {name: 'block 7 Xmax from Vd and Sd', stated: {Vd_m3: 0.00008, Sd_m2: 0.0132}},
  {name: 'block 8 Sd from Vd and Xmax', stated: {Vd_m3: 0.00008, Xmax_m: 0.006}},
  {name: 'block 9 Vd from Sd and Xmax', stated: {Sd_m2: 0.0132, Xmax_m: 0.006}},
  {name: 'block 9b DVol from the four dimensions', stated: {Dd_m: 0.13, Vcd_m: 0.025, Depth_m: 0.06, MagDepth_m: 0.03, Magnet_m: 0.015}},
  {name: 'block 9b Depth from DVol and the others', stated: {Dd_m: 0.13, Vcd_m: 0.025, DVol_m3: 0.0001, MagDepth_m: 0.03, Magnet_m: 0.015}},
  {name: 'block 9b MagDepth from DVol and the others', stated: {Dd_m: 0.13, Vcd_m: 0.025, DVol_m3: 0.0001, Depth_m: 0.06, Magnet_m: 0.015}},
  {name: 'block 9b Magnet from DVol and the others', stated: {Dd_m: 0.13, Vcd_m: 0.025, DVol_m3: 0.0001, Depth_m: 0.06, MagDepth_m: 0.03}},
  {name: 'block 10 Qes from no, Fs and Vas', stated: {no: 0.004, Fs_hz: 40, Vas_m3: 0.02}},
  {name: 'block 11 SPLref and SPL from no', stated: {no: 0.004}},
  {name: 'block 12 USPL from SPL and Re', stated: {SPL_dB: 88, Re_ohm: 6}},
  {name: 'block 12 USPL from SPLref and Re', stated: {SPLref_dB: 88, Re_ohm: 6}},
  {name: 'block 12 Re from USPL and SPL', stated: {USPL_dB: 88, SPL_dB: 88}},
  {name: 'block 12 SPLref from USPL and Re', stated: {USPL_dB: 88, Re_ohm: 6}},
  {name: 'block 13 Rme motional route', stated: {Fs_hz: 40, Mms_kg: 0.026, Qes: 0.5}},
  {name: 'block 13 Rme Bl squared over Re', stated: {BL_Tm: 7.5, Re_ohm: 6}},
  {name: 'block 13 Rme both routes ready, motional wins', stated: {Fs_hz: 40, Mms_kg: 0.026, Qes: 0.5, BL_Tm: 8, Re_ohm: 6}},
  {name: 'block 13 Mpow from BL and Re', stated: {BL_Tm: 7.5, Re_ohm: 6}},
  {name: 'block 13 Mpow from Rme only', stated: {Rme_kg_per_s: 9}},
  {name: 'block 13 gamma from BL and Mms', stated: {BL_Tm: 7.5, Mms_kg: 0.026}},
  {name: 'block 13 SPLmax from SPL and Pe', stated: {SPL_dB: 88, Pe_W: 100}},
  {name: 'block 13 SPLmax from SPLref via no', stated: {no: 0.004, Pe_W: 100}},
  {name: 'block 13 Gloss from Fs and Xmax', stated: {Fs_hz: 40, Xmax_m: 0.006}},
  {name: 'block 13 SPLmaxLF from Vd', stated: {Vd_m3: 0.00008}},
  {name: 'block 13 Mcost from Rme, Xmax, Hc and Hg', stated: {Rme_kg_per_s: 9, Xmax_m: 0.004, Hc_m: 0.002, Hg_m: 0.006}},
  {name: 'block 13 Mcost with zero gap height stays absent', stated: {Rme_kg_per_s: 9, Xmax_m: 0.004, Hc_m: 0, Hg_m: 0}},
  {name: 'block 14 Znom from Re', stated: {Re_ohm: 6}},
  {name: 'block 14 Znom from Re below 2/3 is zero', stated: {Re_ohm: 0.5}},
  {name: 'block 14 stated Znom is kept', stated: {Re_ohm: 6, Znom_ohm: 4}},
  {name: 'block 24 KLe from Le and fLe', stated: {Le_H: 0.0003, fLe_hz: 1000}},
  {name: 'ebp from Fs and Qes', stated: {Fs_hz: 40, Qes: 0.5}},
  {name: 'terminal values series coils', stated: {Re_ohm: 3, BL_Tm: 6, numVC: 2, wiring: 'series'}},
  {name: 'terminal values parallel coils', stated: {Re_ohm: 3, BL_Tm: 6, numVC: 2, wiring: 'parallel'}},
  {name: 'a stated value is never overwritten', stated: {Fs_hz: 50, Mms_kg: 0.026, Cms_m_per_N: 0.0006}},
];

/** Two routes compete for one output. */
const COMPETING: readonly SolverCase[] = [
  {name: 'Fs rel 11 beats rel 14 when both ready', stated: {Mms_kg: 0.026, Cms_m_per_N: 0.0006, no: 0.004, Qes: 0.5, Vas_m3: 0.02}},
  {name: 'Fs rel 14 beats rel 2 when both ready', stated: {no: 0.004, Qes: 0.5, Vas_m3: 0.02, BL_Tm: 7.5, Mms_kg: 0.026, Re_ohm: 6}},
  {name: 'Fs rel 2 beats rel 4 when both ready', stated: {Qes: 0.5, BL_Tm: 7.5, Mms_kg: 0.026, Re_ohm: 6, Rme_kg_per_s: 9}},
  {name: 'Fs rel 4 beats rel 12 when both ready', stated: {Rme_kg_per_s: 9, Qes: 0.5, Mms_kg: 0.026, EBP_hz: 80}},
  {name: 'Fs rel 2 locks out a not-yet-ready rel 11', stated: {Qes: 0.5, BL_Tm: 7.5, Mms_kg: 0.026, Re_ohm: 6, Vas_m3: 0.02, Sd_m2: 0.0132}},
  {name: 'Cms from geometry beats Cms from Fs and Mms', stated: {Vas_m3: 0.02, Sd_m2: 0.0132, Fs_hz: 40, Mms_kg: 0.05}},
  {name: 'Vas from efficiency beats Vas from compliance', stated: {no: 0.004, Qes: 0.5, Fs_hz: 40, Cms_m_per_N: 0.0006, Sd_m2: 0.0132}},
  {name: 'Vas from compliance when no is underivable', stated: {Qes: 0.5, Fs_hz: 40, Cms_m_per_N: 0.0006, Sd_m2: 0.0132}},
  {name: 'Vas cleared still fills from efficiency through the motor route', stated: {Fs_hz: 40, Qes: 0.5, BL_Tm: 7.5, Sd_m2: 0.0132, Mms_kg: 0.026, Re_ohm: 6, Cms_m_per_N: 0.0006}},
  {name: 'no from Fs, Vas and Qes beats the motor route', stated: {Fs_hz: 40, Vas_m3: 0.02, Qes: 0.5, BL_Tm: 7.5, Sd_m2: 0.0132, Mms_kg: 0.026, Re_ohm: 6}},
  {name: 'no from the motor beats no from SPL', stated: {BL_Tm: 7.5, Sd_m2: 0.0132, Mms_kg: 0.026, Re_ohm: 6, SPL_dB: 90}},
  {name: 'no from SPL beats no from SPLref', stated: {SPL_dB: 90, SPLref_dB: 85}},
  {name: 'Qes from the parallel Q trio beats Qes from efficiency', stated: {Qts: 0.4, Qms: 4, no: 0.004, Fs_hz: 40, Vas_m3: 0.02}},
  {name: 'Rme motional beats Bl squared over Re on an inconsistent BL', stated: {Fs_hz: 40, Mms_kg: 0.026, Qes: 0.5, BL_Tm: 9, Re_ohm: 6}},
  {name: 'Mpow from Bl over root Re beats root Rme', stated: {BL_Tm: 9, Re_ohm: 6, Fs_hz: 40, Mms_kg: 0.026, Qes: 0.5}},
  {name: 'Xmax from the gap beats Vd over Sd', stated: {Hc_m: 0.012, Hg_m: 0.004, Vd_m3: 0.0001, Sd_m2: 0.0132}},
  {name: 'USPL from stated SPL beats USPL from SPLref', stated: {SPL_dB: 90, SPLref_dB: 85, Re_ohm: 6}},
  {name: 'Sd from Dd beats Sd from Vas and Cms', stated: {Dd_m: 0.13, Vas_m3: 0.02, Cms_m_per_N: 0.0006}},
];

/** Records whose stated values disagree: which value wins, and what the group reports. */
const INCONSISTENT: readonly SolverCase[] = [
  withRecord('datasheet W5-1138SMF', W5_DATASHEET),
  withRecord('Fs doubled against Mms and Cms', {...CONSISTENT, Fs_hz: 80}),
  withRecord('Mms impossible against Fs and Cms', {...CONSISTENT, Mms_kg: 0.1}),
  withRecord('Qts disagrees with Qes and Qms', {...CONSISTENT, Qts: 0.3}),
  withRecord('BL disagrees with Fs, Mms, Re and Qes', {...CONSISTENT, BL_Tm: 12}),
  withRecord('Rms disagrees with Fs, Mms and Qms', {...CONSISTENT, Rms_kg_per_s: 5}),
  withRecord('Vas disagrees with Cms and Sd', {...CONSISTENT, Vas_m3: 0.05}),
  withRecord('Xmax and Sd with a stated Vd', {...CONSISTENT, Vd_m3: 0.0001}),
  withRecord('Qts alone is stated', {Qts: 0.4}),
  withRecord('Qes stated without Qms or Qts', {Qes: 0.5}),
  withRecord('Re below the physical range', {Re_ohm: 0.01, Fs_hz: 40}),
];

/** The same relations under another air. Pressure moves rho and c together; temperature moves c. */
const AIR_CASES: readonly SolverCase[] = [
  {name: 'air at 101325 Pa 293.15 K, Cms from Vas and Sd', stated: {Vas_m3: 0.02, Sd_m2: 0.0132, c_m_per_s: 343.2, roo_kg_per_m3: 1.2}},
  {name: 'air at high pressure, Cms from Vas and Sd', stated: {Vas_m3: 0.02, Sd_m2: 0.0132, c_m_per_s: 343.2, roo_kg_per_m3: 1.45}},
  {name: 'air at high temperature, Cms from Vas and Sd', stated: {Vas_m3: 0.02, Sd_m2: 0.0132, c_m_per_s: 355, roo_kg_per_m3: 1.12}},
  {name: 'air only a stated c, roo is the reference', stated: {Vas_m3: 0.02, Sd_m2: 0.0132, c_m_per_s: 350}},
  {name: 'air only a stated roo, c from roo', stated: {Vas_m3: 0.02, Sd_m2: 0.0132, roo_kg_per_m3: 1.1}},
  {name: 'air at high pressure, no from Fs, Vas and Qes', stated: {Fs_hz: 40, Vas_m3: 0.02, Qes: 0.5, c_m_per_s: 343.2, roo_kg_per_m3: 1.45}},
  {name: 'air at high temperature, SPL from no', stated: {no: 0.004, c_m_per_s: 355, roo_kg_per_m3: 1.12}},
  {name: 'air at high pressure, SPLmaxLF from Vd', stated: {Vd_m3: 0.00008, c_m_per_s: 343.2, roo_kg_per_m3: 1.45}},
];

/** What `PrEngine.solveSpec` hands the solver: a radiator's seven figures and the air, nothing else. */
const RADIATOR_SUBSETS: readonly SolverCase[] = [
  {name: 'radiator Fs, Qms, Vas and Sd', stated: {Fs_hz: 30, Qms: 3.3, Vas_m3: 0.0048, Sd_m2: 0.0095, c_m_per_s: 343.2, roo_kg_per_m3: 1.2}},
  {name: 'radiator Fs, Vas and Sd without Qms', stated: {Fs_hz: 30, Vas_m3: 0.0048, Sd_m2: 0.0095, c_m_per_s: 343.2, roo_kg_per_m3: 1.2}},
  {name: 'radiator Mms, Cms and Rms only', stated: {Mms_kg: 0.0164, Cms_m_per_N: 0.00079, Rms_kg_per_s: 1.1, c_m_per_s: 343.2, roo_kg_per_m3: 1.2}},
  {name: 'radiator all seven stated, slightly inconsistent', stated: {Fs_hz: 44.2, Qms: 4.02, Vas_m3: 0.0084, Sd_m2: 0.00866, Mms_kg: 0.0164, Cms_m_per_N: 0.00079, c_m_per_s: 343.2, roo_kg_per_m3: 1.2}},
  {name: 'radiator all seven stated, consistent', stated: {Fs_hz: 30, Qms: 3.3, Vas_m3: 0.0048, Sd_m2: 0.0095, Mms_kg: 0.0164, Cms_m_per_N: 0.00172, Rms_kg_per_s: 0.9, c_m_per_s: 343.2, roo_kg_per_m3: 1.2}},
  {name: 'radiator Fs and Qms only', stated: {Fs_hz: 30, Qms: 3.3, c_m_per_s: 343.2, roo_kg_per_m3: 1.2}},
  {name: 'radiator Vas and Sd only', stated: {Vas_m3: 0.0048, Sd_m2: 0.0095, c_m_per_s: 343.2, roo_kg_per_m3: 1.2}},
  {name: 'radiator at high pressure', stated: {Fs_hz: 30, Qms: 3.3, Vas_m3: 0.0048, Sd_m2: 0.0095, c_m_per_s: 343.2, roo_kg_per_m3: 1.45}},
];

const CONSISTENT_CASES: readonly SolverCase[] = [
  withRecord('consistent record', CONSISTENT),
  withRecord('W5 datasheet minus Mms, Cms and Rms', without(W5_DATASHEET, ['Mms_kg', 'Cms_m_per_N', 'Rms_kg_per_s'])),
  withRecord('W5 datasheet minus Qts', without(W5_DATASHEET, ['Qts'])),
  withRecord('W5 datasheet minus BL', without(W5_DATASHEET, ['BL_Tm'])),
];

export const SOLVER_CASES: readonly SolverCase[] = [
  ...BLOCKS_ALONE, ...COMPETING, ...CONSISTENT_CASES, ...leaveOneOut, ...leaveTwoOut,
  ...INCONSISTENT, ...AIR_CASES, ...RADIATOR_SUBSETS,
];
