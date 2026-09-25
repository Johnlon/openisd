<script setup lang="ts">
// Options dialog — recreates WinISD's "Options" modal (docs/winisd_screenshots/options_general.png,
// options_plot_window.png), opened via the wrench/tools toolbar icon.
//
// General tab, top→bottom (matches the WinISD wireframe order):
//   Username        — free-text app-level identity preference (presentationState.ui.username).
//   Environment     — Temperature/Air pressure/Relative humidity + derived Sound velocity and
//                      Air density readouts. An app setting (`appSettingsRepo.envDefaults()`),
//                      edited through `OptionsModal-hooks.ts`: a project reads it for any of the
//                      three it has not entered itself, as a calculated value; a project's own
//                      entered value is never touched by editing this.
//   Vented design limits — the band a designed vented box is judged plausible against. Same
//                      hook, same app settings repo. OpenISD's own, no WinISD counterpart.
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
//             setting). Every other row writes into the SAME presentationState.yRanges[chartId] mechanism the
//             chart's own drag-to-zoom already uses (GraphPanel.vue) — so editing a row here is
//             literally "set this chart's persisted default view", not a parallel concept, and
//             an untouched row still auto-scales exactly as it does today. The rows are
//             `LIMIT_ROWS` in OptionsModal-hooks.ts, keyed by `ChartTabId`.
import {reactive, ref} from 'vue';
import {presentationState, resetUnitTokens} from '../../logic/presentationState.js';
import {precision as fieldDp} from '../../logic/fields/uiFields.js';
import {useEscToClose} from '../../logic/useEscToClose.js';
import {LIMIT_ROWS, useOptionsModal} from '../../hooks/OptionsModal-hooks.js';
import type {ChartTabId} from '../../types.js';
import NumInput from './NumInput.vue';
import UnitToggle from './UnitToggle.vue';
import {inputValue} from '../../logic/domEvents.js';

const emit = defineEmits<{ close: [] }>();
function close() { emit('close'); }
function onBackdrop(e: MouseEvent) { if (e.target === e.currentTarget) close(); }
useEscToClose(() => true, close);

// App settings — environment + vented design limits — are the hook's draft; OK applies both.
const {
  tempK, humidityPct, pressurePa, defaultAir, envIsFactory, resetEnv,
  minVolume_L, maxVolume_L, minTuning_hz, maxTuning_hz, error: limitsError, limitsAreFactory, resetLimits,
  canApply, apply: applyAppSettings,
} = useOptionsModal();

type Tab = 'General' | 'Plot Window';
const tab = reactive<{ v: Tab }>({ v: 'General' });

const draft = reactive({
  username: presentationState.ui.username,
  chartColors: JSON.parse(JSON.stringify(presentationState.ui.chartColors ?? {})),
  unitTokens: JSON.parse(JSON.stringify(presentationState.ui.unitTokens ?? {})),
  yRanges: JSON.parse(JSON.stringify(presentationState.yRanges)),
  P: { fmin: presentationState.sweepRange.min, fmax: presentationState.sweepRange.max },
});

const unitsResetPending = ref(false);

function resetUnitsDraft() {
  unitsResetPending.value = true;
  draft.unitTokens = {};
}

function restoreDefaults() {
  draft.username = '';
  resetEnv();
  resetLimits();
  draft.chartColors = {};
  draft.unitTokens = {};
  draft.yRanges = {};
  draft.P = { fmin: 10, fmax: 20000 };
  unitsResetPending.value = true;
}

function saveAndClose() {
  if (!canApply.value) return;
  applyAppSettings();
  presentationState.ui.username = draft.username;
  presentationState.ui.chartColors = { ...draft.chartColors };
  presentationState.ui.unitTokens = { ...draft.unitTokens };
  presentationState.yRanges = { ...draft.yRanges };
  presentationState.sweepRange = { min: draft.P.fmin, max: draft.P.fmax };
  if (unitsResetPending.value) {
    resetUnitTokens();
  }
  close();
}

function fmt(n: number | null | undefined, dp: number): string {
  return n != null && isFinite(n) ? n.toFixed(dp) : '—';
}

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

