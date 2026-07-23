<script setup lang="ts">
// Options dialog — recreates WinISD's "Options" modal (docs/winisd/options_general.png,
// options_plot_window.png), opened via the wrench/tools toolbar icon on every skin.
//
// General tab, top→bottom (matches the WinISD wireframe order):
//   Username        — free-text app-level identity preference (state.ui.username).
//   Environment     — Temperature/Air pressure/Relative humidity + a derived Sound velocity
//                      readout. These are APP-LEVEL DEFAULTS (state.ui.envDefaults), distinct
//                      from a project's own per-design Advanced-pane values: they only seed a
//                      shell's Advanced-pane refs on mount (OriginalShell.vue/ClassicShell.vue),
//                      replacing what used to be a hardcoded literal (293.15 K / 101325 Pa /
//                      30%) — an already-open project's Advanced-pane values are never touched
//                      by editing this. (WINISD.md/BACKLOG.md: whether real WinISD's Options
//                      dialog seeds a brand-new WinISD *project's* Advanced defaults the same
//                      way is inferred from matching screenshot values, not directly observed —
//                      ⚠ unverified. This app-level-default behaviour is OpenISD's own design
//                      choice, made regardless of that WinISD inference.)
//   Units           — WinISD's own "Reset to Metric (l, mm, …)" button: a one-click GLOBAL
//                      unit-system reset, distinct from the per-field unit-cycling behaviour
//                      (WINISD.md §14). store.resetUnitTokens() clears state.ui.unitTokens, so
//                      every field reverts to its own default display unit — never touches the
//                      stored SI design.
//
// Plot Window tab:
//   Colors  — WinISD has 6 swatches; OpenISD has a real rendering hook for 4 of them (wired via
//             CSS custom properties on the canvas element, GraphPanel.vue → canvas.ts):
//               Background  → --chart-bg-override (canvas fill; empty by default — transparent,
//                              current skin's own .gpanel background shows through, unchanged).
//               Other lines → --chart-grid (frequency/level gridlines).
//               Labels      → --chart-text (axis tick labels).
//               Xmax limit  → --chart-pelimit (canvas.ts's amber Pe-limited trace segment — the
//                              closest OpenISD equivalent; WinISD's own Xmax-limited segment
//                              reuses the trace's own per-project color, not a single constant,
//                              so this customizes the Pe-limited tint, not literally "Xmax").
//             "0 dB line" / "-3dB line" are shown disabled: WinISD draws them on its separate
//             0 dB-normalized "Transfer function magnitude" chart (docs/winisd/info/
//             view_3_ported.md), which OpenISD does not have — OpenISD's 'SPL' tab plots
//             absolute dB SPL, not a normalized transfer function, so there is no chart these
//             two colors could correctly apply to yet. Tracked in BACKLOG.md, not fabricated.
//   Limits  — WinISD's per-chart-type Start/End/Unit table. "Frequency range" binds directly to
//             the existing global state.P.fmin/fmax (already a real, always-populated field —
//             this is just another entry point onto it, matching WinISD's own single global
//             setting). Every other row writes into the SAME state.yRanges[tabId] mechanism the
//             chart's own drag-to-zoom already uses (GraphPanel.vue) — so editing a row here is
//             literally "set this chart's persisted default view", not a parallel concept, and
//             an untouched row still auto-scales exactly as it does today. WinISD's own
//             "Transfer func. magn." and "EQ transfer func mag" rows are omitted: OpenISD has no
//             separate normalized-transfer-function or EQ/filter-only chart tab to bind them to
//             (same gap as the two disabled Colors rows above); WinISD's "SPL" row already
//             covers OpenISD's one 'SPL' tab (absolute dB SPL).
import { computed, reactive } from 'vue';
import { soundVelocity } from '@openisd/engine';
import { state, resetUnitTokens } from '../store.js';
import { precision as fieldDp } from '../fields/fieldRegistry.js';
import { useEscToClose } from '../composables/useEscToClose.js';
import NumInput from './NumInput.vue';
import UnitToggle from './UnitToggle.vue';

const emit = defineEmits<{ close: [] }>();
function close() { emit('close'); }
function onBackdrop(e: MouseEvent) { if (e.target === e.currentTarget) close(); }
useEscToClose(() => true, close);

type Tab = 'General' | 'Plot Window';
const tab = reactive({ v: 'General' as Tab });

function fmt(n: number | null | undefined, dp: number): string {
  return n != null && isFinite(n) ? n.toFixed(dp) : '—';
}
const soundVel = computed(() => soundVelocity(state.ui.envDefaults.tempK));

