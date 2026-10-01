<script setup lang="ts">
// The bottom navigation. A controlled component — MobileShell-hooks.ts's `destination` ref is
// the source of truth, this only displays it and emits a change. No hook: it holds no state and
// makes no decision, same as Flash.vue. The destination list mirrors desktop's own tab names
// (`.project-nav li` in OriginalShell.vue) — a "graph" destination is the one addition, because
// GraphPanel's touch-action:none canvas needs its own screen rather than a spot in a scrolling
// column (see MobileShell.vue's `MobileDestination` doc).
import { computed } from 'vue';
import type { MobileDestination } from '../../../hooks/MobileShell-hooks.js';

const props = defineProps<{
  modelValue: MobileDestination;
  /** Mirrors desktop's own nav gate: sealed has no Enclosure destination. */
  showEnclosure: boolean;
  enclosureLabel: string;
  /** True while the content pane above has more to scroll down to — shows as a shadow on this
   *  bar's own top edge (MobileShell-hooks.ts's `canScrollDown`). */
  shadowAbove?: boolean;
}>();
defineEmits<{ 'update:modelValue': [value: MobileDestination] }>();

const DESTINATIONS = computed<{ id: MobileDestination; label: string }[]>(() => [
  { id: 'box', label: 'Box' },
  { id: 'driver', label: 'Driver' },
  { id: 'signal', label: 'Signal' },
  ...(props.showEnclosure ? [{ id: 'enclosure' as const, label: props.enclosureLabel }] : []),
  { id: 'filters', label: 'Filters' },
  { id: 'graph', label: 'Graph' },
]);
</script>

<template>
  <nav class="mob-tabbar" :class="{ 'mob-shadow-above': shadowAbove }">
    <button
      v-for="d in DESTINATIONS"
      :key="d.id"
      type="button"
      class="mob-tab"
      :class="{ active: modelValue === d.id }"
      @click="$emit('update:modelValue', d.id)"
    >{{ d.label }}</button>
  </nav>
</template>

<style scoped>
.mob-tabbar {
  display: flex;
  flex-shrink: 0;
  height: 56px;
  border-top: 1px solid var(--line);
  background: var(--panel);
}
.mob-tab {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--mut);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border-top: 3px solid transparent;
}
.mob-tab.active {
  color: var(--acc);
  border-top-color: var(--acc);
}
.mob-tabbar.mob-shadow-above {
  box-shadow: 0 -4px 6px -4px rgba(0, 0, 0, 0.3);
}
</style>
