<script setup lang="ts">
// Options dialog — recreates WinISD's "Options" modal (docs/winisd_screenshots/options_general.png,
// options_plot_window.png), opened via the wrench/tools toolbar icon.
//
// General tab, top→bottom (matches the WinISD wireframe order):
//   Username        — free-text app-level identity preference (presentationState.ui.username).
//   Environment     — Temperature/Air pressure/Relative humidity + a derived Sound velocity
//                      readout. These are APP-LEVEL DEFAULTS (presentationState.ui.envDefaults), distinct
//                      from a project's own per-design Advanced-pane values: they only seed a
//                      shell's Advanced-pane refs on mount (OriginalShell.vue) —
//                      an already-open project's Advanced-pane values are never touched
//                      by editing this. (docs/research/WINISD_PARITY.md / BACKLOG.md: whether real WinISD's Options
//                      dialog seeds a brand-new WinISD *project's* Advanced defaults the same
//                      way is inferred from matching screenshot values, not directly observed —
//                      ⚠ unverified. This app-level-default behaviour is OpenISD's own design
//                      choice, made regardless of that WinISD inference.)
//   Units           — WinISD's own "Reset to Metric (l, mm, …)" button: a one-click GLOBAL
//                      unit-system reset, distinct from the per-field unit-cycling behaviour
//                      (docs/research/WINISD_PARITY.md §14). presentationState.resetUnitTokens() clears presentationState.ui.unitTokens, so
//                      every field reverts to its own default display unit — never touches the
//                      stored SI design.
//
// Plot Window tab:
//   Colors  — WinISD has 6 swatches; OpenISD has a real rendering hook for 5 rows (wired via
//             CSS custom properties on the canvas element, GraphPanel.vue → canvas.ts):
//               Background  → --chart-bg-override (canvas fill; empty by default — transparent,
//                              app's own .gpanel background shows through, unchanged).
//               Other lines → --chart-grid (frequency/level gridlines).
//               Labels      → --chart-text (axis tick labels).
//               Xmax limit  → --chart-pelimit (canvas.ts's amber Pe-limited trace segment — the
//                              closest OpenISD equivalent; WinISD's own Xmax-limited segment
//                              reuses the trace's own per-project color, not a single constant,
//                              so this customizes the Pe-limited tint, not literally "Xmax").
//               Cursor lines→ --chart-cross + --chart-band-line (the crosshair/level cursor and
//                              the drag-selection band edges).
//             "0 dB line" / "-3dB line" are shown disabled: WinISD draws them on its separate
//             0 dB-normalized "Transfer function magnitude" chart (docs/winisd_screenshots/info/
//             view_3_ported.md), which OpenISD does not have — OpenISD's 'SPL' tab plots
//             absolute dB SPL, not a normalized transfer function, so there is no chart these
//             two colors could correctly apply to yet. Tracked in BACKLOG.md, not fabricated.
//   Limits  — WinISD's per-chart-type Start/End/Unit table. "Frequency range" binds directly to
//             the existing global sweep fmin/fmax (already a real, always-populated field —
//             this is just another entry point onto it, matching WinISD's own single global
//             setting). Every other row writes into the SAME presentationState.yRanges[tabId] mechanism the
//             chart's own drag-to-zoom already uses (GraphPanel.vue) — so editing a row here is
//             literally "set this chart's persisted default view", not a parallel concept, and
//             an untouched row still auto-scales exactly as it does today. WinISD's own
//             "Transfer func. magn." and "EQ transfer func mag" retain WinISD's defaults in the
//             same table order even though OpenISD does not currently render those separate chart
//             tabs. Their values are presentation defaults, not fabricated chart data.
import {computed, reactive, ref} from 'vue';
import {airForEnvironment} from '../../logic/environment.js';
import {focusedProject} from '../../logic/appState.js';
import {
  AIR_CONSTANTS_APP_DEFAULT,
  airConstantsAppDefaults,
  presentationState,
  resetUnitTokens
} from '../../logic/presentationState.js';
import {precision as fieldDp} from '../../logic/fields/fieldRegistry.js';
import {useEscToClose} from '../../logic/useEscToClose.js';
import NumInput from './NumInput.vue';
import UnitToggle from './UnitToggle.vue';
import {inputValue} from '../../logic/domEvents.js';

