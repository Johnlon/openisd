<script setup lang="ts">
// One button that shows a port's shape (a drawn circle or rounded slot beside the word Round or Slotted)
// and, when pressed, asks for the other shape. It holds no state: the caller writes the shape.
import {computed} from 'vue';
import {DesktopLabels} from '@openisd/design/fields';
import type {VentShape} from '@openisd/design';

const props = defineProps<{shape: VentShape}>();
const emit = defineEmits<{(e: 'update:shape', shape: VentShape): void}>();

const next = computed<VentShape>(() => props.shape === 'round' ? 'slotted' : 'round');
const name = computed(() => DesktopLabels.ventShapeToggleName(props.shape, next.value));
</script>

<template>
  <button type="button" class="port-shape-toggle" :aria-label="name" :title="name" @click="emit('update:shape', next)">
    <svg width="20" height="14" viewBox="1 0 20 14" aria-hidden="true">
      <circle v-if="shape === 'round'" cx="11" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="1.75" />
      <rect v-else x="4" y="3.5" width="14" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="1.75" />
    </svg>
    <span>{{ DesktopLabels.ventShapeWord(shape) }}</span>
  </button>
</template>

<style scoped>
.port-shape-toggle {
  box-sizing: border-box; padding: 0 5px; display: inline-flex; align-items: center; justify-content: center; gap: 4px;
  background: #f7f7f7; border: 1px solid #888; border-radius: 3px; color: #222; cursor: pointer; font: inherit; font-size: 12px; line-height: 1; white-space: nowrap; flex: none;
}
.port-shape-toggle:hover { background: #e9e9e9; border-color: #555; }
.port-shape-toggle:active { background: #dedede; }
.port-shape-toggle:focus-visible { outline: 2px solid #1868d1; outline-offset: 1px; }
</style>
