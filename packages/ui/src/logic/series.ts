import type {BoxType, ChartId, DriverError, DriverSolverParams, Engine, MaxCurvesResult, SweepResult} from '@openisd/design/engine';
import type {Design, PlotData, PlotParams, Series} from '../types.js';

export const DPAL = ['#4fb0ff','#ffb454','#5ad17a','#ff6b6b','#c08bff'];


interface TabMeta { id: ChartId; name: string; unit: string; color: string }

/**
 * Hue follows the QUANTITY, not the chart: the three filter-chain charts reuse the hue of
 * the system chart showing the same physical quantity (dB magnitude / degrees / ms), so a
 * reader's colour→quantity mapping holds across the whole chart menu. Declaration order
 * here is the order `TABS` presents.
 */
export const TAB_META: Record<ChartId, TabMeta> = {
  SPL:       { id:'SPL',       name:'SPL response',    unit:'dB',  color:'#4fb0ff' },
  // Same underlying response as SPL (docs/research/WINISD_PARITY.md §17, verified from real WinISD screenshots:
  // identical cursor value in both charts) — renormalized so 0 dB = passband output, with a
  // dashed -3 dB reference line. A DISPLAY MODE derived from the same sweep, not a new engine
  // computation; see the 'TFMag' builder below.
  TFMag:     { id:'TFMag',     name:'Transfer function magnitude', unit:'dB', color:'#4fb0ff' },
  // WinISD's own radiator-only transfer function (packages/design/engine/sweep.ts prTfMag/
  // prTfPhase) — the driver's cone is not in it, so it gets its own hue rather than TFMag's.
  PRTFMag:   { id:'PRTFMag',   name:'Transfer function magnitude (PR)', unit:'dB', color:'#c08bff' },
  PRTFPhase: { id:'PRTFPhase', name:'Transfer function phase (PR)', unit:'°', color:'#c08bff' },
  Excursion: { id:'Excursion', name:'Cone excursion',  unit:'mm', color:'#ffb454' },
  // WinISD draws the radiator's own excursion as its own chart, not inside 'Excursion'
  // (BUG_20260927_winisd-charts-missing.md) — `sw.excPR` moved here.
  PRExcursion: { id:'PRExcursion', name:'Cone excursion (PR)', unit:'mm', color:'#5ad17a' },
  RearPort:  { id:'RearPort',  name:'Rear port - Air velocity', unit:'m/s', color:'#5ad17a' },
  // Same 0 dB / -3 dB passband-asymptote convention as TFMag (packages/design/engine/sweep.ts
  // rearPortGain) — unlike PRTFMag, this one IS run through the filter chain.
  RearPortGain: { id:'RearPortGain', name:'Rear port - Gain', unit:'dB', color:'#4fb0ff' },
  FrontPort: { id:'FrontPort', name:'Front port - Air velocity', unit:'m/s', color:'#5ad17a' },
  // Same 0 dB / -3 dB passband-asymptote convention as RearPortGain (packages/design/engine/sweep.ts
  // frontPortGain, the SAME computation as rearPortGain reused) — run through the filter chain.
  FrontPortGain: { id:'FrontPortGain', name:'Front port - Gain', unit:'dB', color:'#4fb0ff' },
  // ABC only (WinISD chart-21, GHIDRA_FINDINGS.md "ABC (Aperiodic Bi-Chamber)" "Charts" bullet) —
  // same air-velocity quantity/hue as RearPort/FrontPort, off `sw.pvIntra`.
  IntraPort: { id:'IntraPort', name:'Intra-chamber port - Air velocity', unit:'m/s', color:'#5ad17a' },
  GD:        { id:'GD',        name:'Group delay',     unit:'ms',  color:'#c08bff' },
  Zmag:      { id:'Zmag',      name:'Impedance',       unit:'Ω',   color:'#ff6b6b' },
  Zph:       { id:'Zph',       name:'Impedance phase', unit:'°',   color:'#ff9bb0' },
  Phase:     { id:'Phase',     name:'Transfer phase',  unit:'°',   color:'#7fd4ff' },
  MaxSPL:    { id:'MaxSPL',    name:'Maximum SPL',     unit:'dB',  color:'#5ad17a' },
  MaxPwr:    { id:'MaxPwr',    name:'Maximum power',   unit:'W',   color:'#ffd05a' },
  VA:        { id:'VA',        name:'Amplifier apparent load power', unit:'VA', color:'#ff9f6b' },
  FltMag:    { id:'FltMag',    name:'Filter magnitude', unit:'dB', color:'#4fb0ff' },
  FltPhase:  { id:'FltPhase',  name:'Filter phase',    unit:'°',   color:'#7fd4ff' },
  FltGD:     { id:'FltGD',     name:'Filter group delay', unit:'ms', color:'#c08bff' },
};