const emit = defineEmits<{ close: [] }>();
function close() { emit('close'); }
function onBackdrop(e: MouseEvent) { if (e.target === e.currentTarget) close(); }
useEscToClose(() => true, close);

const project = computed(() => focusedProject());

type Tab = 'General' | 'Plot Window';
const tab = reactive<{ v: Tab }>({ v: 'General' });

const draft = reactive({
  username: presentationState.ui.username,
  envDefaults: JSON.parse(JSON.stringify(presentationState.ui.envDefaults)),
  chartColors: JSON.parse(JSON.stringify(presentationState.ui.chartColors ?? {})),
  unitTokens: JSON.parse(JSON.stringify(presentationState.ui.unitTokens ?? {})),
  yRanges: JSON.parse(JSON.stringify(presentationState.yRanges)),
  P: {
    fmin: project.value?.sweepFmin_hz.get() ?? 10,
    fmax: project.value?.sweepFmax_hz.get() ?? 20000,
  }
});

const unitsResetPending = ref(false);

function resetUnitsDraft() {
  unitsResetPending.value = true;
  draft.unitTokens = {};
}

function resetEnvDraft() {
  draft.envDefaults = airConstantsAppDefaults();
}

function setDraftTemperature(value: number | null): void {
  draft.envDefaults.tempK = value ?? AIR_CONSTANTS_APP_DEFAULT.tempK;
}

function setDraftHumidity(value: number | null): void {
  draft.envDefaults.humidityPct = value ?? AIR_CONSTANTS_APP_DEFAULT.humidityPct;
}

function setDraftPressure(value: number | null): void {
  draft.envDefaults.pressurePa = value ?? AIR_CONSTANTS_APP_DEFAULT.pressurePa;
}

const envResetTitle = computed(() =>
  `Reset to factory settings: ${AIR_CONSTANTS_APP_DEFAULT.tempK.toFixed(2)} K, ` +
  `${AIR_CONSTANTS_APP_DEFAULT.pressurePa.toFixed(0)} Pa, ${AIR_CONSTANTS_APP_DEFAULT.humidityPct.toFixed(0)}%. ` +
  `Only this fieldset is affected.`);

function restoreDefaults() {
  draft.username = '';
  draft.envDefaults = airConstantsAppDefaults();
  draft.chartColors = {};
  draft.unitTokens = {};
  draft.yRanges = {};
  draft.P = { fmin: 10, fmax: 20000 };
  unitsResetPending.value = true;
}

function saveAndClose() {
  presentationState.ui.username = draft.username;
  presentationState.ui.envDefaults = { ...draft.envDefaults };
  presentationState.ui.chartColors = { ...draft.chartColors };
  presentationState.ui.unitTokens = { ...draft.unitTokens };
  presentationState.yRanges = { ...draft.yRanges };
  const p = project.value;
  if (p) {
    p.sweepFmin_hz.set(draft.P.fmin);
    p.sweepFmax_hz.set(draft.P.fmax);
  }
  if (unitsResetPending.value) {
    resetUnitTokens();
  }
  close();
}

function fmt(n: number | null | undefined, dp: number): string {
  return n != null && isFinite(n) ? n.toFixed(dp) : '—';
}
/* Sound velocity and air density for the DEFAULT environment. All three inputs feed them
 * (engine air.ts); `useWinisdAirModel` is per project, not an app default, so this readout
 * always shows the physical model. */
const defaultAir = computed(() => airForEnvironment({
  tempK: draft.envDefaults.tempK,
  humidityPct: draft.envDefaults.humidityPct,
  pressurePa: draft.envDefaults.pressurePa,
}));

