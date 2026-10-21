<script setup lang="ts">
import {computed} from 'vue';
import type {SyncDisplay, SyncTap, SyncTone} from '@openisd/design/cloud';
import {useApp} from '../../logic/app.js';
import ToolbarIcon from './ToolbarIcon.vue';

defineProps<{
  display: SyncDisplay;
}>();

const emit = defineEmits<{
  (e: 'tap', action: SyncTap): void;
}>();

/** The phone draws the badge as a 40 px touch target with a 24 px glyph (PHONE_CLASSIC_BUILD_SPEC row 30). */
const presentation = useApp().presentation;
const phone = computed(() => presentation.shownSkin() === 'mobile');

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
    :class="{ 'cloud-sync-badge-phone': phone }"
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

/* Phone: the badge (accepted mock, cloud-sync-badge): 40 x 40, glyph 24, the count inside the top right corner. */
.cloud-sync-badge-phone { flex: none; width: 40px; height: 40px; }
.cloud-sync-badge-phone :deep(svg) { width: 24px; height: 24px; }
.cloud-sync-badge-phone .cloud-sync-badge-num { top: 4px; right: 4px; background: #d9534f; }
</style>
