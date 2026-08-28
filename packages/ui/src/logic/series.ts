import { Engine } from '@openisd/design/engine';
import type { EngineDriver, BoxType, SweepResult, MaxCurvesResult, DriverError } from '@openisd/design/engine';
import type { Series, PlotData, Design, PlotParams, ChartTabId } from '../types.js';

export const DPAL = ['#4fb0ff','#ffb454','#5ad17a','#ff6b6b','#c08bff'];


interface TabMeta { id: ChartTabId; name: string; unit: string; color: string }

/**
 * Hue follows the QUANTITY, not the chart: the three filter-chain charts reuse the hue of
 * the system chart showing the same physical quantity (dB magnitude / degrees / ms), so a
 * reader's colour→quantity mapping holds across the whole chart menu. Declaration order
 * here is the order `TABS` presents.
 */
export const TAB_META: Record<ChartTabId, TabMeta> = {
  SPL:       { id:'SPL',       name:'SPL response',    unit:'dB',  color:'#4fb0ff' },
  // Same underlying response as SPL (docs/research/WINISD_PARITY.md §17, verified from real WinISD screenshots:
  // identical cursor value in both charts) — renormalized so 0 dB = passband output, with a
  // dashed -3 dB reference line. A DISPLAY MODE derived from the same sweep, not a new engine
  // computation; see the 'TFMag' builder below.
  TFMag:     { id:'TFMag',     name:'Transfer function magnitude', unit:'dB', color:'#4fb0ff' },
  Excursion: { id:'Excursion', name:'Cone excursion',  unit:'mm', color:'#ffb454' },
  Port:      { id:'Port',      name:'Air velocity',    unit:'m/s', color:'#5ad17a' },
  GD:        { id:'GD',        name:'Group delay',     unit:'ms',  color:'#c08bff' },
  Zmag:      { id:'Zmag',      name:'Impedance',       unit:'Ω',   color:'#ff6b6b' },
  Zph:       { id:'Zph',       name:'Impedance phase', unit:'°',   color:'#ff9bb0' },
  Phase:     { id:'Phase',     name:'Transfer phase',  unit:'°',   color:'#7fd4ff' },
  MaxSPL:    { id:'MaxSPL',    name:'Maximum SPL',     unit:'dB',  color:'#5ad17a' },
  MaxPwr:    { id:'MaxPwr',    name:'Maximum power',   unit:'W',   color:'#ffd05a' },
  FltMag:    { id:'FltMag',    name:'Filter magnitude', unit:'dB', color:'#4fb0ff' },
  FltPhase:  { id:'FltPhase',  name:'Filter phase',    unit:'°',   color:'#7fd4ff' },
  FltGD:     { id:'FltGD',     name:'Filter group delay', unit:'ms', color:'#c08bff' },
};

export const TABS: TabMeta[] = (Object.keys(TAB_META) as ChartTabId[]).map(id => TAB_META[id]);

/**
 * The one string→member boundary. Anything the set does not declare is invalid data —
 * a stale chart id restored from `localStorage`, say — and is handled as missing, i.e.
 * the default chart, never as a second spelling to tolerate.
 */
export function parseChartTabId(v: string | null | undefined): ChartTabId {
  return (v != null && Object.prototype.hasOwnProperty.call(TAB_META, v)) ? v as ChartTabId : 'SPL';
}

/** SPL/filter-magnitude values at or below this are the engine's "no output" sentinel. */
const SILENCE_DB = -190;
const realDb = (ys: number[]) => ys.filter(v => Number.isFinite(v) && v > SILENCE_DB);

interface SeriesBundle { series: Series[]; ymin: number; ymax: number; logy: boolean; unit: string }

/** Everything a curve builder may read. */
interface CurveCtx {
  meta: TabMeta;
  drv: EngineDriver;
  box: BoxType;
  P: PlotParams;
  sw: SweepResult;
  mx: MaxCurvesResult;
  bare: boolean;
  pick: (arr: number[]) => { xs: number[]; ys: number[] };
}

/** A builder's output. `logy` defaults to false; `unit` always comes from the tab's meta. */
type CurveBuild = { series: Series[]; ymin: number; ymax: number; logy?: boolean };

