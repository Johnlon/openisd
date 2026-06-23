<script setup>
import { state, driver, syncedP, curvesData, driverShort, pinCompare } from '../store.js';
import { TABS } from '../utils/series.js';
import { DPAL } from '../presets.js';

function toggleGraph(id) {
  const i = state.graphs.indexOf(id);
  if (i >= 0) { if (state.graphs.length > 1) state.graphs.splice(i, 1); }
  else state.graphs.push(id);
}

function removeCompare(i) { state.compare.splice(i, 1); }
function clearCompare() { state.compare = []; }
</script>

<template>
  <div class="gtoolbar">
    <span class="lab">Graphs:</span>
    <span v-for="t in TABS" :key="t.id"
          class="gchip" :class="{ on: state.graphs.includes(t.id) }"
          @click="toggleGraph(t.id)">{{ t.name }}</span>
    <span class="sep"></span>
    <button @click="pinCompare">+ Compare current</button>
    <template v-if="state.compare.length">
      <span class="lab">vs</span>
      <span v-for="(d, i) in state.compare" :key="i"
            class="gchip on" :style="{ borderColor: d.color, color: d.color }"
            @click="removeCompare(i)">{{ d.name }} ✕</span>
      <button @click="clearCompare">clear</button>
    </template>
  </div>
</template>