type ColorKey = 'zeroDb' | 'minus3Db' | 'background' | 'otherLines' | 'labels' | 'xmaxLimit' | 'cursor';
const COLOR_ROWS: { key: ColorKey; label: string }[] = [
  { key: 'background', label: 'Background' },
  { key: 'otherLines',  label: 'Other lines' },
  { key: 'labels',      label: 'Labels' },
  { key: 'xmaxLimit',   label: 'Xmax limit' },
  { key: 'cursor',      label: 'Cursor lines' },
];
function colorValue(key: ColorKey): string {
  return draft.chartColors?.[key] ?? defaultColor(key);
}
function defaultColor(key: ColorKey): string {
  switch (key) {
    case 'zeroDb': return '#000000';
    case 'minus3Db': return '#808080';
    case 'background': return '#ffffff';
    case 'otherLines': return '#3a7bd5';
    case 'labels': return '#000000';
    case 'xmaxLimit': return '#ff0000';
    case 'cursor': return '#2e8b57';
  }
}
function setColor(key: ColorKey, e: Event) {
  const v = inputValue(e);
  draft.chartColors[key] = v;
}
function clearColor(key: ColorKey) {
  delete draft.chartColors[key];
}

// WinISD's default Start/End shown as this row's placeholder until the user sets an override;
// an untouched row keeps auto-scaling (no default is ever silently written to presentationState.yRanges).
const LIMIT_ROWS: { tab: string; label: string; start: number; end: number; unit: string }[] = [
  { tab: 'TFmag',     label: 'Transfer func. magn.',  start: -30,  end: 6,    unit: 'dB' },
  { tab: 'EQTFmag',   label: 'EQ transfer func mag',  start: -40,  end: 20,   unit: 'dB' },
  { tab: 'Phase',     label: 'Transfer func. phase',  start: -180, end: 180,  unit: 'deg' },
  { tab: 'SPL',       label: 'SPL',                   start: 40,   end: 115,  unit: 'dB' },
  { tab: 'Excursion', label: 'Cone excursion',        start: 0.0,  end: 30.0, unit: 'mm peak' },
  { tab: 'Zmag',      label: 'Impedance',             start: 0,    end: 150,  unit: 'ohm' },
  { tab: 'Zph',       label: 'Impedance phase',       start: -90,  end: 90,   unit: 'deg' },
  { tab: 'GD',        label: 'Group delay',           start: 0,    end: 40,   unit: 'ms' },
  { tab: 'MaxPwr',    label: 'Maximum power',         start: 0,    end: 500,  unit: 'W' },
  { tab: 'Port',      label: 'Air velocity',          start: 0.00, end: 40.00, unit: 'm/s peak' },
];
function setLimit(tabId: string, key: 'min' | 'max', e: Event) {
  const v = parseFloat(inputValue(e));
  const cur = draft.yRanges[tabId] ?? { min: NaN, max: NaN };
  draft.yRanges[tabId] = { ...cur, [key]: v };
}
function resetLimit(tabId: string) { delete draft.yRanges[tabId]; }
// A number input's `:value` must never be literally NaN (an unset half of a partial edit) —
// the DOM emits a console warning ("value 'NaN' cannot be parsed") for that. undefined renders
// as an empty field instead, so the placeholder (WinISD's default) shows through as intended.
function limitVal(tabId: string, key: 'min' | 'max'): number | undefined {
  const v = draft.yRanges[tabId]?.[key];
  return v != null && isFinite(v) ? v : undefined;
}
</script>

