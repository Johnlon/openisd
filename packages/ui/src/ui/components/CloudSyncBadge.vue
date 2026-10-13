<script setup lang="ts">
import type {SyncDisplay, SyncTap, SyncTone} from '@openisd/design/cloud';
import ToolbarIcon from './ToolbarIcon.vue';

defineProps<{
  display: SyncDisplay;
}>();

const emit = defineEmits<{
  (e: 'tap', action: SyncTap): void;
}>();

const TONE_VARS: Record<SyncTone, string> = {
  muted: 'var(--mut)',
  accent: 'var(--acc)',
  good: 'var(--good)',
  warn: 'var(--acc2)',
  bad: 'var(--bad)',
};
</script>

<template>
  <button
    type="button"
    class="cloud-sync-badge"
    :title="display.tooltip"
    :style="{ color: TONE_VARS[display.tone] }"
    @click="emit('tap', display.tap)"
  >
    <ToolbarIcon :name="display.glyph" />
    <span v-if="display.badge !== null" class="cloud-sync-badge-num">
      {{ display.badge }}
    </span>
  </button>
</template>

<style scoped>
.cloud-sync-badge {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
}

.cloud-sync-badge-num {
  position: absolute;
  top: -4px;
  right: -5px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  border-radius: 7px;
  background: var(--acc2, #d9534f);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 14px;
  text-align: center;
}
</style>
