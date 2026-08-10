<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue';
import { state } from '../../logic/store.js';

const showHelp = ref(false);
import { TABS } from '../../logic/series.js';
import type { ChartTabId } from '../../logic/series.js';

function toggleGraph(id: ChartTabId) {
  const i = state.graphs.indexOf(id);
  if (i >= 0) { if (state.graphs.length > 1) state.graphs.splice(i, 1); }
  else state.graphs.push(id);
}


// Frequency-axis (X) range shared by every chart — a dropdown of preset spans, all
// starting at 1 Hz. Selecting one sets fmin/fmax and re-sweeps. "custom" only shows
// if the state doesn't match a preset (e.g. an older persisted range).
const X_RANGES = [
  { label: '1 – 500 Hz', hi: 500 },
  { label: '1 – 1 kHz',  hi: 1000 },
  { label: '1 – 10 kHz', hi: 10000 },
  { label: '1 – 20 kHz', hi: 20000 },
  { label: '1 – 40 kHz', hi: 40000 },
];
const rangeSel = computed({
  get: () => (state.P.fmin === 1 && X_RANGES.some(r => r.hi === state.P.fmax)) ? String(state.P.fmax) : '',
  set: (v: string) => { if (v) { state.P.fmin = 1; state.P.fmax = +v; } },
});

const effectiveF = computed(() => state.cursorLocked ? state.pinnedF : (state.cursorF ?? state.pinnedF));
const fmin = computed(() => state.P.fmin ?? 1);
const fmax = computed(() => state.P.fmax ?? 20000);

function setCursorHz(e: Event) {
  const v = parseFloat((e.target as HTMLInputElement).value);
  if (isFinite(v) && v > 0) {
    state.pinnedF = Math.max(fmin.value, Math.min(fmax.value, v));
    state.cursorLocked = true;
  }
  else { state.pinnedF = null; state.cursorLocked = false; }
}

function spinHz(dir: number, factor = 1.02) {
  const current = effectiveF.value ?? state.cursorF ?? ((fmin.value * fmax.value) ** 0.5);
  let nextF = dir > 0 ? current * factor : current / factor;
  if (dir > 0 && nextF <= current) nextF = current + 0.1;
  if (dir < 0 && nextF >= current) nextF = current - 0.1;
  state.pinnedF = Math.max(fmin.value, Math.min(fmax.value, nextF));
  state.cursorLocked = true;
}

function nudge(dir: number) {
  spinHz(dir, 1.02);
}

function onHzKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    spinHz(1, e.shiftKey ? 1.05 : 1.02);
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    spinHz(-1, e.shiftKey ? 1.05 : 1.02);
  }
}

function onHzWheel(e: WheelEvent) {
  const dir = e.deltaY < 0 ? 1 : -1;
  spinHz(dir, e.shiftKey ? 1.05 : 1.02);
}

// Press-and-hold auto-repeat for the ◄ ► arrows: one step immediately, then repeat
// after a short delay so a long press "spins" the frequency.
let holdTimer: ReturnType<typeof setTimeout> | null = null, holdInterval: ReturnType<typeof setInterval> | null = null;
function startNudge(dir: number) {
  nudge(dir);
  holdTimer = setTimeout(() => { holdInterval = setInterval(() => nudge(dir), 60); }, 300);
}
function stopNudge() {
  if (holdTimer) clearTimeout(holdTimer);
  if (holdInterval) clearInterval(holdInterval);
  holdTimer = holdInterval = null;
}
onBeforeUnmount(stopNudge);
</script>