<template>
  <div class="opt-overlay" @click="onBackdrop">
    <div class="opt-modal">
      <h2 class="opt-h2">Options<button class="opt-x" @click="close" title="Close">✕</button></h2>

      <div class="opt-tabs">
        <button class="opt-tab" :class="{ on: tab.v === 'General' }" @click="tab.v = 'General'">General</button>
        <button class="opt-tab" :class="{ on: tab.v === 'Plot Window' }" @click="tab.v = 'Plot Window'">Plot Window</button>
      </div>

      <div class="opt-body">
        <template v-if="tab.v === 'General'">
          <div class="opt-row">
            <label>Username</label>
            <input class="opt-input" type="text" v-model="draft.username" placeholder="johnl" />
          </div>

          <fieldset class="opt-group">
            <legend>Environment</legend>
            <div class="opt-env-grid">
              <div class="opt-env-col">
                <div class="opt-fld">
                  <label>Temperature</label>
                  <NumInput class="opt-num" :model-value="draft.envDefaults.tempK" @update:model-value="setDraftTemperature" field="advTemp" group="temp" base="K" :precision="2" />
                  <UnitToggle field="advTemp" group="temp" base="K" unit-class="opt-unit" />
                </div>
                <div class="opt-fld">
                  <label>Relative humidity</label>
                  <NumInput class="opt-num" :model-value="draft.envDefaults.humidityPct" @update:model-value="setDraftHumidity" field="advHumidity" :precision="2" />
                  <span class="opt-unit">%</span>
                </div>
                <div class="opt-fld">
                  <label>Air pressure</label>
                  <NumInput class="opt-num" :model-value="draft.envDefaults.pressurePa" @update:model-value="setDraftPressure" field="advPressure" group="pressure" base="Pa" :precision="1" />
                  <UnitToggle field="advPressure" group="pressure" base="Pa" unit-class="opt-unit" />
                </div>
              </div>
              <div class="opt-env-col opt-env-calculated-col">
                <div class="opt-fld">
                  <label>Sound velocity</label>
                  <input class="opt-num opt-greyed" type="text" :value="fmt(defaultAir.c, fieldDp('advSoundVelocity'))" readonly disabled aria-label="Sound velocity, calculated" />
                  <span class="opt-unit">m/s</span>
                </div>
                <div class="opt-fld">
                  <label>Air density</label>
                  <input class="opt-num opt-greyed" type="text" :value="fmt(defaultAir.rho, fieldDp('advAirDensity'))" readonly disabled aria-label="Air density, calculated" />
                  <span class="opt-unit">kg/m³</span>
                </div>
                <button class="opt-reset-btn" :title="envResetTitle" @click="resetEnvDraft">Reset to defaults</button>
              </div>
            </div>
          </fieldset>

          <fieldset class="opt-group">
            <legend>Units</legend>
            <button class="opt-reset-btn" title="Reset every field's display unit back to its default (cm, L, g, Hz, K, Pa…) — undoes any unit clicking. The stored design is never affected." @click="resetUnitsDraft">
              Reset to Metric (l, mm, …)
            </button>
          </fieldset>
        </template>

        <template v-else>
          <fieldset class="opt-group">
            <legend>Colors</legend>
            <div class="opt-color-grid">
              <div class="opt-color-col">
                <div class="opt-color-row" title="WinISD's normalized transfer-function zero line; OpenISD has no separate normalized transfer-function chart yet.">
                  <label>0 dB line</label>
                  <input type="color" :value="colorValue('zeroDb')" @input="setColor('zeroDb', $event)" />
                  <button class="opt-clear-btn" title="Reset to black" @click="clearColor('zeroDb')">↺</button>
                </div>
                <div class="opt-color-row" title="WinISD's normalized transfer-function -3 dB line; OpenISD has no separate normalized transfer-function chart yet.">
                  <label>-3dB line</label>
                  <input type="color" :value="colorValue('minus3Db')" @input="setColor('minus3Db', $event)" />
                  <button class="opt-clear-btn" title="Reset to grey" @click="clearColor('minus3Db')">↺</button>
                </div>
                <div class="opt-color-row" v-for="row in COLOR_ROWS.filter(row => row.key === 'background')" :key="row.key">
                  <label>{{ row.label }}</label>
                  <input type="color" :value="colorValue(row.key)" @input="setColor(row.key, $event)" />
                  <button class="opt-clear-btn" title="Revert to the app's own color" @click="clearColor(row.key)">↺</button>
                </div>
              </div>
              <div class="opt-color-col">
                <div class="opt-color-row" v-for="row in COLOR_ROWS.filter(row => row.key !== 'background')" :key="row.key">
                  <label>{{ row.label }}</label>
                  <input type="color" :value="colorValue(row.key)" @input="setColor(row.key, $event)" />
                  <button class="opt-clear-btn" title="Revert to the app's own color" @click="clearColor(row.key)">↺</button>
                </div>
              </div>
            </div>
          </fieldset>

          <fieldset class="opt-group">
            <legend>Limits</legend>
            <table class="opt-limits">
              <thead><tr><th></th><th>Start</th><th>End</th><th>Unit</th><th></th></tr></thead>
              <tbody>
                <tr v-if="project">
                  <td>Frequency range</td>
                  <td><input class="opt-num" type="number" v-limits="{ min: 1, max: 20000 }" v-model.number="draft.P.fmin" /></td>
                  <td><input class="opt-num" type="number" v-limits="{ min: 1, max: 40000 }" v-model.number="draft.P.fmax" /></td>
                  <td>Hz</td>
                  <td></td>
                </tr>
                <tr v-for="row in LIMIT_ROWS" :key="row.tab">
                  <td>{{ row.label }}</td>
                  <td><input class="opt-num" type="number" v-limits="{ min: -10000, max: 100000 }" :value="limitVal(row.tab, 'min') ?? row.start" @change="setLimit(row.tab, 'min', $event)" /></td>
                  <td><input class="opt-num" type="number" v-limits="{ min: -10000, max: 100000 }" :value="limitVal(row.tab, 'max') ?? row.end" @change="setLimit(row.tab, 'max', $event)" /></td>
                  <td>{{ row.unit }}</td>
                  <td><button class="opt-clear-btn" title="Reset to auto-scale" @click="resetLimit(row.tab)">↺</button></td>
                </tr>
              </tbody>
            </table>
          </fieldset>
        </template>
      </div>

      <div class="opt-footer">
        <button class="opt-defaults-btn" @click="restoreDefaults">Defaults</button>
        <button class="opt-ok" @click="saveAndClose">OK</button>
        <button @click="close">Cancel</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Fully self-contained (own overlay/modal shell, not the shared global .overlay/.modal) —
   deliberately unique class names. The shell defines its OWN unscoped `.overlay`/
   `.modal` rules for their native-style dialogs (e.g. Original's centers-at-top variant); Vue
   applies a parent's scoped-style attribute to a child component's ROOT element too, so reusing
   those same class names here would leak the shell's positioning/sizing onto this modal. */
.opt-overlay { position: fixed; inset: 0; background: rgba(4, 8, 14, 0.66); display: flex;
  align-items: center; justify-content: center; z-index: 200; }
 .opt-modal { width: min(470px, 92vw); max-height: 94vh; display: flex; flex-direction: column;
  background: var(--panel); border: 1px solid var(--line); border-radius: 9px; overflow: hidden;
  color: var(--fg); }
.opt-h2 { margin: 0; font-size: 14px; padding: 11px 14px; border-bottom: 1px solid var(--line);
  display: flex; align-items: center; gap: 8px; }
.opt-x { margin-left: auto; cursor: pointer; color: var(--mut); font-size: 18px; line-height: 1;
  background: none; border: none; padding: 0; }
.opt-tabs { display: flex; gap: 2px; padding: 8px 14px 0; }
.opt-tab { font-size: 12px; padding: 6px 12px; border: 1px solid var(--line);
  border-radius: 4px 4px 0 0; background: var(--panel2); color: var(--mut); cursor: pointer; }
/* The active tab must look physically attached to the panel below, not a separate chip sitting
   above a visible seam. Two things are both required — colour-matching the border alone still
   anti-aliases into a thin visible line at a sub-pixel boundary:
   1. Drop the border-bottom entirely (padding-bottom +1px keeps the same overall height as the
      inactive tab, so tabs don't jump/misalign when switching).
   2. Overlap 1px into .opt-body (margin-bottom:-1px) and paint above it (position+z-index) —
      .opt-body's own border-top still draws under the tab's width unless covered like this. */
.opt-tab.on { background: var(--panel); color: var(--fg); font-weight: 600;
  border-bottom: none; padding-bottom: 7px; margin-bottom: -1px; position: relative; z-index: 2; }
.opt-body { min-height: 90px; border-top: 1px solid var(--line); padding: 12px 14px; overflow-y: auto;
  display: flex; flex-direction: column; gap: 10px; }
.opt-group { border: 1px solid var(--line); border-radius: 5px; padding: 10px 12px; margin: 0; }
.opt-group legend { padding: 0 6px; font-size: 11px; color: var(--mut); }
.opt-reset-btn { width: max-content; padding: 4px 12px; cursor: pointer; margin-top: 2px; }
.opt-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 10px 14px; border-top: 1px solid var(--line); }
.opt-ok { font-weight: 600; }
.opt-defaults-btn { margin-right: auto; cursor: pointer; }