const CURVE_BUILDERS: Record<ChartTabId, (c: CurveCtx) => CurveBuild> = {
  SPL: ({ meta, P, sw, bare, pick }) => {
    // "SPL graph is Xmax limited" (WinISD Advanced) swaps in the curve the design can
    // actually reach before the cone runs out of travel. The raw curve is drawn alongside
    // it, dashed, wherever the two differ — the whole point of the option is seeing the gap.
    const limited = !!P.splXmaxLimited && sw.xlimited.some(Boolean);
    const ys = P.splXmaxLimited ? sw.splXlim : sw.spl;
    const series: Series[] = [{ ...pick(ys), color: meta.color, name: limited ? 'SPL (Xmax limited)' : 'SPL' }];
    if (limited)
      series.push({ ...pick(sw.spl), color: '#8a99ab', name: 'Unlimited', dash: true });
    // Ignore the -200 dB "no output" sentinel (sweep uses it where |p|=0) so it
    // can't drag the scale to nonsense; fit to the real visible curve.
    const real = realDb(ys);
    const mx2 = new Engine().passbandRef(ys);
    const lo  = real.length ? Math.min(...real) : mx2 - 45;
    const ymax = Math.ceil((mx2 + 3) / 5) * 5;
    // Bring the bottom of the visible curve fully into frame, keeping at least a 45 dB window.
    const ymin = Math.min(ymax - 45, Math.floor((lo - 3) / 5) * 5);
    // Reference lines (F3/F6/F10) + their legend — OpenISD value-add, but WinISD's plot is
    // a bare trace, so the caller passes bare=true to suppress them (also removes the
    // in-plot legend, since only one named series remains).
    if (!bare) {
      const engine = new Engine();
      const f3 = engine.rolloffFreq(sw, 3), f6 = engine.rolloffFreq(sw, 6), f10 = engine.rolloffFreq(sw, 10);
      if (f3  != null) series.push({ xs: sw.fs, ys: sw.fs.map(() => mx2 -  3), color: '#ffb454', name: `F3 = ${f3.toFixed(0)} Hz`,  dash: true });
      if (f6  != null) series.push({ xs: sw.fs, ys: sw.fs.map(() => mx2 -  6), color: '#ff6b6b', name: `F6 = ${f6.toFixed(0)} Hz`,  dash: true });
      if (f10 != null) series.push({ xs: sw.fs, ys: sw.fs.map(() => mx2 - 10), color: '#c08bff', name: `F10 = ${f10.toFixed(0)} Hz`, dash: true });
    }
    return { series, ymin, ymax };
  },

  TFMag: ({ meta, sw }) => {
    // The engine calculates sw.tfMag normalized so 0 dB = high-frequency passband asymptote.
    // The 0 dB / -3 dB reference lines are the chart's defining feature, so they're always drawn.
    const rel = sw.tfMag;
    const series: Series[] = [{ xs: sw.fs, ys: rel, color: meta.color, name: 'Transfer function' }];
    series.push({ xs: sw.fs, ys: sw.fs.map(() => 0), color: '#8a99ab', name: '0 dB', dash: true });
    series.push({ xs: sw.fs, ys: sw.fs.map(() => -3), color: '#ffb454', name: '−3 dB', dash: true });
    const relReal = realDb(rel);
    const loRel = relReal.length ? Math.min(...relReal) : -45;
    const ymax = 5;
    return { series, ymin: Math.min(ymax - 45, Math.floor((loRel - 3) / 5) * 5), ymax };
  },

  Excursion: ({ meta, drv, box, P, sw, pick }) => {
    const series: Series[] = [{ ...pick(sw.exc), color: meta.color, name: 'Cone' }];
    // Xmax limit line — omitted when Xmax is absent (the cone curve stays reliable;
    // the missing line is surfaced to the user as a dismissable issue elsewhere).
    const xm = drv.Xmax! > 0 ? drv.Xmax! * 1000 : null;
    if (xm != null) series.push({ xs: sw.fs, ys: sw.fs.map(() => xm), color:'#ff6b6b', name:'Xmax', dash:true });
    let top = Math.max((xm || 0) * 1.4, Math.max(...sw.exc.slice(0, 20)) * 1.1);
    if (box === 'box-passive-radiator') {
      series.push({ xs: sw.fs, ys: sw.excPR, color:'#5ad17a', name:'PR' });
      const xmp = (P.prXmax || 0.01) * 1000;
      series.push({ xs: sw.fs, ys: sw.fs.map(() => xmp), color:'#9ad17a', name:'PR Xmax', dash:true });
      top = Math.max(top, xmp * 1.3, Math.max(...sw.excPR.slice(0, 30)) * 1.1);
    }
    return { series, ymin: 0, ymax: top };
  },

  Port: ({ meta, box, sw, pick }) => {
    if (box !== 'vented' && box !== 'bandpass4')
      return { series: [{ xs: sw.fs, ys: sw.fs.map(() => 0), color: meta.color, name: 'n/a' }], ymin: 0, ymax: 1 };
    const series: Series[] = [{ ...pick(sw.pv), color: meta.color, name: 'Port vel' }];
    const machLimit = 0.05 * new Engine().airFor({}).c;
    series.push({ xs: sw.fs, ys: sw.fs.map(() => machLimit), color:'#ffb454', name:'17 m/s', dash:true });
    return { series, ymin: 0, ymax: Math.max(20, Math.max(...sw.pv) * 1.1) };
  },

  GD: ({ meta, sw, pick }) => {
    const series: Series[] = [{ ...pick(sw.gd), color: meta.color, name: 'Group delay' }];
    const mx2 = Math.max(...sw.gd.filter(isFinite));
    return { series, ymin: 0, ymax: Math.max(mx2 * 1.1, 5) };
  },

  Zmag: ({ meta, sw, pick }) => ({
    series: [{ ...pick(sw.zmag), color: meta.color, name: '|Z|' }],
    logy: true,
    ymin: Math.max(1, Math.min(...sw.zmag) * 0.9),
    ymax: Math.max(...sw.zmag) * 1.15,
  }),

  Zph: ({ meta, sw, pick }) => ({
    series: [{ ...pick(sw.zph), color: meta.color, name: 'Z phase' }], ymin: -90, ymax: 90,
  }),

  Phase: ({ meta, sw }) => {
    const ys = sw.phase.map(p => p * 180 / Math.PI);
    return {
      series: [{ xs: sw.fs, ys, color: meta.color, name: 'Phase' }],
      ymin: Math.floor(Math.min(...ys) / 90) * 90,
      ymax: Math.ceil(Math.max(...ys) / 90) * 90,
    };
  },

  MaxSPL: ({ meta, mx }) => {
    const series: Series[] = [{ xs: mx.fs, ys: mx.maxspl, color: meta.color, name: 'Max SPL', xlim: mx.xlim }];
    const real = realDb(mx.maxspl);
    const mx2 = real.length ? Math.max(...real) : 0;
    const lo  = real.length ? Math.min(...real) : mx2 - 40;
    const ymax = Math.ceil(mx2 / 5) * 5;
    // Fit the bottom of the curve fully into frame, keeping at least a 40 dB window.
    const ymin = Math.min(ymax - 40, Math.floor((lo - 3) / 5) * 5);
    if (mx.xlim && !mx.peAbsent) {
      // Phantom legend entries replace the generic "Max SPL" label when both limits apply.
      series[0].name = '';
      series.push({ xs: [], ys: [], color: meta.color, name: 'Xmax limit', phantom: true });
      series.push({ xs: [], ys: [], color: '#ffb454',  name: 'Pe limit',   phantom: true });
    }
    return { series, ymin, ymax };
  },

  MaxPwr: ({ meta, mx }) => ({
    series: [{ xs: mx.fs, ys: mx.maxpwr, color: meta.color, name: 'Max power' }],
    logy: true, ymin: 1, ymax: Math.max(...mx.maxpwr) * 1.2,
  }),

  // ---- The EQ/filter chain's own response (WinISD's three "(EQ/Filter)" charts) --------
  // The chain is an ELECTRICAL block ahead of the driver, so all three are properties of
  // the filter list alone — the driver and box do not appear in any of them. WinISD Pro
  // help, "Filter/equalizer behavioral simulator": "Filter system is logically located at
  // electrical side. 0 dB gain at filter chain means that voltage at driver terminal is
  // equal that is specified at 'signal'-tab."
  FltMag: ({ meta, sw, pick }) => {
    const series: Series[] = [{ ...pick(sw.fltMag), color: meta.color, name: 'Filter chain' }];
    // Unity gain is this chart's DEFINING datum (it is what the help pins 0 dB to), not an
    // optional annotation, so it is drawn in the bare mode too — same reasoning as
    // TFMag's 0 dB line.
    series.push({ xs: sw.fs, ys: sw.fs.map(() => 0), color: '#8a99ab', name: '0 dB', dash: true });
    const real = realDb(sw.fltMag);
    const hi = real.length ? Math.max(...real, 0) : 0;
    const lo = real.length ? Math.min(...real, 0) : 0;
    return { series, ymin: Math.floor((lo - 3) / 5) * 5, ymax: Math.ceil((hi + 3) / 5) * 5 };
  },

  FltPhase: ({ meta, sw }) => {
    const ys = sw.fltPhase.map(p => p * 180 / Math.PI);
    const real = ys.filter(Number.isFinite);
    let ymin = real.length ? Math.floor(Math.min(...real) / 90) * 90 : -90;
    let ymax = real.length ? Math.ceil(Math.max(...real) / 90) * 90 : 90;
    // An empty (or all-pass-flat) chain sits at exactly 0° everywhere, which would collapse
    // the axis to zero height — keep one 90° division either side so the flat line is visible.
    if (ymax - ymin < 90) { ymin -= 90; ymax += 90; }
    return { series: [{ xs: sw.fs, ys, color: meta.color, name: 'Filter chain' }], ymin, ymax };
  },

  FltGD: ({ meta, sw, pick }) => {
    const real = sw.fltGd.filter(Number.isFinite);
    // Unlike the system curve, filter group delay goes NEGATIVE (a cut in a parametric EQ
    // is a phase lead), so the floor is taken from the data rather than pinned at 0.
    const lo = real.length ? Math.min(...real, 0) : 0;
    const hi = real.length ? Math.max(...real) : 0;
    // The floor stays strictly below zero: the default project has no filters, so the
    // curve is flat at 0 ms, and a floor OF zero would draw it along the frame where it
    // reads as the axis rather than as data.
    return {
      series: [{ ...pick(sw.fltGd), color: meta.color, name: 'Filter chain' }],
      ymin: Math.min(-1, lo * 1.1), ymax: Math.max(hi * 1.1, 5),
    };
  },
};

