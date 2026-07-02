<script setup>
import { ref, computed } from 'vue';
import { state, pinCompare } from '../store.js';

const showHelp = ref(false);
import { TABS } from '../utils/series.js';

function toggleGraph(id) {
  const i = state.graphs.indexOf(id);
  if (i >= 0) { if (state.graphs.length > 1) state.graphs.splice(i, 1); }
  else state.graphs.push(id);
}

function removeCompare(i) { state.compare.splice(i, 1); }
function clearCompare() { state.compare = []; }

// Frequency-axis (X) range — the "zoom out / in" control shared by every chart.
// Bounds: 1 Hz ≤ fmin < fmax ≤ 40 kHz. Inputs validate against each other so the
// range can never invert or collapse. Presets are quick jumps; the inputs give
// arbitrary control.
const FMIN_LIMIT = 1, FMAX_LIMIT = 40000;
function setRange(lo, hi) { state.P.fmin = lo; state.P.fmax = hi; }
function onFmin(e) {
  const v = parseFloat(e.target.value);
  if (isFinite(v) && v >= FMIN_LIMIT && v < state.P.fmax) state.P.fmin = v;
  // Rejected input leaves state unchanged, so :value won't re-render — snap the
  // field back to the authoritative value so it never shows a value that isn't applied.
  else e.target.value = Math.round(state.P.fmin);
}
function onFmax(e) {
  const v = parseFloat(e.target.value);
  if (isFinite(v) && v > state.P.fmin && v <= FMAX_LIMIT) state.P.fmax = v;
  else e.target.value = Math.round(state.P.fmax);
}

const effectiveF = computed(() => state.cursorLocked ? state.pinnedF : (state.cursorF ?? state.pinnedF));

function setCursorHz(e) {
  const v = parseFloat(e.target.value);
  state.pinnedF = isFinite(v) && v > 0 ? v : null;
}

function nudge(dir) {
  const f = effectiveF.value;
  if (!f) return;
  // step ~1% of current frequency (log-uniform feel), min 0.1 Hz
  const step = Math.max(0.1, f * 0.01);
  state.pinnedF = Math.max(0.1, f + dir * step);
}

function clearPin() { state.pinnedF = null; state.cursorLocked = false; }
function toggleLock() {
  state.cursorLocked = !state.cursorLocked;
  if (state.cursorLocked && state.cursorF) state.pinnedF = state.cursorF;
}
</script>

