/**
 * The closed set of chart curves the engine can draw, and which of them apply to a given box
 * type — a design decision, not a UI one (bugs/BUG_20260927_winisd-charts-missing.md, John
 * 2026-09-27): "a chart is listed where it logically applies to a component the project has" —
 * port charts for a ported box, PR charts for a radiator, the ten box-agnostic system charts
 * and the three EQ/filter charts always. NEVER "when the data exists" — a chart WinISD draws
 * for every box of that shape stays listed even on the day its own OpenISD data is still a bug.
 *
 * `bandpass6`/`abc` add `RearPort`/`FrontPort` the same way: by WinISD's own menu shape
 * (`SweepResult.pvRear` fills the rear one, `BoxModel.ts`'s `BoxOutput.UPr` doc). WinISD's ABC
 * menu also has an intra-chamber-port-velocity row (`IntraPort` below, `SweepResult.pvIntra`,
 * `UPi` — `BoxModel.ts`'s own doc, `boxes/AbcBox.ts`).
 */
import type {BoxType} from './types.js';

/**
 * WinISD's own chart-menu row order (winisd_research runs/*\/charts.json `popup_row` 0..20;
 * GHIDRA_FINDINGS.md "Passive radiator", "Vented box", "4th-order bandpass", "6th-order
 * bandpass", "ABC (Aperiodic Bi-Chamber)" sections).
 */
export type ChartId =
  | 'TFMag' | 'Phase' | 'GD' | 'MaxPwr' | 'MaxSPL' | 'VA' | 'SPL' | 'Excursion'
  | 'Zmag' | 'Zph' | 'PRTFMag' | 'PRTFPhase' | 'PRExcursion' | 'RearPort' | 'RearPortGain' | 'FrontPort'
  | 'FrontPortGain' | 'IntraPort' | 'FltMag' | 'FltPhase' | 'FltGD';

/** Every `ChartId`, in WinISD's own chart-menu row order — the ordered superset `chartsFor`
 *  filters down to what a box actually has. `IntraPort` is ABC's own chart-21 row
 *  (winisd_research/GHIDRA_FINDINGS.md "ABC (Aperiodic Bi-Chamber)" "Charts" bullet), grouped
 *  here with the other port charts rather than at its own high row number. */
const CHART_ORDER: readonly ChartId[] = Object.freeze([
  'TFMag', 'Phase', 'GD', 'MaxPwr', 'MaxSPL', 'VA', 'SPL', 'Excursion',
  'Zmag', 'Zph', 'PRTFMag', 'PRTFPhase', 'PRExcursion', 'RearPort', 'RearPortGain', 'FrontPort',
  'FrontPortGain', 'IntraPort', 'FltMag', 'FltPhase', 'FltGD',
]);

/** The chart a fresh project, or an invalid/inapplicable remembered chart id, falls back to. */
export const DEFAULT_CHART: ChartId = 'SPL';

/** The box type the chart menu assumes when no project is focused at all — WinISD's own
 *  type-in default box. */
export const DEFAULT_BOX_TYPE: BoxType = 'sealed';

/** Charts every box shows: ten properties of the driver+box system, plus the filter chain's
 *  own three charts — the filter chain is always part of the project, regardless of box. */
const UNIVERSAL: readonly ChartId[] = Object.freeze([
  'TFMag', 'Phase', 'GD', 'MaxPwr', 'MaxSPL', 'VA', 'SPL', 'Excursion', 'Zmag', 'Zph',
  'FltMag', 'FltPhase', 'FltGD',
]);

/**
 * The charts a project with box type `box` shows, in WinISD's own chart-menu order — the ONE
 * place that decides, over the full `BoxType` (switch with a `never` arm so a new box type is
 * a compile error here, not a silently short chart list).
 */
export function chartsFor(box: BoxType): readonly ChartId[] {
  const set = new Set<ChartId>(UNIVERSAL);
  switch (box) {
    case 'sealed':
      break;
    case 'vented':
      set.add('RearPort');
      set.add('RearPortGain');
      break;
    case 'bandpass4':
      set.add('FrontPort');
      set.add('FrontPortGain');
      break;
    case 'bandpass6':
      set.add('RearPort');
      set.add('FrontPort');
      break;
    case 'abc':
      set.add('RearPort');
      set.add('FrontPort');
      set.add('IntraPort');
      break;
    case 'box-passive-radiator':
      set.add('PRTFMag');
      set.add('PRTFPhase');
      set.add('PRExcursion');
      break;
  }
  return CHART_ORDER.filter(id => set.has(id));
}