export function seriesFor(tabId: ChartTabId, drv: EngineDriver, box: BoxType, P: PlotParams, sw: SweepResult, mx: MaxCurvesResult, bare = false): SeriesBundle {
  const meta = TAB_META[tabId];
  const built = CURVE_BUILDERS[tabId]({
    meta, drv, box, P, sw, mx, bare,
    pick: (arr: number[]) => ({ xs: sw.fs, ys: arr }),
  });
  return { series: built.series, ymin: built.ymin, ymax: built.ymax, logy: built.logy ?? false, unit: meta.unit };
}

// Returns { value, errors } per the project's Go-inspired contract
// (.claude/rules/openisd-result-contract.md).
//   value:  the plot-ready series bundle, or null when there is nothing to draw.
//   errors: the driver-derivation issues (passed through) so the caller can explain
//           WHY a chart is not drawn — it never has to inspect store internals itself.
// A chart is not drawable when the derived driver is missing (a required T/S param is
// invalid) or the sweep results are not ready yet (the debounced sweep hasn't run since
// the driver last changed). Both collapse to value:null here; the caller distinguishes
// "blocked" (errors present) from "not ready yet" (errors empty) via the errors array.
export function buildPlotData(
  tabId: ChartTabId,
  fmin: number,
  fmax: number,
  currentDesign: Design,
  compare: Design[],
  errors: DriverError[] = [],
  opts: { bare?: boolean; primaryColor?: string } = {},
): { value: PlotData | null; errors: DriverError[] } {
  if (!currentDesign.driver || !currentDesign.curves || !currentDesign.maxCurves)
    return { value: null, errors };

  // Compare overlays may be hidden (visible === false) without being removed. Additive:
  // the current design is always drawn, and any overlay lacking the flag stays visible —
  // so a design that never sets `visible` is always drawn.
  const designs = [currentDesign, ...compare.filter(d => d.visible !== false)];
  const multi = designs.length > 1;
  let out: PlotData | null = null;
  designs.forEach((d, di) => {
    const pd = seriesFor(tabId, d.driver!, d.box, d.P, d.curves!, d.maxCurves || ({} as MaxCurvesResult), opts.bare);
    if (!out) out = { series: [], ymin: pd.ymin, ymax: pd.ymax, logy: pd.logy, unit: pd.unit, fmin, fmax };
    const prim: Series = { ...pd.series[0] };
    if (multi) {
      prim.color = d.color || DPAL[di % DPAL.length]; prim.name = d.name + ': ' + prim.name;
      if (di > 0) delete prim.xlim; // compare overlays: solid color, no segmented coloring
    }
    // WinISD trace colour for the active project — matches its Color swatch.
    if (di === 0 && opts.primaryColor) prim.color = opts.primaryColor;
    out.series.push(prim);
    if (di === 0) for (let k = 1; k < pd.series.length; k++) out.series.push(pd.series[k]);
    out.ymin = Math.min(out.ymin, pd.ymin); out.ymax = Math.max(out.ymax, pd.ymax);
    out.logy = out.logy || pd.logy;
  });
  return { value: out, errors };
}

export interface RangeStats { peak: number; peakF: number | null; trough: number; ripple: number; avg: number }

/** Peak/trough/ripple/average of `series` over a dragged frequency band — the readout under
 *  the graph's band-select drag. Chart-annotation arithmetic on the already-drawn series, not
 *  a physics derivation, so it lives beside the series it reads rather than in the engine. */
export function rangeStatsOf(series: Series, fLo: number, fHi: number): RangeStats | null {
  let peakY = -Infinity, peakF: number | null = null, troughY = Infinity, sum = 0, n = 0;
  for (let i = 0; i < series.xs.length; i++) {
    if (series.xs[i] < fLo || series.xs[i] > fHi) continue;
    const y = series.ys[i];
    if (!isFinite(y)) continue;
    if (y > peakY) { peakY = y; peakF = series.xs[i]; }
    if (y < troughY) troughY = y;
    sum += y; n++;
  }
  if (!n) return null;
  return { peak: peakY, peakF, trough: troughY, ripple: peakY - troughY, avg: sum / n };
}
