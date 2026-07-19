import { C } from '@openisd/engine';
import type { Driver, BoxType, SweepParams, SweepResult, MaxCurvesResult, DriverError } from '@openisd/engine';
import { DPAL } from '../presets.js';
import type { Series, PlotData, Design } from '../types.js';

interface TabMeta { id: string; name: string; unit: string; color: string }

export const TABS: TabMeta[] = [
  { id:'SPL',    name:'SPL response',    unit:'dB',  color:'#4fb0ff' },
  { id:'Excursion', name:'Cone excursion', unit:'mm', color:'#ffb454' },
  { id:'Port',   name:'Air velocity',    unit:'m/s', color:'#5ad17a' },
  { id:'GD',     name:'Group delay',     unit:'ms',  color:'#c08bff' },
  { id:'Zmag',   name:'Impedance',       unit:'Ω',   color:'#ff6b6b' },
  { id:'Zph',    name:'Impedance phase', unit:'°',   color:'#ff9bb0' },
  { id:'Phase',  name:'Transfer phase',  unit:'°',   color:'#7fd4ff' },
  { id:'MaxSPL', name:'Maximum SPL',     unit:'dB',  color:'#5ad17a' },
  { id:'MaxPwr', name:'Maximum power',   unit:'W',   color:'#ffd05a' },
];

interface SeriesBundle { series: Series[]; ymin: number; ymax: number; logy: boolean; unit: string }

