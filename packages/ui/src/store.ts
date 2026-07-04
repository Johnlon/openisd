import { reactive, computed, ref, watch } from 'vue';
import { sweep, maxCurves, classifyFinite, END_CORRECTION } from '@openisd/engine';
import type { Driver, DriverRaw, DriverError, SweepResult, MaxCurvesResult } from '@openisd/engine';
import { Driver as DriverModel } from '@openisd/winisd';
import { DPAL } from './presets.js';
import type { AppState, UiParams, SyncedParams, Design } from './types.js';

// The app's default driver on first open (no saved selection) and the target of the
// "Reset to demo" button. Mirrors drivers/demos/demo-generic-6.5in-woofer.wdr.
export const DEFAULT_DRIVER: DriverRaw = { name: 'Demo - Generic 6.5" Woofer', brand: 'Demo', model: 'Generic 6.5" Woofer', Fs:37, Qts:0.378, Qes:0.40, Qms:7.0, Vas:0.0300, Sd:0.0133, Re:5.6, Le:0.70e-3, Xmax:0.0050, Pe:60, Z:8 };

const P_DEFAULTS: UiParams = {
  Vb:0.030, Vf:0.015, ventD:0.05, ventL:0.10, Ql:10, Qa:100, Qp:100,
  nDrivers:1, wiring:'parallel', Pin:1, Rs:0.1,
  prName:'Custom PR',
  prSd:0.0133, prNum:1, prMmd:0.010, prMadd:0, prCms:0.0008, prRms:1.0, prXmax:0.012, prMode:'winisd',
  fmin:1, fmax:20000, N:400,
  circuitModel: 'winisd',
  filters: [],
};

// Persistence has a SINGLE source of truth: openisd.state (utils/persist.js),
// written by App.vue's watch and restored by loadLocal() on mount. store.js does
// not persist — it initialises to defaults; App.vue applies any saved state.
export const state: AppState = reactive({
  box:       'vented',
  P:         { ...P_DEFAULTS },
  graphs:    ['SPL', 'Excursion', 'Zmag', 'GD'],
  compare:   [],
  editDriver: false,
  cursorF:     null,
  pinnedF:     null,
  cursorLocked: false,
  dragRange:   null,  // { fLo, fHi } — shared frequency selection across all graph panels
  browseOpen:   false,
  defineOpen:   false,
  driverSource: null,  // snapshot of the last driver loaded from the library — used for reset
  yRanges:      {},    // per-chart Y-axis override: { [tabId]: { min, max } }; absent = auto-scale
});


// The store's single source of truth for the driver is a long-lived Driver ADT instance
// (@openisd/winisd). It owns E/C/N provenance and every derivation. Its framework-free
// subscribe() is bridged to Vue through _version: every enter/clear and every instance
// swap bumps _version, and the computeds below touch it so they re-derive. winisd stays
// Vue-free — the arrow points up (ui → winisd), never down.
const _version = ref(0);
let _model  = DriverModel.fromRaw(DEFAULT_DRIVER);
let _unsub  = _model.subscribe(() => { _version.value++; });

/** The current Driver ADT instance — call enter/clear/toWdr on it directly. */
export function getDriverModel(): DriverModel { return _model; }

// Swap the held instance (load / import / reset). Re-bridge reactivity and bump once.
function setModel(m: DriverModel): void {
  _unsub();
  _model = m;
  _unsub = _model.subscribe(() => { _version.value++; });
  _version.value++;
}
/** Load a driver from a plain DriverRaw bag (My Drivers, saved project, demo). */
export function setDriverFromRaw(raw: DriverRaw | null | undefined): void {
  setModel(DriverModel.fromRaw(raw ?? {}));
}
/** Load a driver from WinISD .wdr text (import, library) — returns the new instance. */
export function setDriverFromWdr(text: string): DriverModel {
  const m = DriverModel.fromWdr(text);
  setModel(m);
  return m;
}
/** Route a single per-field edit through the ADT (what-if input, rename). */
export function enterDriverField(field: string, value: number | string): void { _model.enter(field, value); }
export function clearDriverField(field: string): void { _model.clear(field); }

