import {G_STANDARD, P0} from '../../constants.js';
import {nominalImpedance} from '../../solvers/driverQuantities.js';
import {TAU} from './constants.js';
import {SolveRoute} from './SolveRoute.js';
import type {DriverRoute} from './SolveRoute.js';
import {GAMMA_FROM_MOTOR, MPOW_FROM_MOTOR, MPOW_FROM_RME, RME_FROM_MOTIONAL, RME_FROM_MOTOR} from './relations.js';

/**
 * Block 13: WinISD's Advanced-pane figures of merit (KNOWLEDGE_REPORT.md §4). Everything on that
 * panel except alfaVC/Rt/Ct is calculated: deleting one in WinISD makes it fill the value back in
 * (human ruling, ledger QO24).
 *
 * Rme has TWO routes and the ORDER matters: they diverge on a record whose stored Bl disagrees
 * with its own Fs/Mms/Re/Qes (Beyma 10BR60/V2: 18.22124 against 18.27846), and WinISD's own value
 * is the first, the motional route. Mpow = Bl/√Re is WinISD's own route, not √Rme (verified from
 * the `inconsistent-fs` parity golden); √Rme is the fallback for a record with no Bl.
 * SPLmax = base + 10·log₁₀(Pe) − 3 dB, the flat 3 dB derating measured exactly. Gloss reads the
 * stored Fs. SPLmaxLF uses the air the record carries. Mcost is Rme·(1 + Xmax/min(Hc,Hg)) and
 * stays absent when that divisor is zero or missing.
 */
export const ADVANCED_ROUTES: readonly DriverRoute[] = Object.freeze([
  new SolveRoute('Rme_kg_per_s', ['Fs_hz', 'Mms_kg', 'Qes'], v => TAU * v.Fs_hz * v.Mms_kg / v.Qes, v => v.Qes > 0).inRelation(RME_FROM_MOTIONAL),
  new SolveRoute('Rme_kg_per_s', ['BL_Tm', 'Re_ohm'], v => v.BL_Tm * v.BL_Tm / v.Re_ohm, v => v.Re_ohm > 0).inRelation(RME_FROM_MOTOR),
  new SolveRoute('Mpow_N_per_sqrtW', ['BL_Tm', 'Re_ohm'], v => v.BL_Tm / Math.sqrt(v.Re_ohm), v => v.Re_ohm > 0).inRelation(MPOW_FROM_MOTOR),
  new SolveRoute('Mpow_N_per_sqrtW', ['Rme_kg_per_s'], v => Math.sqrt(v.Rme_kg_per_s), v => v.Rme_kg_per_s > 0).inRelation(MPOW_FROM_RME),
  new SolveRoute('gamma_m_per_s2_A', ['BL_Tm', 'Mms_kg'], v => v.BL_Tm / v.Mms_kg, v => v.Mms_kg > 0).inRelation(GAMMA_FROM_MOTOR),
  new SolveRoute('SPLmax_dB', ['Pe_W'], v => {
    const base = v.SPL_dB ?? v.SPLref_dB;
    return base == null ? null : base + 10 * Math.log10(v.Pe_W) - 3;
  }, v => v.Pe_W > 0),
  new SolveRoute('Gloss', ['Fs_hz', 'Xmax_m'], v => G_STANDARD / ((TAU * v.Fs_hz) ** 2 * v.Xmax_m), v => v.Fs_hz > 0 && v.Xmax_m > 0),
  new SolveRoute('SPLmaxLF_dB', ['Vd_m3'], (v, air) => {
    const p20 = air.rho * (TAU * 20) ** 2 * v.Vd_m3 / (TAU * Math.SQRT2);
    return 20 * Math.log10(p20 / P0);
  }, v => v.Vd_m3 > 0),
  new SolveRoute('Mcost_kg_per_s', ['Rme_kg_per_s', 'Xmax_m'], v => {
    const minHeight = v.Hc_m != null && v.Hg_m != null ? Math.min(v.Hc_m, v.Hg_m) : 0;
    return minHeight > 0 ? v.Rme_kg_per_s * (1 + v.Xmax_m / minHeight) : null;
  }),
]);

/**
 * Block 14: Znom from Re, after every block that can produce Re (6 and 12), because WinISD accepts
 * a calculated Re as this rule's input. It keeps a non-positive result: Re < 2/3 legitimately
 * yields a COMPUTED zero (probe Z_tie_re0.6: Znom=0 marked C, not the unset Znom=0/N of a blank
 * driver). An entered Znom is never touched.
 */
export const ZNOM_ROUTES: readonly DriverRoute[] = Object.freeze([
  new SolveRoute('Znom_ohm', ['Re_ohm'], v => nominalImpedance(v.Re_ohm), v => v.Re_ohm > 0, true),
]);

/**
 * Block 24: semi-inductance `KLe = Le·√(2π·fLe)` (WINISD_SCHEMA.md rel-24; John confirmed it by
 * hand against WinISD 2026-08-31). One direction only, deliberately: WinISD calculates no route to
 * Le or fLe, so a driver never reports a CALCULATED Le that no datasheet stated.
 */
export const KLE_ROUTES: readonly DriverRoute[] = Object.freeze([
  new SolveRoute('KLe_H_sqrtHz', ['Le_H', 'fLe_hz'], v => v.Le_H * Math.sqrt(TAU * v.fLe_hz), v => v.fLe_hz > 0),
]);