// `Object.values`, not `Object.keys().map()`: `Object.keys` answers `string[]` whatever it is
// given, so getting back to `TabMeta` took an assertion about what the keys are. The values
// ARE `TabMeta` by the declared type of `TAB_META`, and both preserve declaration order.
export const TABS: TabMeta[] = Object.values(TAB_META);

/**
 * The one string→member boundary. Anything the set does not declare is invalid data —
 * a stale chart id restored from `localStorage`, say — and is handled as missing, i.e.
 * the default chart, never as a second spelling to tolerate.
 */
export function parseChartId(engine: Engine, v: string | null | undefined): ChartId {
  // The id comes back off the MEMBER that matched, so it is a `ChartId` because `TabMeta.id`
  // is one — nothing asserts it. `hasOwnProperty` answered the same question correctly but
  // returns a boolean, which cannot narrow a `string`, so using its answer needed a cast.
  return TABS.find(t => t.id === v)?.id ?? engine.defaultChart;
}

/** SPL/filter-magnitude values at or below this are the engine's "no output" sentinel. */
const SILENCE_DB = -190;
const realDb = (ys: number[]) => ys.filter(v => Number.isFinite(v) && v > SILENCE_DB);

interface SeriesBundle { series: Series[]; ymin: number; ymax: number; logy: boolean; unit: string }

/** Everything a curve builder may read. */
interface CurveCtx {
  /** The one engine the composition root built — a curve builder never makes its own. */
  engine: Engine;
  meta: TabMeta;
  drv: DriverSolverParams;
  box: BoxType;
  P: PlotParams;
  sw: SweepResult;
  /** ABSENT when this design's max curves have not been produced — a compare overlay whose sweep
   *  has not run, say. Optional here rather than defaulted at the caller: a stand-in empty object
   *  is not a default, it is a value with no `fs` and no `maxspl`, so the two builders that read
   *  it crash instead of drawing nothing. Only those two touch it, and each says below what it
   *  does without one. */
  mx: MaxCurvesResult | undefined;
  bare: boolean;
  pick: (arr: number[]) => { xs: number[]; ys: number[] };
}

/** A builder's output. `logy` defaults to false; `unit` always comes from the tab's meta. */
type CurveBuild = { series: Series[]; ymin: number; ymax: number; logy?: boolean };

/** Port air velocity — shared by `RearPort` (vented, `bandpass6`, `abc`), `FrontPort`
 *  (`bandpass4`, `bandpass6`, `abc`) and `IntraPort` (`abc`): same quantity, same Mach-limit
 *  reference line, only the array differs. `vel` is `sw.pv` for `FrontPort` (`Solution.UP`'s own
 *  doc: `pv` is already the FRONT port for the two-port boxes); `RearPort` reads `sw.pvRear` when
 *  present (`bandpass6`/`abc`) and falls back to `sw.pv` otherwise (`vented`, whose one port IS
 *  the rear one — `SweepResult.pvRear`'s own doc); `IntraPort` reads `sw.pvIntra` (`null` outside
 *  `abc`'s own `winisd-lossy` branch, drawn as a flat zero rather than hiding the chart). */