.opt-row { display: flex; align-items: center; gap: 10px; font-size: 12px; }
.opt-row label { flex: 0 0 90px; color: var(--mut); }
.opt-input { flex: 1; padding: 4px 6px; }

/* Keep the three editable constants on the left and the two calculated readouts on the right. */
.opt-env-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); column-gap: 14px; }
.opt-env-col { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.opt-fld { display: flex; align-items: center; gap: 3px; font-size: 12px; min-width: 0; }
.opt-fld label { flex: 0 0 90px; color: var(--mut); white-space: nowrap; }
.opt-checkbox-row { grid-column: 1 / -1; }
.opt-check-label { display: flex; align-items: center; gap: 6px; color: var(--mut); }
.opt-num,
.opt-body :deep(.opt-num) { width: 150px; padding: 3px 5px; }
.opt-env-grid .opt-num,
.opt-env-grid :deep(.opt-num) { width: 96px; }
.opt-env-col:first-child .opt-num,
.opt-env-col:first-child :deep(.opt-num) { width: 82px; flex: 0 0 82px; }
.opt-env-calculated-col .opt-fld { gap: 3px; }
.opt-env-calculated-col .opt-fld label { flex-basis: 86px; }
.opt-env-calculated-col .opt-num,
.opt-env-calculated-col :deep(.opt-num) { width: 64px; }
.opt-env-calculated-col .opt-reset-btn { align-self: flex-end; margin-top: 2px; }
.opt-greyed { color: var(--mut); }
.opt-unit { font-size: 11px; color: var(--mut); min-width: 2.2em; }

/* Hide number spinners for environment and limit inputs */
.opt-body :deep(input::-webkit-outer-spin-button),
.opt-body :deep(input::-webkit-inner-spin-button) {
  -webkit-appearance: none;
  margin: 0;
}
.opt-body :deep(input[type="number"]) {
  -webkit-appearance: none;
  -moz-appearance: textfield;
  appearance: none;
}

.opt-color-grid { display: grid; grid-template-columns: max-content max-content; gap: 14px 30px; }
.opt-color-col { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.opt-color-row { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.opt-color-row label { flex: 0 0 88px; color: var(--mut); }
.opt-color-row input[type="color"] { width: 32px; height: 22px; padding: 0; border: 1px solid var(--line); cursor: pointer; }
.opt-color-row.opt-disabled input[type="color"] { cursor: not-allowed; opacity: 0.5; }
.opt-clear-btn { border: 1px solid var(--line); background: var(--panel2); color: var(--mut);
  cursor: pointer; font-size: 12px; width: 22px; height: 22px; line-height: 1; }

.opt-limits { width: auto; border-collapse: collapse; font-size: 11px; }
.opt-limits th, .opt-limits td { padding: 3px 4px; text-align: left; }
.opt-limits th { color: var(--mut); font-weight: 500; border-bottom: 1px solid var(--line); }
.opt-limits .opt-num,
.opt-limits :deep(.opt-num) { width: 70px; }
</style>
