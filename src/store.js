import { reactive, computed, ref, watch } from 'vue';
import { deriveDriver } from './core/driver.js';
import { sweep, maxCurves } from './core/sweep.js';
import { DPAL } from './presets.js';

const STORAGE_KEY = 'resonate_v2';

const DEFAULT_DRIVER = { name: 'Demo 6.5" Driver', Fs:37, Qts:0.38, Qes:0.40, Qms:7.0, Vas:0.0300, Sd:0.0133, Re:5.6, Le:0.70e-3, Xmax:0.0050, Pe:60, Z:8 };

const P_DEFAULTS = {
  Vb:0.030, Vf:0.015, ventD:0.05, ventL:0.10, Ql:10, Qa:100, Qp:100,
  nDrivers:1, wiring:'parallel', Pin:1, Rs:0.1,
  prName:'Custom PR',
  prSd:0.0133, prNum:1, prMmd:0.010, prMadd:0, prCms:0.0008, prRms:1.0, prXmax:0.012, prMode:'winisd',
  fmin:10, fmax:1000, N:400,
  circuitModel: 'winisd',
  filters: [],
};

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || {}; }
  catch { return {}; }
}

const _saved = loadSaved();

export const state = reactive({
  driverRaw: _saved.driverRaw ?? DEFAULT_DRIVER,
  box:       _saved.box      ?? 'vented',
  P:         { ...P_DEFAULTS, ...(_saved.P ?? {}) },
  graphs:    _saved.graphs   ?? ['SPL', 'Excursion', 'Zmag', 'GD'],
  compare:   [],
  editDriver: false,
  cursorF:     null,
  pinnedF:     null,
  cursorLocked: false,
  browseOpen:  false,
  browseMode:  'select',   // 'select' = load into project on click | 'browse' = show summary only
});

let _saveTimer = null;
watch(
  () => ({ driverRaw: state.driverRaw, box: state.box, P: state.P, graphs: state.graphs }),
  (val) => {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(val)); } catch {}
    }, 500);
  },
  { deep: true }
);

export const driver = computed(() => deriveDriver(state.driverRaw));

export const syncedP = computed(() => {
  const p = { ...state.P };
  if (state.box === 'vented' || state.box === 'bandpass4') {
    p.Sp   = Math.PI * (p.ventD / 2) ** 2;
    p.Leff = p.ventL + 0.85 * p.ventD;
  }
  // Drive voltage: sqrt(Pin × Re) — matches WinISD reference-power convention.
  // Users can also set voltage directly in the UI; Pin is back-calculated from V²/Re.
  p.eg = Math.sqrt((p.Pin ?? 1) * driver.value.Re);
  return p;
});

const _curves = ref(sweep(driver.value, state.box, syncedP.value));
const _max    = ref(maxCurves(driver.value, state.box, syncedP.value));
let _sweepTimer = null;
watch([driver, syncedP, () => state.box], () => {
  clearTimeout(_sweepTimer);
  _sweepTimer = setTimeout(() => {
    _curves.value = sweep(driver.value, state.box, syncedP.value);
    _max.value    = maxCurves(driver.value, state.box, syncedP.value);
  }, 80);
});
export const curvesData = _curves;
export const maxData    = _max;

export function driverShort(raw) {
  return ((raw?.name) || [raw?.brand, raw?.model].filter(Boolean).join(' ') || 'Driver')
    .replace(/\.wdr$/i, '');
}

export function pinCompare() {
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