function portVelocityBuild({ engine, meta, sw, pick }: CurveCtx, vel: number[]): CurveBuild {
  const series: Series[] = [{ ...pick(vel), color: meta.color, name: 'Port vel' }];
  // FIXME - magic number - what is 0.05 representing?
  const machLimit = 0.05 * engine.solveEnvironment({}).values.c;
  series.push({ xs: sw.fs, ys: sw.fs.map(() => machLimit), color:'#ffb454', name:'17 m/s', dash:true });
  return { series, ymin: 0, ymax: Math.max(20, Math.max(...vel) * 1.1) };
}

/** Port gain — shared by `RearPortGain` (vented) and `FrontPortGain` (bandpass4): same
 *  0 dB / -3 dB passband-asymptote convention as TFMag, only the underlying array (`sw.rearPortGain`
 *  vs `sw.frontPortGain`, packages/design/engine/sweep.ts) and its legend name differ. Unlike
 *  PRTFMag, both ARE run through the filter chain. */
function portGainBuild(rel: number[] | null, name: string, meta: TabMeta, sw: SweepResult): CurveBuild {
  const ys = rel ?? sw.fs.map(() => -200);
  const series: Series[] = [{ xs: sw.fs, ys, color: meta.color, name }];
  series.push({ xs: sw.fs, ys: sw.fs.map(() => 0), color: '#8a99ab', name: '0 dB', dash: true });
  series.push({ xs: sw.fs, ys: sw.fs.map(() => -3), color: '#ffb454', name: '−3 dB', dash: true });
  const relReal = realDb(ys);
  const loRel = relReal.length ? Math.min(...relReal) : -45;
  const ymax = 5;
  return { series, ymin: Math.min(ymax - 45, Math.floor((loRel - 3) / 5) * 5), ymax };
}