<template>
  <div class="gtoolbar">
    <span class="lab">Graphs:</span>
    <span v-for="t in TABS" :key="t.id"
          class="gchip" :class="{ on: state.graphs.includes(t.id) }"
          :title="state.graphs.includes(t.id) ? `Hide ${t.name} graph` : `Show ${t.name} graph`"
          @click="toggleGraph(t.id)">{{ t.name }}</span>
    <span class="sep"></span>
    <span class="tgroup">
      <span class="lab" title="Frequency range shown on every chart's X axis. Narrower = zoomed in.">Range:</span>
      <select class="freq-sel" v-model="rangeSel"
              title="Frequency span shown on every chart. The vertical scale auto-fits the data in this range.">
        <option v-if="rangeSel === ''" value="">custom</option>
        <option v-for="r in X_RANGES" :key="r.hi" :value="String(r.hi)">{{ r.label }}</option>
      </select>
    </span>
    <span class="sep"></span>
    <span class="tgroup">
      <span class="lab" title="Cursor frequency. Hover a graph to read any point; click a graph, type here, or use the ◄ ► arrows or scroll wheel to spin the crosshair logarithmically within chart limits. Click the graph again to unlock.">Cursor:</span>
      <button class="nudge-btn" @pointerdown="startNudge(-1)" @pointerup="stopNudge" @pointerleave="stopNudge"
              title="Spin frequency down logarithmically within chart limits (hold to spin)">◄</button>
      <input class="cursor-hz"
             type="number" :min="fmin" :max="fmax" step="any"
             :value="effectiveF ? effectiveF.toFixed(2) : ''"
             @change="setCursorHz"
             @keydown="onHzKeydown"
             @wheel.prevent="onHzWheel"
             placeholder="Hz"
             title="Cursor frequency in Hz. Type or use ArrowUp/ArrowDown/wheel to spin logarithmically within chart limits." />
      <button class="nudge-btn" @pointerdown="startNudge(1)" @pointerup="stopNudge" @pointerleave="stopNudge"
              title="Spin frequency up logarithmically within chart limits (hold to spin)">►</button>
    </span>
    <span class="sep"></span>
    <button class="nudge-btn help-btn" @click="showHelp = true" title="Graph interaction guide — hover, click, drag, right-click">Graph help ?</button>
  </div>

  <Teleport to="body">
    <div v-if="showHelp" class="help-overlay" @click.self="showHelp = false">
      <div class="help-modal">
        <div class="help-header">
          <span>Graph interactions</span>
          <button class="help-close" @click="showHelp = false" title="Close">✕</button>
        </div>
        <table class="help-table">
          <tbody>
            <tr>
              <td class="hk">Hover</td>
              <td>Crosshair tracks the cursor — the readout (top-right of each graph) shows the frequency and Y value at that point.</td>
            </tr>
            <tr>
              <td class="hk">Click</td>
              <td>Locks the crosshair at that frequency so it stays put while you adjust settings. Click again to unlock and resume hover tracking.</td>
            </tr>
            <tr>
              <td class="hk">Drag (plot)</td>
              <td>Select a frequency range — the readout shows the <b>average</b>, <b>peak</b>, and <b>ripple</b> (peak − trough) of the curve within the band. Useful for checking flatness in a target passband.</td>
            </tr>
            <tr>
              <td class="hk">Drag Y axis</td>
              <td>Rescale the level (vertical) axis: drag the <b>middle</b> to pan, the <b>top/bottom end</b> to zoom that end, <b>Shift-drag</b> for symmetric zoom. <b>Double-click</b> the axis to auto-fit (auto-scale brings the whole visible curve into frame).</td>
            </tr>
            <tr>
              <td class="hk">Drag X axis</td>
              <td>Rescale the frequency (horizontal) axis: drag the <b>middle</b> to pan, the <b>left/right end</b> to zoom that end, <b>Shift-drag</b> for symmetric zoom. <b>Double-click</b> resets to 1–20 kHz. (Or pick a preset span from the Range dropdown.)</td>
            </tr>
            <tr>
              <td class="hk">Right-click</td>
              <td>Context menu — snap the marker to the nearest <b>peak</b> or <b>trough</b> to the left or right of the current position.</td>
            </tr>
            <tr>
              <td class="hk">Hz input</td>
              <td>Type a frequency to place the marker there directly.</td>
            </tr>
            <tr>
              <td class="hk">◄ ► arrows</td>
              <td>Step the cursor down or up by ~1% (log-uniform step); <b>hold to spin</b>. Locks the cursor — click the graph again to unlock.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.cursor-hz {
  width: 84px;
  font-size: 11px;
  padding: 1px 4px;
  background: var(--panel2);
  border: 1px solid var(--mut);
  border-radius: 3px;
  color: var(--fg);
  text-align: right;
}
.cursor-hz:focus { outline: none; border-color: var(--acc); }
/* Keep a labelled control group (Range, Cursor) intact as one unit when the
   toolbar wraps to a new line, instead of splitting mid-group. */
.tgroup { display: inline-flex; align-items: center; gap: 6px; }
.freq-sel {
  font-size: 11px;
  padding: 1px 4px;
  background: var(--panel2);
  border: 1px solid var(--mut);
  border-radius: 3px;
  color: var(--fg);
  cursor: pointer;
}
.freq-sel:focus { outline: none; border-color: var(--acc); }
.nudge-btn {
  font-size: 11px;
  padding: 1px 5px;
  background: none;
  border: 1px solid var(--mut);
  border-radius: 3px;
  color: var(--mut);
  cursor: pointer;
}
.nudge-btn:hover { color: var(--fg); border-color: var(--fg); }
.help-btn { font-weight: 700; }

.help-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.55); z-index: 200;
  display: flex; align-items: center; justify-content: center;
}
.help-modal {
  background: var(--panel); border: 1px solid var(--line); border-radius: 7px;
  padding: 18px 22px; max-width: 540px; width: 94vw;
  box-shadow: 0 8px 32px #0008; font-size: 12px;
}
.help-header {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 13px; font-weight: 600; color: var(--fg); margin-bottom: 14px;
}
.help-close {
  background: none; border: none; color: var(--mut); font-size: 15px;
  cursor: pointer; padding: 0 2px; line-height: 1;
}
.help-close:hover { color: var(--fg); }
.help-table { width: 100%; border-collapse: collapse; }
.help-table tr + tr td { border-top: 1px solid var(--line); }
.help-table td { padding: 7px 4px; vertical-align: top; color: var(--fg); line-height: 1.45; }
.hk {
  white-space: nowrap; font-weight: 600; color: var(--acc2);
  padding-right: 14px; width: 1%;
}
</style>
