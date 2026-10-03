import {depthFromDims, dvolFromDims, magDepthFromDims, magnetFromDims} from '../../dvolRelation.js';
import {SolveRoute} from './SolveRoute.js';
import type {DriverRoute} from './SolveRoute.js';
import {DD_FROM_SD, VD_FROM_EXCURSION} from './relations.js';

/** Block 1: Sd and Dd from each other. */
export const SD_DD_ROUTES: readonly DriverRoute[] = Object.freeze([
  new SolveRoute('Sd_m2', ['Dd_m'], v => Math.PI * (v.Dd_m / 2) ** 2, v => v.Dd_m > 0).inRelation(DD_FROM_SD),
  new SolveRoute('Dd_m', ['Sd_m2'], v => 2 * Math.sqrt(v.Sd_m2 / Math.PI), v => v.Sd_m2 > 0).inRelation(DD_FROM_SD),
]);

/**
 * Block 7: Xmax, Hc, Hg. Precedence between the two Xmax routes is on the RESULT, not the route:
 * WinISD prefers abs(Hc-Hg)/2, but an equal overhang gives 0, not an excursion limit, so it falls
 * through to Vd/Sd. Probe case G, ledger QO39/QO40.
 */
export const XMAX_ROUTES: readonly DriverRoute[] = Object.freeze([
  new SolveRoute('Xmax_m', ['Hc_m', 'Hg_m'], v => Math.abs(v.Hc_m - v.Hg_m) / 2, v => v.Hc_m !== v.Hg_m),
  new SolveRoute('Hc_m', ['Xmax_m', 'Hg_m'], v => v.Hg_m > 2 * v.Xmax_m ? v.Hg_m - 2 * v.Xmax_m : v.Hg_m + 2 * v.Xmax_m),
  new SolveRoute('Hg_m', ['Xmax_m', 'Hc_m'], v => v.Hc_m > 2 * v.Xmax_m ? v.Hc_m - 2 * v.Xmax_m : v.Hc_m + 2 * v.Xmax_m),
  new SolveRoute('Xmax_m', ['Vd_m3', 'Sd_m2'], v => v.Vd_m3 / v.Sd_m2, v => v.Sd_m2 > 0).inRelation(VD_FROM_EXCURSION),
]);

/** Block 8: Sd fallback from Vd and Xmax. */
export const SD_FROM_VD_ROUTES: readonly DriverRoute[] = Object.freeze([
  new SolveRoute('Sd_m2', ['Vd_m3', 'Xmax_m'], v => v.Vd_m3 / v.Xmax_m, v => v.Xmax_m > 0).inRelation(VD_FROM_EXCURSION),
]);

/** Block 9: Vd. */
export const VD_ROUTES: readonly DriverRoute[] = Object.freeze([
  new SolveRoute('Vd_m3', ['Sd_m2', 'Xmax_m'], v => v.Sd_m2 * v.Xmax_m).inRelation(VD_FROM_EXCURSION),
]);

/**
 * Block 9b: the DVol/Depth/MagDepth/Magnet geometry lock (WINISD_SCHEMA.md §3.10.1). The four are
 * bound by one equation over Dd and Vcd, so any absent member solves from the rest. The formulas
 * own their domain checks and return null on a degenerate geometry (dvolRelation.ts).
 */
export const MAGNET_ROUTES: readonly DriverRoute[] = Object.freeze([
  new SolveRoute('DVol_m3', ['Dd_m', 'Vcd_m', 'Depth_m', 'MagDepth_m', 'Magnet_m'],
    v => dvolFromDims({Dd: v.Dd_m, Vcd: v.Vcd_m, Depth: v.Depth_m, MagDepth: v.MagDepth_m, Magnet: v.Magnet_m})),
  new SolveRoute('Depth_m', ['Dd_m', 'Vcd_m', 'DVol_m3', 'MagDepth_m', 'Magnet_m'],
    v => depthFromDims({Dd: v.Dd_m, Vcd: v.Vcd_m, DVol: v.DVol_m3, MagDepth: v.MagDepth_m, Magnet: v.Magnet_m})),
  new SolveRoute('MagDepth_m', ['Dd_m', 'Vcd_m', 'DVol_m3', 'Depth_m', 'Magnet_m'],
    v => magDepthFromDims({Dd: v.Dd_m, Vcd: v.Vcd_m, DVol: v.DVol_m3, Depth: v.Depth_m, Magnet: v.Magnet_m})),
  new SolveRoute('Magnet_m', ['Dd_m', 'Vcd_m', 'DVol_m3', 'Depth_m', 'MagDepth_m'],
    v => magnetFromDims({Dd: v.Dd_m, Vcd: v.Vcd_m, DVol: v.DVol_m3, Depth: v.Depth_m, MagDepth: v.MagDepth_m})),
]);