const CURVE_BUILDERS: Record<ChartId, (c: CurveCtx) => CurveBuild> = {
  SPL: ({ engine, meta, P, sw, bare, pick }) => {
    // "SPL graph is Xmax limited" (WinISD Advanced) swaps in the curve the design can
    // actually reach before the cone runs out of travel. The raw curve is drawn alongside
    // it, dashed, wherever the two differ — the whole point of the option is seeing the gap.
    const limited = !!P.splXmaxLimited && sw.xlimited.some(Boolean);
    const ys = P.splXmaxLimited ? sw.splXlimCurve : sw.spl;
    const series: Series[] = [{ ...pick(ys), color: meta.color, name: limited ? 'SPL (Xmax limited)' : 'SPL' }];
    if (limited)
      series.push({ ...pick(sw.spl), color: '#8a99ab', name: 'Unlimited', dash: true });
    // Ignore the -200 dB "no output" sentinel (sweep uses it where |p|=0) so it
    // can't drag the scale to nonsense; fit to the real visible curve.
    const real = realDb(ys);
    const mx2 = engine.passbandRef(ys);
    const lo  = real.length ? Math.min(...real) : mx2 - 45;
    const ymax = Math.ceil((mx2 + 3) / 5) * 5;
    // Bring the bottom of the visible curve fully into frame, keeping at least a 45 dB window.
    const ymin = Math.min(ymax - 45, Math.floor((lo - 3) / 5) * 5);
    // Reference lines (F3/F6/F10) + their legend — OpenISD value-add, but WinISD's plot is
    // a bare trace, so the caller passes bare=true to suppress them (also removes the
    // in-plot legend, since only one named series remains).
    if (!bare) {
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

  // WinISD's own radiator-only transfer function (packages/design/engine/sweep.ts prTfMag) —
  // `null` for a design whose box has no radiator (a compare overlay, say, while the focused
  // design is a passive-radiator box); that design then draws silence, exactly as a design
  // with no max curves draws nothing on MaxSPL.
  PRTFMag: ({ meta, sw }) => {
    const rel = sw.prTfMag ?? sw.fs.map(() => -200);
    const series: Series[] = [{ xs: sw.fs, ys: rel, color: meta.color, name: 'Transfer function (PR)' }];
    series.push({ xs: sw.fs, ys: sw.fs.map(() => 0), color: '#8a99ab', name: '0 dB', dash: true });
    series.push({ xs: sw.fs, ys: sw.fs.map(() => -3), color: '#ffb454', name: '−3 dB', dash: true });
    const relReal = realDb(rel);
    const loRel = relReal.length ? Math.min(...relReal) : -45;
    const ymax = 5;
    return { series, ymin: Math.min(ymax - 45, Math.floor((loRel - 3) / 5) * 5), ymax };
  },

  PRTFPhase: ({ meta, sw }) => {
    const ys = (sw.prTfPhase ?? sw.fs.map(() => 0)).map(p => p * 180 / Math.PI);
    return {
      series: [{ xs: sw.fs, ys, color: meta.color, name: 'Transfer phase (PR)' }],
      ymin: Math.floor(Math.min(...ys) / 90) * 90,
      ymax: Math.ceil(Math.max(...ys) / 90) * 90,
    };
  },

  Excursion: ({ meta, drv, sw, pick }) => {
    const series: Series[] = [{ ...pick(sw.exc), color: meta.color, name: 'Cone' }];
    // Xmax limit line — omitted when Xmax is absent (the cone curve stays reliable;
    // the missing line is surfaced to the user as a dismissable issue elsewhere).
    const drvXmax_m = drv.Xmax_m.value;
    const xm = drvXmax_m != null && drvXmax_m > 0 ? drvXmax_m * 1000 : null;
    if (xm != null) series.push({ xs: sw.fs, ys: sw.fs.map(() => xm), color:'#ff6b6b', name:'Xmax', dash:true });
    const top = Math.max((xm || 0) * 1.4, Math.max(...sw.exc.slice(0, 20)) * 1.1);
    return { series, ymin: 0, ymax: top };
  },

  // WinISD draws the radiator's own excursion as its own chart, not inside 'Excursion'
  // (BUG_20260927_winisd-charts-missing.md).
  PRExcursion: ({ meta, P, sw }) => {
    const xmp = (P.prXmax || 0.01) * 1000;
    const series: Series[] = [
      { xs: sw.fs, ys: sw.excPR, color: meta.color, name: 'PR' },
      { xs: sw.fs, ys: sw.fs.map(() => xmp), color: '#9ad17a', name: 'PR Xmax', dash: true },
    ];
    const top = Math.max(xmp * 1.3, Math.max(...sw.excPR.slice(0, 30)) * 1.1);
    return { series, ymin: 0, ymax: top };
  },

  // Applicable only to vented (RearPortGain) or bandpass4 (FrontPortGain) — design's
  // `chartsFor` gates the menu; a compare overlay of a different box type draws the -200 dB
  // silence fallback here, same as PRTFMag. Unlike PRTFMag, both ARE run through the filter
  // chain (packages/design/engine/sweep.ts rearPortGain/frontPortGain — one shared computation).
  RearPortGain: ({ meta, sw }) => portGainBuild(sw.rearPortGain, 'Rear port gain', meta, sw),
  FrontPortGain: ({ meta, sw }) => portGainBuild(sw.frontPortGain, 'Front port gain', meta, sw),

  // Applicable to vented/bandpass4/bandpass6/abc (rear) or bandpass4/bandpass6/abc (front) —
  // design's `chartsFor` gates the menu; a compare overlay of a different box type draws `pv`'s
  // own 0 curve here, same as any other chart. `portVelocityBuild`'s own doc says which array
  // each id reads.
  RearPort: (c) => portVelocityBuild(c, c.sw.pvRear ?? c.sw.pv),
  FrontPort: (c) => portVelocityBuild(c, c.sw.pv),
  IntraPort: (c) => portVelocityBuild(c, c.sw.pvIntra ?? c.sw.fs.map(() => 0)),

  GD: ({ meta, sw, pick }) => {
    const series: Series[] = [{ ...pick(sw.gd), color: meta.color, name: 'Group delay' }];
    const mx2 = Math.max(...sw.gd.filter(isFinite));
    return { series, ymin: 0, ymax: Math.max(mx2 * 1.1, 5) };
  },

  Zmag: ({ meta, sw, pick }) => ({
    series: [{ ...pick(sw.zmag), color: meta.color, name: '|Z|' }],
    logy: true,
    // FIXME - Magic number
    ymin: Math.max(1, Math.min(...sw.zmag) * 0.9),
    // FIXME - Magic number
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
    // Nothing to draw, and nothing wrong: this design has no max curves, so it contributes no
    // trace to this chart while every other design still draws its own.
    if (!mx) return { series: [], ymin: 0, ymax: 0 };
    const series: Series[] = [{ xs: mx.fs, ys: mx.maxspl, color: meta.color, name: 'Max SPL', xlim: mx.xlim }];
    const real = realDb(mx.maxspl);
    const mx2 = real.length ? Math.max(...real) : 0;
    const lo  = real.length ? Math.min(...real) : mx2 - 40;
    // FIXME - Magic number
    const ymax = Math.ceil(mx2 / 5) * 5;
    // Fit the bottom of the curve fully into frame, keeping at least a 40 dB window.
    // FIXME - Magic number
    const ymin = Math.min(ymax - 40, Math.floor((lo - 3) / 5) * 5);
    if (mx.xlim && !mx.peAbsent) {
      // Phantom legend entries replace the generic "Max SPL" label when both limits apply.
      series[0].name = '';
      series.push({ xs: [], ys: [], color: meta.color, name: 'Xmax limit', phantom: true });
      series.push({ xs: [], ys: [], color: '#ffb454',  name: 'Pe limit',   phantom: true });
    }
    return { series, ymin, ymax };
  },

  MaxPwr: ({ meta, mx }) => mx === undefined
    ? { series: [], logy: true, ymin: 1, ymax: 1 }
    : {
      series: [{ xs: mx.fs, ys: mx.maxpwr, color: meta.color, name: 'Max power' }],
      logy: true,
      // The excursion-limited floor drops well below 1 W at the low-frequency end — let the
      // axis follow it down so the curve stays inside the frame instead of running off the
      // bottom (QO: "Max power chart, left side below 10Hz missing").
      ymin: Math.min(1, Math.min(...mx.maxpwr) * 0.9),
      ymax: Math.max(...mx.maxpwr) * 1.2,
    },

  // WinISD's P·Re·|Hf|²/|Z + Rg| (engine `va`, docs/CHARTS.md) — linear, from 0 like WinISD's axis.
  VA: ({ meta, sw, pick }) => ({
    series: [{ ...pick(sw.va), color: meta.color, name: 'VA' }],
    ymin: 0,
    ymax: Math.max(...sw.va.filter(Number.isFinite)) * 1.2,
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

export function seriesFor(engine: Engine,
                          chartId: ChartId,
                          drv: DriverSolverParams,
                          box: BoxType,
                          P: PlotParams,
                          sw: SweepResult,
                          mx: MaxCurvesResult | undefined,
                          bare = false): SeriesBundle {
  const meta = TAB_META[chartId];
  const built = CURVE_BUILDERS[chartId]({
    engine, meta, drv, box, P, sw, mx, bare,
    pick: (arr: number[]) => ({ xs: sw.fs, ys: arr }),
  });
  return { series: built.series, ymin: built.ymin, ymax: built.ymax, logy: built.logy ?? false, unit: meta.unit };
}

/** Keep only failures in data this chart actually paints; shared input failures stay visible. */
export function errorsForChart(chartId: ChartId, errors: DriverError[]): DriverError[] {
  const output = (() => {
    switch (chartId) {
      case 'SPL': return 'SPL';
      case 'TFMag': return 'transfer magnitude';
      case 'PRTFMag': return 'PR transfer magnitude';
      case 'PRTFPhase': return 'PR transfer phase';
      case 'Excursion': return 'cone excursion';
      case 'PRExcursion': return 'PR excursion';
      case 'RearPort': return 'port velocity';
      case 'RearPortGain': return 'rear port gain';
      case 'FrontPort': return 'port velocity';
      case 'FrontPortGain': return 'front port gain';
      case 'IntraPort': return 'port velocity';
      case 'GD': return 'group delay';
      case 'Zmag': return 'impedance magnitude';
      case 'Zph': return 'impedance phase';
      case 'Phase': return 'phase';
      case 'MaxSPL': return 'maximum SPL';
      case 'MaxPwr': return 'maximum power';
      case 'VA': return 'amplifier apparent load power';
      case 'FltMag': return 'filter magnitude';
      case 'FltPhase': return 'filter phase';
      case 'FltGD': return 'filter group delay';
    }
  })();
  return errors.filter(error => !error.field.startsWith('sweep:') && !error.field.startsWith('maxCurves:')
    || error.field === `sweep:${output}` || error.field === `maxCurves:${output}`);
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
  engine: Engine,
  chartId: ChartId,
  fmin: number,
  fmax: number,
  currentDesign: Design,
  compare: Design[],
  errors: DriverError[] = [],
  opts: { bare?: boolean; primaryColor?: string } = {},
): { value: PlotData | null; errors: DriverError[] } {
  const chartErrors = errorsForChart(chartId, errors);
  if (!currentDesign.driver || !currentDesign.curves || !currentDesign.maxCurves)
    return { value: null, errors: chartErrors };

  // Compare overlays may be hidden (visible === false) without being removed. Additive:
  // the current design is always drawn, and any overlay lacking the flag stays visible —
  // so a design that never sets `visible` is always drawn.
  //
  // Legend/draw order follows the sidebar's project list order, not "current first"
  // (John, 2026-09-24). `sortIndex` (set by the caller from `openProjects().indexOf(...)`)
  // carries that order across the currentDesign/compare split; a design without one sorts
  // by its position in this call's own arguments.
  const designs = [currentDesign, ...compare.filter(d => d.visible !== false)]
    .map((d, i) => [d, d.sortIndex ?? i] as const)
    .sort((a, b) => a[1] - b[1])
    .map(([d]) => d);
  const multi = designs.length > 1;
  let out: PlotData | null = null;
  designs.forEach((d, di) => {
    const isCurrent = d === currentDesign;
    const pd = seriesFor(engine, chartId, d.driver!, d.box, d.P, d.curves!, d.maxCurves, opts.bare);
    if (!out) out = { series: [], ymin: pd.ymin, ymax: pd.ymax, logy: pd.logy, unit: pd.unit, fmin, fmax };
    const prim: Series = { ...pd.series[0] };
    if (multi) {
      prim.color = d.color || DPAL[di % DPAL.length]; prim.name = d.name + ': ' + prim.name;
      if (!isCurrent) delete prim.xlim; // compare overlays: solid color, no segmented coloring
      else prim.current = true; // the focused project's own trace, drawn emphasized
    }
    // WinISD trace colour for the active project — matches its Color swatch.
    if (isCurrent && opts.primaryColor) prim.color = opts.primaryColor;
    out.series.push(prim);
    if (isCurrent) for (let k = 1; k < pd.series.length; k++) out.series.push(pd.series[k]);
    out.ymin = Math.min(out.ymin, pd.ymin); out.ymax = Math.max(out.ymax, pd.ymax);
    out.logy = out.logy || pd.logy;
  });
  return { value: out, errors: chartErrors };
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