export const driver = computed<Driver | null>(() => {
  void _version.value;                 // re-derive on any enter/clear/instance swap
  return _model.toDriver();
});
// driverRaw: the entered bag back out (E fields + carried metadata) — the DriverRaw view
// the rest of the UI reads. Computed values (Cms/Mms/Bl) are NOT in it; read `driver` for
// those. Replaces the old plain state.driverRaw reactive object.
export const driverRaw = computed<DriverRaw>(() => {
  void _version.value;
  return _model.raw();
});
export const driverErrors = computed<DriverError[]>(() => {
  void _version.value;
  return _model.errors();
});
// driverWarnings: human-readable messages for all errors and warns — used by DriverPanel
export const driverWarnings = computed<string[]>(() => driverErrors.value.map(e => e.message));

export const syncedP = computed<SyncedParams>(() => {
  // Drive voltage: sqrt(Pin × Re) — matches WinISD reference-power convention.
  // Users can also set voltage directly in the UI; Pin is back-calculated from V²/Re.
  const eg = Math.sqrt((state.P.Pin ?? 1) * (driver.value?.Re ?? 1));
  const p: SyncedParams = { ...state.P, eg };
  if (state.box === 'vented' || state.box === 'bandpass4') {
    p.Sp   = Math.PI * (state.P.ventD / 2) ** 2;
    p.Leff = state.P.ventL + END_CORRECTION * state.P.ventD;
  }
  return p;
});

const _curves = ref<SweepResult | null>(null);
const _max    = ref<MaxCurvesResult | null>(null);
const _doSweep = () => {
  const d = driver.value;
  _curves.value = d ? sweep(d, state.box, syncedP.value) : null;
  _max.value    = d ? maxCurves(d, state.box, syncedP.value) : null;
};
_doSweep();
let _sweepTimer: ReturnType<typeof setTimeout> | null = null;
watch([driver, syncedP, () => state.box], () => {
  if (_sweepTimer) clearTimeout(_sweepTimer);
  _sweepTimer = setTimeout(_doSweep, 80);
});
export const curvesData = _curves;
export const maxData    = _max;

// Postcondition (hardening): a valid driver can still yield a non-finite sweep at
// some frequency (a numerical singularity the input guards can't foresee). Classify
// the sweep output so it's never a silently blank chart — surfaced through the same
// issue channel as deriveDriver's errors. Empty when the driver is invalid (no sweep)
// or the sweep is clean.
export const curveIssues = computed<DriverError[]>(() => {
  const sw = _curves.value;
  if (!sw) return [];
  const issue = classifyFinite(sw);
  return issue ? [issue] : [];
});

// The full issue list the UI shows: driver-derivation issues + sweep-finiteness issues.
export const allIssues = computed<DriverError[]>(() => [...driverErrors.value, ...curveIssues.value]);

export function driverShort(raw: DriverRaw | null | undefined): string {
  return ((raw?.name) || [raw?.brand, raw?.model].filter(Boolean).join(' ') || 'Driver')
    .replace(/\.wdr$/i, '');
}

export function pinCompare(): void {
  if (!driver.value) return;
  const p = { ...syncedP.value };
  p.filters = (p.filters || []).map(f => ({ ...f }));  // snapshot; isolate from future edits
  const d: Design = {
    driver: driver.value,
    box:    state.box,
    P:      p,
    curves: null,
    maxCurves: null,
    name:   driverShort(driverRaw.value) + ' (' + state.box + ' ' + (p.Vb * 1000).toFixed(0) + 'L)',
    color:  DPAL[(state.compare.length + 1) % DPAL.length],
  };
  d.curves    = sweep(d.driver!, d.box, d.P);
  d.maxCurves = maxCurves(d.driver!, d.box, d.P);
  state.compare.push(d);
}
