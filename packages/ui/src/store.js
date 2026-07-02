import { reactive, computed, ref, watch } from 'vue';
import { deriveDriver, sweep, maxCurves } from '@resonate/engine';
import { DPAL } from './presets.js';

// The app's default driver on first open (no saved selection) and the target of the
// "Reset to demo" button. Mirrors drivers/demos/demo-generic-6.5in-woofer.wdr.
export const DEFAULT_DRIVER = { name: 'Demo - Generic 6.5" Woofer', brand: 'Demo', model: 'Generic 6.5" Woofer', Fs:37, Qts:0.378, Qes:0.40, Qms:7.0, Vas:0.0300, Sd:0.0133, Re:5.6, Le:0.70e-3, Xmax:0.0050, Pe:60, Z:8 };

const P_DEFAULTS = {
  Vb:0.030, Vf:0.015, ventD:0.05, ventL:0.10, Ql:10, Qa:100, Qp:100,
  nDrivers:1, wiring:'parallel', Pin:1, Rs:0.1,
  prName:'Custom PR',
  prSd:0.0133, prNum:1, prMmd:0.010, prMadd:0, prCms:0.0008, prRms:1.0, prXmax:0.012, prMode:'winisd',
  fmin:1, fmax:20000, N:400,
  circuitModel: 'winisd',
  filters: [],
};

// Persistence has a SINGLE source of truth: resonate.state (utils/persist.js),
// written by App.vue's watch and restored by loadLocal() on mount. store.js does
// not persist — it initialises to defaults; App.vue applies any saved state.
export const state = reactive({
  driverRaw: DEFAULT_DRIVER,
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


const _derived = computed(() => deriveDriver(state.driverRaw));
export const driver       = computed(() => _derived.value.value);
export const driverErrors = computed(() => _derived.value.errors);
// driverWarnings: human-readable messages for all errors and warns — used by DriverPanel
export const driverWarnings = computed(() => driverErrors.value.map(e => e.message));

export const syncedP = computed(() => {
  const p = { ...state.P };
  if (state.box === 'vented' || state.box === 'bandpass4') {
    p.Sp   = Math.PI * (p.ventD / 2) ** 2;
    p.Leff = p.ventL + 0.85 * p.ventD;
  }
  // Drive voltage: sqrt(Pin × Re) — matches WinISD reference-power convention.
  // Users can also set voltage directly in the UI; Pin is back-calculated from V²/Re.
  p.eg = Math.sqrt((p.Pin ?? 1) * (driver.value?.Re ?? 1));
  return p;
});

const _doSweep = () => {
  const d = driver.value;
  _curves.value = d ? sweep(d, state.box, syncedP.value) : null;
  _max.value    = d ? maxCurves(d, state.box, syncedP.value) : null;
};
const _curves = ref(null);
const _max    = ref(null);
_doSweep();
let _sweepTimer = null;
watch([driver, syncedP, () => state.box], () => {
  clearTimeout(_sweepTimer);
  _sweepTimer = setTimeout(_doSweep, 80);
});
export const curvesData = _curves;
export const maxData    = _max;

export function driverShort(raw) {
  return ((raw?.name) || [raw?.brand, raw?.model].filter(Boolean).join(' ') || 'Driver')
    .replace(/\.wdr$/i, '');
}

export function pinCompare() {
  if (!driver.value) return;
  const p = { ...syncedP.value };
  p.filters = (p.filters || []).map(f => ({ ...f }));  // snapshot; isolate from future edits
  const d = {
    driver: driver.value,
    box:    state.box,
    P:      p,
    name:   driverShort(state.driverRaw) + ' (' + state.box + ' ' + (p.Vb * 1000).toFixed(0) + 'L)',
    color:  DPAL[(state.compare.length + 1) % DPAL.length],
  };
  d.curves    = sweep(d.driver, d.box, d.P);
  d.maxCurves = maxCurves(d.driver, d.box, d.P);
  state.compare.push(d);
}