function setLimit(chartId: ChartTabId, key: 'min' | 'max', e: Event) {
  const v = parseFloat(inputValue(e));
  const cur = draft.yRanges[chartId] ?? { min: NaN, max: NaN };
  draft.yRanges[chartId] = { ...cur, [key]: v };
}
function resetLimit(chartId: ChartTabId) { delete draft.yRanges[chartId]; }
function resetFreqRange() { draft.P = { fmin: 10, fmax: 20000 }; }
// A number input's `:value` must never be literally NaN (an unset half of a partial edit) —
// the DOM emits a console warning ("value 'NaN' cannot be parsed") for that. undefined renders
// as an empty field instead, so the placeholder (WinISD's default) shows through as intended.
function limitVal(chartId: ChartTabId, key: 'min' | 'max'): number | undefined {
  const v = draft.yRanges[chartId]?.[key];
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
            <p class="opt-help">The air a project uses for any of these it has not set on its own Advanced tab.</p>
            <div class="opt-env-grid">
              <div class="opt-env-col">
                <div class="opt-fld">
                  <label>Temperature</label>
                  <NumInput class="opt-num" :model-value="tempK" @update:model-value="(v: number | null) => { if (v !== null) tempK = v; }" field="advTemp" group="temp" base="K" :precision="2" />
                  <UnitToggle field="advTemp" group="temp" base="K" unit-class="opt-unit" />
                </div>
                <div class="opt-fld">
                  <label>Relative humidity</label>
                  <NumInput class="opt-num" :model-value="humidityPct" @update:model-value="(v: number | null) => { if (v !== null) humidityPct = v; }" field="advHumidity" :precision="2" />
                  <span class="opt-unit">%</span>
                </div>
                <div class="opt-fld">
                  <label>Air pressure</label>
                  <NumInput class="opt-num" :model-value="pressurePa" @update:model-value="(v: number | null) => { if (v !== null) pressurePa = v; }" field="advPressure" group="pressure" base="Pa" :precision="1" />
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
              </div>
            </div>
            <div class="opt-group-actions">
              <button class="opt-reset-btn" data-testid="env-reset" :disabled="envIsFactory" title="Back to the built-in environment: 293.15 K, 30 %, 101325 Pa. Only this fieldset is affected." @click="resetEnv">Reset to defaults</button>
            </div>
          </fieldset>

          <fieldset class="opt-group">
            <legend>Vented design limits</legend>
            <p class="opt-help">
              WinISD extrapolates its vented alignment formulas outside their design range, and OpenISD
              reproduces that exactly. A designed box outside this band is still shown as designed — it
              is marked, never changed.
            </p>
            <div class="opt-env-grid">
              <div class="opt-env-col">
                <div class="opt-fld">
                  <label>Min box volume</label>
                  <NumInput id="set-min-volume" class="opt-num" :model-value="minVolume_L" @update:model-value="(v: number | null) => { if (v !== null) minVolume_L = v; }" :precision="2" />
                  <span class="opt-unit">l</span>
                </div>
                <div class="opt-fld">
                  <label>Min tuning</label>
                  <NumInput id="set-min-tuning" class="opt-num" :model-value="minTuning_hz" @update:model-value="(v: number | null) => { if (v !== null) minTuning_hz = v; }" />
                  <span class="opt-unit">Hz</span>
                </div>
              </div>
              <div class="opt-env-col">
                <div class="opt-fld">
                  <label>Max box volume</label>
                  <NumInput id="set-max-volume" class="opt-num" :model-value="maxVolume_L" @update:model-value="(v: number | null) => { if (v !== null) maxVolume_L = v; }" :precision="2" />
                  <span class="opt-unit">l</span>
                </div>
                <div class="opt-fld">
                  <label>Max tuning</label>
                  <NumInput id="set-max-tuning" class="opt-num" :model-value="maxTuning_hz" @update:model-value="(v: number | null) => { if (v !== null) maxTuning_hz = v; }" />
                  <span class="opt-unit">Hz</span>
                </div>
              </div>
            </div>
            <div v-if="limitsError" class="opt-error" data-testid="settings-error">{{ limitsError }}</div>
            <div class="opt-group-actions">
              <button class="opt-reset-btn" data-testid="settings-reset" :disabled="limitsAreFactory" title="Back to the built-in limits. Only this fieldset is affected." @click="resetLimits">Reset to defaults</button>
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
                <tr>
                  <td>Frequency range</td>
                  <td><input class="opt-num" type="number" v-limits="{ min: 1, max: 20000 }" v-model.number="draft.P.fmin" /></td>
                  <td><input class="opt-num" type="number" v-limits="{ min: 1, max: 40000 }" v-model.number="draft.P.fmax" /></td>
                  <td>Hz</td>
                  <td><button class="opt-clear-btn" title="Reset to default" @click="resetFreqRange()">↺</button></td>
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
        <button class="opt-ok" data-testid="settings-apply" :disabled="!canApply" :title="limitsError ?? 'Apply and close'" @click="saveAndClose">OK</button>
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
.opt-help { margin: 0 0 8px; font-size: 11px; color: var(--mut); line-height: 1.4; }
.opt-error { color: #8a1f1f; background: #fdeeee; border: 1px solid #e8b0b0; border-radius: 3px;
  padding: 4px 8px; font-size: 11px; margin-top: 8px; }
.opt-group-actions { display: flex; justify-content: flex-end; margin-top: 8px; }
.opt-reset-btn { width: max-content; padding: 4px 12px; cursor: pointer; }
.opt-reset-btn:disabled { cursor: default; opacity: 0.5; }
.opt-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 10px 14px; border-top: 1px solid var(--line); }
.opt-ok { font-weight: 600; }
.opt-defaults-btn { margin-right: auto; cursor: pointer; }

.opt-row { display: flex; align-items: center; gap: 10px; font-size: 12px; }
.opt-row label { flex: 0 0 90px; color: var(--mut); }
.opt-input { flex: 1; padding: 4px 6px; }

/* Two equal columns; every row is label | input | unit with the same widths in both columns, so
   the inputs and units line up across the whole fieldset. */
.opt-env-grid { display: grid; grid-template-columns: 1fr 1fr; column-gap: 16px; }
.opt-env-col { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.opt-fld { display: grid; grid-template-columns: 104px 82px 1fr; align-items: center; column-gap: 4px;
  font-size: 12px; min-width: 0; }
.opt-fld label { color: var(--mut); white-space: nowrap; }
.opt-checkbox-row { grid-column: 1 / -1; }
.opt-check-label { display: flex; align-items: center; gap: 6px; color: var(--mut); }
.opt-num,
.opt-body :deep(.opt-num) { width: 150px; padding: 3px 5px; box-sizing: border-box; }
.opt-env-grid .opt-num,
.opt-env-grid :deep(.opt-num) { width: 82px; }
.opt-greyed { color: var(--mut); }
.opt-unit { font-size: 11px; color: var(--mut); white-space: nowrap; }
.opt-fld :deep(.opt-unit) { justify-self: start; }

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
