import {
  efficiencyConstant,
  efficiencyFromSpl,
  motorEfficiency,
  referenceEfficiency,
  splFromEfficiency,
} from '../../efficiency.js';
import {V283_SQ} from './constants.js';
import {SolveRoute} from './SolveRoute.js';
import type {DriverRoute} from './SolveRoute.js';
import {VAS_FROM_COMPLIANCE} from './relations.js';

/**
 * Block 4b: `no`, the reference efficiency. Every route precedes the Vas routes, as WinISD
 * evaluates all `no` sites before the first Vas site (FINDING-028, `winisd_research/scripts/
 * relation_routes.py`): rel 14 via Fs/Vas/Qes, rel 15 via the driver's own motor (BL/Sd/Mms/Re),
 * rel 18 via a stated SPL. So a cleared Vas still fills from efficiency when the motor route or
 * SPL can reach it.
 */
export const NO_ROUTES: readonly DriverRoute[] = Object.freeze([
  // rel 14
  new SolveRoute('no', ['Fs_hz', 'Vas_m3', 'Qes', 'c_m_per_s'], v => referenceEfficiency(v.Fs_hz, v.Vas_m3, v.Qes, v.c_m_per_s)),
  // rel 15
  new SolveRoute('no', ['BL_Tm', 'Sd_m2', 'Mms_kg', 'Re_ohm', 'roo_kg_per_m3', 'c_m_per_s'],
    v => motorEfficiency(v.roo_kg_per_m3, v.c_m_per_s, v.BL_Tm, v.Sd_m2, v.Mms_kg, v.Re_ohm),
    v => v.Mms_kg > 0 && v.Re_ohm > 0 && v.Sd_m2 > 0),
  // rel 18
  new SolveRoute('no', ['SPL_dB', 'roo_kg_per_m3', 'c_m_per_s'], v => efficiencyFromSpl(v.SPL_dB, v.roo_kg_per_m3, v.c_m_per_s)),
  // rel 18
  new SolveRoute('no', ['SPLref_dB', 'roo_kg_per_m3', 'c_m_per_s'], v => efficiencyFromSpl(v.SPLref_dB, v.roo_kg_per_m3, v.c_m_per_s)),
]);

/** Vas from Cms and Sd: the one Vas route the passive radiator shares with the driver. */
export const VAS_FROM_CMS_SD_ROUTE = Object.freeze(new SolveRoute('Vas_m3', ['Cms_m_per_N', 'Sd_m2', 'roo_kg_per_m3', 'c_m_per_s'],
  v => v.roo_kg_per_m3 * v.c_m_per_s * v.c_m_per_s * v.Sd_m2 * v.Sd_m2 * v.Cms_m_per_N).inRelation(VAS_FROM_COMPLIANCE));

/**
 * Block 4c: Vas. rel 14 (efficiency) first, rel 10 (compliance) LAST: a cleared Vas refills
 * through the efficiency group first and only falls to the compliance group when `no` is
 * underivable (probe_vas_route_precedence.py, FINDING-027/028).
 */
export const VAS_ROUTES: readonly DriverRoute[] = Object.freeze([
  // rel 14
  new SolveRoute('Vas_m3', ['no', 'Qes', 'Fs_hz', 'c_m_per_s'],
    v => v.no * v.Qes / (efficiencyConstant(v.c_m_per_s) * (v.Fs_hz ** 3)),
    v => v.Fs_hz > 0),
  // rel 10
  VAS_FROM_CMS_SD_ROUTE,
]);

/** Block 10: Qes from `no`. The `no` and Vas rel-14 routes live in blocks 4b and 4c, ahead of the compliance group. */
export const QES_FROM_NO_ROUTES: readonly DriverRoute[] = Object.freeze([
  new SolveRoute('Qes', ['no', 'Fs_hz', 'Vas_m3', 'c_m_per_s'],
    v => efficiencyConstant(v.c_m_per_s) * (v.Fs_hz ** 3) * v.Vas_m3 / v.no,
    v => v.no > 0),
]);

/** Block 11: SPLref and SPL from `no`. The no-from-SPL routes (rel 18) run with the `no` routes in block 4b. */
export const SPL_FROM_NO_ROUTES: readonly DriverRoute[] = Object.freeze([
  new SolveRoute('SPLref_dB', ['no', 'roo_kg_per_m3', 'c_m_per_s'], v => splFromEfficiency(v.no, v.roo_kg_per_m3, v.c_m_per_s), v => v.no > 0),
  new SolveRoute('SPL_dB', ['no', 'roo_kg_per_m3', 'c_m_per_s'], v => splFromEfficiency(v.no, v.roo_kg_per_m3, v.c_m_per_s), v => v.no > 0),
]);

/**
 * Block 12: USPL, Re and SPLref. USPL = SPL_stated + 10·log₁₀(2.83²/Re): `2.83² = 8.0089`, not the
 * bare 8 (0.0048 dB apart). Agrees with WinISD to 4.3e-14 relative on every parity golden
 * available. The base is the record's own SPL, else the SPLref the efficiency routes produced
 * (bugs/archive/BUG_20260813_uspl-and-splmax-use-formulas-winisd-does-not-2p83-volts-and-a-3db-derating.md,
 * docs/spec/SPEC_ENGINE.md "USPL / SPLmax").
 */
export const USPL_ROUTES: readonly DriverRoute[] = Object.freeze([
  new SolveRoute('USPL_dB', ['Re_ohm'], v => {
    const base = v.SPL_dB ?? v.SPLref_dB;
    return base == null ? null : base + 10 * Math.log10(V283_SQ / v.Re_ohm);
  }, v => v.Re_ohm > 0),
  new SolveRoute('Re_ohm', ['USPL_dB'], v => {
    const base = v.SPL_dB ?? v.SPLref_dB;
    return base == null ? null : V283_SQ / Math.pow(10, (v.USPL_dB - base) / 10);
  }),
  new SolveRoute('SPLref_dB', ['USPL_dB', 'Re_ohm'], v => v.USPL_dB - 10 * Math.log10(V283_SQ / v.Re_ohm), v => v.Re_ohm > 0),
]);