export function seriesFor(tabId: string, drv: Driver, box: BoxType, P: SweepParams, sw: SweepResult, mx: MaxCurvesResult, bare = false): SeriesBundle {
  const meta = TABS.find(t => t.id === tabId)!;
  let series: Series[] = [], ymin = 0, ymax = 1;
  let logy = false;
  const unit = meta.unit;
  const pick = (arr: number[]) => ({ xs: sw.fs, ys: arr });

  if (tabId === 'SPL') {
    series = [{ ...pick(sw.spl), color: meta.color, name: 'SPL' }];
    // Ignore the -200 dB "no output" sentinel (sweep uses it where |p|=0) so it
    // can't drag the scale to nonsense; fit to the real visible curve.
    const real = sw.spl.filter(v => Number.isFinite(v) && v > -190);
    const mx2 = real.length ? Math.max(...real) : 0;
    const lo  = real.length ? Math.min(...real) : mx2 - 45;
    ymax = Math.ceil((mx2 + 3) / 5) * 5;
    // Bring the bottom of the visible curve fully into frame, keeping at least a 45 dB window.
    ymin = Math.min(ymax - 45, Math.floor((lo - 3) / 5) * 5);
    // F3 / F6: first frequency (low→high) where SPL reaches within N dB of the passband peak.
    // Same reference as StatBar.findF3 — max SPL across the sweep.
    const rolloff = (drop: number): number | null => { for (let i = 0; i < sw.fs.length; i++) if (sw.spl[i] >= mx2 - drop) return sw.fs[i]; return null; };
    // Reference lines (F3/F6/F10) + their legend — OpenISD value-add, but WinISD's plot is
    // a bare trace, so the classic skin passes bare=true to suppress them (also removes the
    // in-plot legend, since only one named series remains).
    if (!bare) {
      const f3 = rolloff(3), f6 = rolloff(6), f10 = rolloff(10);
      if (f3  != null) series.push({ xs: sw.fs, ys: sw.fs.map(() => mx2 -  3), color: '#ffb454', name: `F3 = ${f3.toFixed(0)} Hz`,  dash: true });
      if (f6  != null) series.push({ xs: sw.fs, ys: sw.fs.map(() => mx2 -  6), color: '#ff6b6b', name: `F6 = ${f6.toFixed(0)} Hz`,  dash: true });
      if (f10 != null) series.push({ xs: sw.fs, ys: sw.fs.map(() => mx2 - 10), color: '#c08bff', name: `F10 = ${f10.toFixed(0)} Hz`, dash: true });
    }
  } else if (tabId === 'Excursion') {
    series = [{ ...pick(sw.exc), color: meta.color, name: 'Cone' }];
    // Xmax limit line — omitted when Xmax is absent (the cone curve stays reliable;
    // the missing line is surfaced to the user as a dismissable issue elsewhere).
    const xm = drv.Xmax! > 0 ? drv.Xmax! * 1000 : null;
    if (xm != null) series.push({ xs: sw.fs, ys: sw.fs.map(() => xm), color:'#ff6b6b', name:'Xmax', dash:true });
    let top = Math.max((xm || 0) * 1.4, Math.max(...sw.exc.slice(0, 20)) * 1.1);
    if (box === 'pr') {
      series.push({ xs: sw.fs, ys: sw.excPR, color:'#5ad17a', name:'PR' });
      const xmp = (P.prXmax || 0.01) * 1000;
      series.push({ xs: sw.fs, ys: sw.fs.map(() => xmp), color:'#9ad17a', name:'PR Xmax', dash:true });
      top = Math.max(top, xmp * 1.3, Math.max(...sw.excPR.slice(0, 30)) * 1.1);
    }
    ymin = 0; ymax = top;
  } else if (tabId === 'Port') {
    if (box !== 'vented' && box !== 'bandpass4') {
      series = [{ xs: sw.fs, ys: sw.fs.map(() => 0), color: meta.color, name: 'n/a' }]; ymin = 0; ymax = 1;
    } else {
      series = [{ ...pick(sw.pv), color: meta.color, name: 'Port vel' }];
      series.push({ xs: sw.fs, ys: sw.fs.map(() => 0.05 * C), color:'#ffb454', name:'17 m/s', dash:true });
      ymin = 0; ymax = Math.max(20, Math.max(...sw.pv) * 1.1);
    }
  } else if (tabId === 'GD') {
    series = [{ ...pick(sw.gd), color: meta.color, name: 'Group delay' }];
    const mx2 = Math.max(...sw.gd.filter(isFinite)); ymin = 0; ymax = Math.max(mx2 * 1.1, 5);
  } else if (tabId === 'Zmag') {
    series = [{ ...pick(sw.zmag), color: meta.color, name: '|Z|' }];
    logy = true; ymin = Math.max(1, Math.min(...sw.zmag) * 0.9); ymax = Math.max(...sw.zmag) * 1.15;
  } else if (tabId === 'Zph') {
    series = [{ ...pick(sw.zph), color: meta.color, name: 'Z phase' }]; ymin = -90; ymax = 90;
  } else if (tabId === 'Phase') {
    series = [{ xs: sw.fs, ys: sw.phase.map(p => p * 180 / Math.PI), color: meta.color, name: 'Phase' }];
    const ys = series[0].ys; ymin = Math.floor(Math.min(...ys) / 90) * 90; ymax = Math.ceil(Math.max(...ys) / 90) * 90;
  } else if (tabId === 'MaxSPL') {
    series = [{ xs: mx.fs, ys: mx.maxspl, color: meta.color, name: 'Max SPL', xlim: mx.xlim }];
    const real = mx.maxspl.filter(v => Number.isFinite(v) && v > -190);
    const mx2 = real.length ? Math.max(...real) : 0;
    const lo  = real.length ? Math.min(...real) : mx2 - 40;
    ymax = Math.ceil(mx2 / 5) * 5;
    // Fit the bottom of the curve fully into frame, keeping at least a 40 dB window.
    ymin = Math.min(ymax - 40, Math.floor((lo - 3) / 5) * 5);
    if (mx.xlim && !mx.peAbsent) {
      // Phantom legend entries replace the generic "Max SPL" label when both limits apply.
      series[0].name = '';
      series.push({ xs: [], ys: [], color: meta.color, name: 'Xmax limit', phantom: true });
      series.push({ xs: [], ys: [], color: '#ffb454',  name: 'Pe limit',   phantom: true });
    }
  } else if (tabId === 'MaxPwr') {
    series = [{ xs: mx.fs, ys: mx.maxpwr, color: meta.color, name: 'Max power' }];
    logy = true; ymin = 1; ymax = Math.max(...mx.maxpwr) * 1.2;
  }
  return { series, ymin, ymax, logy, unit };
}

// Returns { value, errors } per the project's Go-inspired contract (js-patterns.md).
//   value:  the plot-ready series bundle, or null when there is nothing to draw.
//   errors: the driver-derivation issues (passed through) so the caller can explain
//           WHY a chart is not drawn — it never has to inspect store internals itself.
// A chart is not drawable when the derived driver is missing (a required T/S param is
// invalid) or the sweep results are not ready yet (the debounced sweep hasn't run since
// the driver last changed). Both collapse to value:null here; the caller distinguishes
// "blocked" (errors present) from "not ready yet" (errors empty) via the errors array.
export function buildPlotData(
  tabId: string,
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
  // so Modern (which never sets `visible`) renders exactly as before.
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
    // Classic (WinISD) trace colour for the active project — matches its Color swatch.
    if (di === 0 && opts.primaryColor) prim.color = opts.primaryColor;
    out.series.push(prim);
    if (di === 0) for (let k = 1; k < pd.series.length; k++) out.series.push(pd.series[k]);
    out.ymin = Math.min(out.ymin, pd.ymin); out.ymax = Math.max(out.ymax, pd.ymax);
    out.logy = out.logy || pd.logy;
  });
  return { value: out, errors };
}
