<script setup>
import { computed } from 'vue';
import { state, pinCompare } from '../store.js';
import { TABS } from '../utils/series.js';

function toggleGraph(id) {
  const i = state.graphs.indexOf(id);
  if (i >= 0) { if (state.graphs.length > 1) state.graphs.splice(i, 1); }
  else state.graphs.push(id);
}

function removeCompare(i) { state.compare.splice(i, 1); }
function clearCompare() { state.compare = []; }

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
    <button @click="state.browseMode = 'browse'; state.browseOpen = true"
            title="Browse the driver library — view specs and datasheets without changing the current design">Browse drivers</button>
    <span class="sep"></span>
    <span class="lab">Graphs:</span>
    <span v-for="t in TABS" :key="t.id"
          class="gchip" :class="{ on: state.graphs.includes(t.id) }"
          :title="state.graphs.includes(t.id) ? `Hide ${t.name} graph` : `Show ${t.name} graph`"
          @click="toggleGraph(t.id)">{{ t.name }}</span>
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
           type="number" min="1" max="9999" step="0.1"
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
  </div>
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
</style>
