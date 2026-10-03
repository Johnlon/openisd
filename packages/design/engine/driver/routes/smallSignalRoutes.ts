import {efficiencyConstant} from '../../efficiency.js';
import {TAU} from './constants.js';
import {SolveRoute} from './SolveRoute.js';
import type {DriverRoute} from './SolveRoute.js';

/** Block 2: Qts, Qes and Qms in parallel; any two give the third. */
export const Q_ROUTES: readonly DriverRoute[] = Object.freeze([
  new SolveRoute('Qts', ['Qes', 'Qms'], v => v.Qes * v.Qms / (v.Qes + v.Qms)),
  new SolveRoute('Qes', ['Qts', 'Qms'], v => v.Qts * v.Qms / (v.Qms - v.Qts), v => v.Qms > v.Qts),
  new SolveRoute('Qms', ['Qts', 'Qes'], v => v.Qts * v.Qes / (v.Qes - v.Qts), v => v.Qes > v.Qts),
]);

/**
 * Block 3: Fs, WinISD's five routes in WinISD's own priority order (`docs/design/WINISD_SCHEMA.md`
 * §4.3, `winisd_research/RE_GHIDRA_FINDINGS.md` "Fs priority settled STATICALLY"). WinISD's engine
 * is one linear sequence of guarded blocks re-run to a fixpoint, and every block re-tests its
 * target for still-unset before writing, so once any route sets Fs every later route is skipped
 * for good, even a higher-priority one whose own inputs only become ready later. A route whose
 * inputs are still being derived (rel 11's Cms, computed in block 4 after this block) can lose to
 * a lower-priority route that was ready first, as in WinISD. WinISD has no route deriving Fs from
 * Rms, Qms and Mms; that direction is deliberately absent (block 5).
 */
export const FS_ROUTES: readonly DriverRoute[] = Object.freeze([
  // rel 11
  new SolveRoute('Fs_hz', ['Mms_kg', 'Cms_m_per_N'], v => 1 / (TAU * Math.sqrt(v.Mms_kg * v.Cms_m_per_N))),
  // rel 14
  new SolveRoute('Fs_hz', ['no', 'Qes', 'Vas_m3'],
    (v, air) => Math.pow((v.no * v.Qes) / (efficiencyConstant(air.c(v)) * v.Vas_m3), 1 / 3),
    v => v.Vas_m3 > 0 && v.no > 0),
  // rel 2
  new SolveRoute('Fs_hz', ['Qes', 'BL_Tm', 'Mms_kg', 'Re_ohm'],
    v => v.Qes * v.BL_Tm * v.BL_Tm / (TAU * v.Mms_kg * v.Re_ohm),
    v => v.Mms_kg > 0 && v.Re_ohm > 0),
  // rel 4
  new SolveRoute('Fs_hz', ['Rme_kg_per_s', 'Qes', 'Mms_kg'], v => v.Rme_kg_per_s * v.Qes / (TAU * v.Mms_kg), v => v.Mms_kg > 0),
  // rel 12
  new SolveRoute('Fs_hz', ['EBP_hz', 'Qes'], v => v.EBP_hz * v.Qes),
]);

/** Block 3b: Mms from Fs and Cms, the reverse direction, unaffected by which Fs route fired. */
export const MMS_FROM_FS_CMS_ROUTES: readonly DriverRoute[] = Object.freeze([
  new SolveRoute('Mms_kg', ['Fs_hz', 'Cms_m_per_N'], v => 1 / ((TAU * v.Fs_hz) ** 2 * v.Cms_m_per_N)),
]);

/**
 * Block 4a: Cms and Sd. Cms has TWO routes and the ORDER matters: the GEOMETRY route (Cms from Vas
 * and Sd) wins over Fs and Mms. John tested this against real WinISD (2026-09-01) and it prefers
 * Sd/Vas. It decides who gets blamed for a contradiction: a driver whose stated Mms cannot be
 * true resolves its compliance from the geometry, so the impossible Mms then disagrees with the
 * Fs/Mms/Cms group, the fields the user actually typed.
 */
export const CMS_SD_ROUTES: readonly DriverRoute[] = Object.freeze([
  new SolveRoute('Cms_m_per_N', ['Vas_m3', 'Sd_m2'],
    (v, air) => v.Vas_m3 / (air.rho(v) * air.c(v) * air.c(v) * v.Sd_m2 * v.Sd_m2),
    v => v.Sd_m2 > 0),
  new SolveRoute('Cms_m_per_N', ['Fs_hz', 'Mms_kg'], v => 1 / ((TAU * v.Fs_hz) ** 2 * v.Mms_kg)),
  new SolveRoute('Sd_m2', ['Vas_m3', 'Cms_m_per_N'],
    (v, air) => Math.sqrt(v.Vas_m3 / (air.rho(v) * air.c(v) * air.c(v) * v.Cms_m_per_N)),
    v => v.Cms_m_per_N > 0),
]);

/** Block 5: Rms, Qms and Mms from Fs and the other two. WinISD has no route deriving Fs from this triple. */
export const RMS_QMS_MMS_ROUTES: readonly DriverRoute[] = Object.freeze([
  new SolveRoute('Rms_kg_per_s', ['Fs_hz', 'Mms_kg', 'Qms'], v => TAU * v.Fs_hz * v.Mms_kg / v.Qms),
  new SolveRoute('Qms', ['Fs_hz', 'Mms_kg', 'Rms_kg_per_s'], v => TAU * v.Fs_hz * v.Mms_kg / v.Rms_kg_per_s),
  new SolveRoute('Mms_kg', ['Fs_hz', 'Qms', 'Rms_kg_per_s'], v => v.Rms_kg_per_s * v.Qms / (TAU * v.Fs_hz), v => v.Fs_hz > 0),
]);

/** Block 6: Qes, Re, BL and Mms from the other four of Qes, BL, Fs, Mms, Re. Fs from this group is block 3 rel 2. */
export const MOTOR_ROUTES: readonly DriverRoute[] = Object.freeze([
  new SolveRoute('Qes', ['Fs_hz', 'Mms_kg', 'Re_ohm', 'BL_Tm'], v => TAU * v.Fs_hz * v.Mms_kg * v.Re_ohm / (v.BL_Tm * v.BL_Tm)),
  new SolveRoute('Re_ohm', ['Qes', 'BL_Tm', 'Fs_hz', 'Mms_kg'], v => v.Qes * v.BL_Tm * v.BL_Tm / (TAU * v.Fs_hz * v.Mms_kg)),
  new SolveRoute('BL_Tm', ['Qes', 'Re_ohm', 'Fs_hz', 'Mms_kg'],
    v => Math.sqrt(TAU * v.Fs_hz * v.Mms_kg * v.Re_ohm / v.Qes), v => v.Qes > 0),
  new SolveRoute('Mms_kg', ['Qes', 'BL_Tm', 'Fs_hz', 'Re_ohm'],
    v => v.Qes * v.BL_Tm * v.BL_Tm / (TAU * v.Fs_hz * v.Re_ohm), v => v.Fs_hz > 0 && v.Re_ohm > 0),
]);
