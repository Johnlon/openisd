<script setup>
import { computed } from 'vue';
import { state } from '../store.js';
import GraphPanel from './GraphPanel.vue';

const cols = computed(() => {
  const n = state.graphs.length;
  return n <= 1 ? 1 : n <= 4 ? 2 : 3;
});
</script>

<template>
  <div id="ggrid" class="ggrid" :style="{ gridTemplateColumns: `repeat(${cols}, 1fr)` }">
    <GraphPanel v-for="id in state.graphs" :key="id" :tabId="id" />
  </div>
</template>
