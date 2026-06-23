import { reactive, computed } from 'vue';
import { deriveDriver } from './core/driver.js';
import { sweep, maxCurves } from './core/sweep.js';
import { PRESETS, DPAL } from './presets.js';

export const state = reactive({
  driverRaw: { name: 'Generic 6.5" woofer', ...PRESETS['Generic 6.5" woofer'] },
  box: 'vented',
  P: {
    Vb:0.030, Vf:0.015, ventD:0.05, ventL:0.10, Ql:7, Qp:100,
    nDrivers:1, wiring:'parallel', Pin:1,
    prSd:0.0133, prMmp:0.030, prCms:0.0008, prRms:1.0, prXmax:0.012,
    fmin:10, fmax:1000, N:400,
  },
  graphs: ['SPL', 'Excursion', 'Zmag', 'GD'],
  compare: [],
  editDriver: false,
  cursorF: null,
  browseOpen: false,
});

export const driver = computed(() => deriveDriver(state.driverRaw));

export const syncedP = computed(() => {
  const p = { ...state.P };
  if (state.box === 'vented' || state.box === 'bandpass4') {
    p.Sp   = Math.PI * (p.ventD / 2) ** 2;
    p.Leff = p.ventL + 0.85 * p.ventD;
  }
  p.eg = Math.sqrt((p.Pin ?? 1) * (driver.value.Z || driver.value.Re || 8));
  return p;
});

export const curvesData  = computed(() => sweep(driver.value, state.box, syncedP.value));
export const maxData      = computed(() => maxCurves(driver.value, state.box, syncedP.value));

export function driverShort(raw) {
  return ((raw?.name) || [raw?.brand, raw?.model].filter(Boolean).join(' ') || 'Driver')
    .replace(/\.wdr$/i, '');
}

export function pinCompare() {
  const p = { ...syncedP.value };
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