<template>
  <div class="gtoolbar">
    <span class="lab">Graphs:</span>
    <span v-for="t in TABS" :key="t.id"
          class="gchip" :class="{ on: state.graphs.includes(t.id) }"
          :title="state.graphs.includes(t.id) ? `Hide ${t.name} graph` : `Show ${t.name} graph`"
          @click="toggleGraph(t.id)">{{ t.name }}</span>
    <span class="sep"></span>
    <span class="lab" title="Frequency range shown on every chart's X axis. Widen it to zoom out, narrow it to zoom in.">Range:</span>
    <input class="freq-in" type="number" :min="FMIN_LIMIT" :max="FMAX_LIMIT" step="1"
           :value="Math.round(state.P.fmin)" @change="onFmin"
           title="Lowest frequency shown (Hz). Minimum 1 Hz, must be below the max." />
    <span class="freq-dash">–</span>
    <input class="freq-in" type="number" :min="FMIN_LIMIT" :max="FMAX_LIMIT" step="1"
           :value="Math.round(state.P.fmax)" @change="onFmax"
           title="Highest frequency shown (Hz). Maximum 40 kHz, must be above the min." />
    <span class="freq-unit">Hz</span>
    <button class="freq-preset" :class="{ on: state.P.fmin === 20 && state.P.fmax === 20000 }"
            @click="setRange(20, 20000)" title="Audio band: 20 Hz – 20 kHz">20–20k</button>
    <button class="freq-preset" :class="{ on: state.P.fmin === 10 && state.P.fmax === 20000 }"
            @click="setRange(10, 20000)" title="Default: 10 Hz – 20 kHz">10–20k</button>
    <button class="freq-preset" :class="{ on: state.P.fmin === 1 && state.P.fmax === 40000 }"
            @click="setRange(1, 40000)" title="Full: 1 Hz – 40 kHz (zoom all the way out)">1–40k</button>
    <span class="sep"></span>
    <button @click="pinCompare" title="Snapshot the current design and overlay its curves on all graphs for comparison">+ Compare current</button>
    <template v-if="state.compare.length">
      <span class="lab">vs</span>
      <span v-for="(d, i) in state.compare" :key="i"
            class="gchip on" :style="{ borderColor: d.color, color: d.color }"
            :title="`Remove '${d.name}' from comparison overlays`"
            @click="removeCompare(i)">{{ d.name }} ✕</span>
      <button @click="clearCompare" title="Remove all comparison overlays from graphs">clear</button>
    </template>
    <span class="sep"></span>
    <span class="lab" title="Right-click any graph to snap &amp; lock cursor to nearest peak or trough">Cursor:</span>
    <button class="nudge-btn" @click="nudge(-1)" title="Step cursor down ~1%">−</button>
    <input class="cursor-hz"
           type="number" min="1" max="40000" step="0.1"
           :value="effectiveF ? effectiveF.toFixed(1) : ''"
           @change="setCursorHz"
           placeholder="Hz" />
    <button class="nudge-btn" @click="nudge(+1)" title="Step cursor up ~1%">+</button>
    <button class="nudge-btn lock-btn" :class="{ locked: state.cursorLocked }"
            @click="toggleLock"
            :title="state.cursorLocked ? 'Unlock cursor (hover will move it)' : 'Lock cursor at current frequency'">
      {{ state.cursorLocked ? '🔒' : '🔓' }}
    </button>
    <button v-if="state.pinnedF" class="nudge-btn" @click="clearPin" title="Clear pinned cursor">✕</button>
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
              <td>Pins (locks) the cursor at that frequency so it stays put while you adjust settings.</td>
            </tr>
            <tr>
              <td class="hk">Drag</td>
              <td>Select a frequency range — the readout shows the <b>average</b>, <b>peak</b>, and <b>ripple</b> (peak − trough) of the curve within the band. Useful for checking flatness in a target passband.</td>
            </tr>
            <tr>
              <td class="hk">Right-click</td>
              <td>Context menu — snap and lock the cursor to the nearest <b>peak</b> or <b>trough</b> to the left or right of the current position.</td>
            </tr>
            <tr>
              <td class="hk">Hz input</td>
              <td>Type a frequency to jump the cursor there directly.</td>
            </tr>
            <tr>
              <td class="hk">± buttons</td>
              <td>Nudge the cursor up or down by ~1% (log-uniform step).</td>
            </tr>
            <tr>
              <td class="hk">🔒 / 🔓</td>
              <td>Toggle cursor lock — locked cursor stays at the pinned frequency; unlocked cursor follows the mouse.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.cursor-hz {
  width: 62px;
  font-size: 11px;
  padding: 1px 4px;
  background: var(--panel2);
  border: 1px solid var(--mut);
  border-radius: 3px;
  color: var(--fg);
  text-align: right;
}
.cursor-hz:focus { outline: none; border-color: var(--acc); }
.freq-in {
  width: 56px;
  font-size: 11px;
  padding: 1px 4px;
  background: var(--panel2);
  border: 1px solid var(--mut);
  border-radius: 3px;
  color: var(--fg);
  text-align: right;
}
.freq-in:focus { outline: none; border-color: var(--acc); }
.freq-dash { color: var(--mut); font-size: 11px; }
.freq-unit { color: var(--mut); font-size: 11px; margin-right: 2px; }
.freq-preset {
  font-size: 11px;
  padding: 1px 6px;
  background: none;
  border: 1px solid var(--mut);
  border-radius: 3px;
  color: var(--mut);
  cursor: pointer;
}
.freq-preset:hover { color: var(--fg); border-color: var(--fg); }
.freq-preset.on { border-color: var(--acc); color: var(--acc); }
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
.lock-btn.locked { border-color: var(--acc); color: var(--acc); }
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