type ColorKey = 'background' | 'otherLines' | 'labels' | 'xmaxLimit';
const COLOR_ROWS: { key: ColorKey; label: string }[] = [
  { key: 'background', label: 'Background' },
  { key: 'otherLines',  label: 'Other lines' },
  { key: 'labels',      label: 'Labels' },
  { key: 'xmaxLimit',   label: 'Xmax limit' },
];
function colorValue(key: ColorKey): string {
  return state.ui.chartColors?.[key] ?? '#888888';
}
function setColor(key: ColorKey, e: Event) {
  const v = (e.target as HTMLInputElement).value;
  if (!state.ui.chartColors) state.ui.chartColors = {};
  state.ui.chartColors[key] = v;
}
function clearColor(key: ColorKey) {
  if (state.ui.chartColors) delete state.ui.chartColors[key];
}

// WinISD's default Start/End shown as this row's placeholder until the user sets an override;
// an untouched row keeps auto-scaling (no default is ever silently written to state.yRanges).
const LIMIT_ROWS: { tab: string; label: string; start: number; end: number; unit: string }[] = [
  { tab: 'SPL',       label: 'SPL',                   start: 40,   end: 105,  unit: 'dB' },
  { tab: 'Phase',     label: 'Transfer func. phase',  start: -180, end: 180,  unit: 'deg' },
  { tab: 'Excursion', label: 'Cone excursion',        start: 0.0,  end: 30.0, unit: 'mm peak' },
  { tab: 'Zmag',      label: 'Impedance',             start: 0,    end: 50,   unit: 'ohm' },
  { tab: 'Zph',       label: 'Impedance phase',       start: -90,  end: 90,   unit: 'deg' },
  { tab: 'GD',        label: 'Group delay',           start: 0,    end: 40,   unit: 'ms' },
  { tab: 'MaxPwr',    label: 'Maximum power',         start: 0,    end: 500,  unit: 'W' },
  { tab: 'Port',      label: 'Air velocity',          start: 0.00, end: 40.00, unit: 'm/s peak' },
];
function setLimit(tabId: string, key: 'min' | 'max', e: Event) {
  const v = parseFloat((e.target as HTMLInputElement).value);
  const cur = state.yRanges[tabId] ?? { min: NaN, max: NaN };
  state.yRanges[tabId] = { ...cur, [key]: v };
}
function resetLimit(tabId: string) { delete state.yRanges[tabId]; }
// A number input's `:value` must never be literally NaN (an unset half of a partial edit) —
// the DOM emits a console warning ("value 'NaN' cannot be parsed") for that. undefined renders
// as an empty field instead, so the placeholder (WinISD's default) shows through as intended.
function limitVal(tabId: string, key: 'min' | 'max'): number | undefined {
  const v = state.yRanges[tabId]?.[key];
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
            <input class="opt-input" type="text" v-model="state.ui.username" placeholder="johnl" />
          </div>

          <fieldset class="opt-group">
            <legend>Environment</legend>
            <div class="opt-env-grid">
              <div class="opt-fld">
                <label>Temperature</label>
                <NumInput v-model="state.ui.envDefaults.tempK" field="advTemp" group="temp" base="K" :precision="2" />
                <UnitToggle field="advTemp" group="temp" base="K" unit-class="opt-unit" />
              </div>
              <div class="opt-fld">
                <label>Air pressure</label>
                <NumInput v-model="state.ui.envDefaults.pressurePa" field="advPressure" group="pressure" base="Pa" :precision="1" />
                <UnitToggle field="advPressure" group="pressure" base="Pa" unit-class="opt-unit" />
              </div>
              <div class="opt-fld">
                <label>Relative humidity</label>
                <input class="opt-num" type="number" v-model.number="state.ui.envDefaults.humidityPct" min="0" max="100" />
                <span class="opt-unit">%</span>
              </div>
              <div class="opt-fld">
                <label>Sound velocity</label>
                <input class="opt-num opt-greyed" type="text" :value="fmt(soundVel, fieldDp('advSoundVelocity'))" readonly />
                <span class="opt-unit">m/s</span>
              </div>
            </div>
          </fieldset>

          <fieldset class="opt-group">
            <legend>Units</legend>
            <button class="opt-reset-btn" title="Reset every field's display unit back to its default (cm, L, g, Hz, K, Pa…) — undoes any unit clicking. The stored design is never affected." @click="resetUnitTokens">
              Reset to Metric (l, mm, …)
            </button>
          </fieldset>
        </template>

        <template v-else>
          <fieldset class="opt-group">
            <legend>Colors</legend>
            <div class="opt-color-grid">
              <div class="opt-color-row" v-for="row in COLOR_ROWS" :key="row.key">
                <label>{{ row.label }}</label>
                <input type="color" :value="colorValue(row.key)" @input="setColor(row.key, $event)" />
                <button class="opt-clear-btn" title="Revert to the current skin's own color" @click="clearColor(row.key)">↺</button>
              </div>
              <div class="opt-color-row opt-disabled" title="WinISD draws this on its 0 dB-normalized &quot;Transfer function magnitude&quot; chart — OpenISD's SPL chart plots absolute dB SPL, not a normalized transfer function, so there is no chart to draw this reference line on yet.">
                <label>0 dB line</label>
                <input type="color" value="#000000" disabled />
              </div>
              <div class="opt-color-row opt-disabled" title="Same gap as 0 dB line above — no normalized transfer-function chart to draw an F3 reference line on yet.">
                <label>-3dB line</label>
                <input type="color" value="#808080" disabled />
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
                  <td><input class="opt-num" type="number" v-model.number="state.P.fmin" /></td>
                  <td><input class="opt-num" type="number" v-model.number="state.P.fmax" /></td>
                  <td>Hz</td>
                  <td></td>
                </tr>
                <tr v-for="row in LIMIT_ROWS" :key="row.tab">
                  <td>{{ row.label }}</td>
                  <td><input class="opt-num" type="number" :placeholder="String(row.start)" :value="limitVal(row.tab, 'min')" @change="setLimit(row.tab, 'min', $event)" /></td>
                  <td><input class="opt-num" type="number" :placeholder="String(row.end)" :value="limitVal(row.tab, 'max')" @change="setLimit(row.tab, 'max', $event)" /></td>
                  <td>{{ row.unit }}</td>
                  <td><button class="opt-clear-btn" title="Reset to auto-scale" @click="resetLimit(row.tab)">↺</button></td>
                </tr>
              </tbody>
            </table>
          </fieldset>
        </template>
      </div>

      <div class="opt-footer">
        <button class="opt-ok" @click="close">OK</button>
        <button @click="close">Cancel</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Fully self-contained (own overlay/modal shell, not the shared global .overlay/.modal) —
   deliberately unique class names. Original/Classic each define their OWN unscoped `.overlay`/
   `.modal` rules for their native-style dialogs (e.g. Original's centers-at-top variant); Vue
   applies a parent's scoped-style attribute to a child component's ROOT element too, so reusing
   those same class names here would leak the shell's positioning/sizing onto this modal. */
.opt-overlay { position: fixed; inset: 0; background: rgba(4, 8, 14, 0.66); display: flex;
  align-items: center; justify-content: center; z-index: 200; }
.opt-modal { width: min(460px, 92vw); max-height: 86vh; display: flex; flex-direction: column;
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
.opt-reset-btn { width: 100%; padding: 6px 0; cursor: pointer; }
.opt-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 10px 14px; border-top: 1px solid var(--line); }
.opt-ok { font-weight: 600; }

.opt-row { display: flex; align-items: center; gap: 10px; font-size: 12px; }
.opt-row label { flex: 0 0 90px; color: var(--mut); }
.opt-input { flex: 1; padding: 4px 6px; }

/* Single column, not a 2-up grid: a 1fr grid track defaults to min-width:auto, so it can never
   shrink below its content's intrinsic width (label + fixed-width input + unit) — with labels
   like "Relative humidity" that overflowed the modal's fixed width and got clipped by its
   `overflow: hidden`. Stacking avoids the whole class of bug and matches .opt-row above. */
.opt-env-grid { display: flex; flex-direction: column; gap: 8px; }
.opt-fld { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.opt-fld label { flex: 0 0 120px; color: var(--mut); }
.opt-num { width: 100px; padding: 3px 5px; }
.opt-greyed { color: var(--mut); }
.opt-unit { font-size: 11px; color: var(--mut); min-width: 2.2em; }

.opt-color-grid { display: grid; gap: 6px; }
.opt-color-row { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.opt-color-row label { flex: 1; color: var(--mut); }
.opt-color-row input[type="color"] { width: 32px; height: 22px; padding: 0; border: 1px solid var(--line); cursor: pointer; }
.opt-color-row.opt-disabled input[type="color"] { cursor: not-allowed; opacity: 0.5; }
.opt-clear-btn { border: 1px solid var(--line); background: var(--panel2); color: var(--mut);
  cursor: pointer; font-size: 12px; width: 22px; height: 22px; line-height: 1; }

.opt-limits { width: 100%; border-collapse: collapse; font-size: 11px; }
.opt-limits th, .opt-limits td { padding: 3px 4px; text-align: left; }
.opt-limits th { color: var(--mut); font-weight: 500; border-bottom: 1px solid var(--line); }
.opt-limits .opt-num { width: 60px; }
</style>
