<script setup lang="ts">
// The phone Save button: a floppy disk, grey when the open project is saved, lit when it is not.
import ToolbarIcon from '../../components/ToolbarIcon.vue';
import { useMobileSaveButton } from '../../../hooks/MobileSaveButton-hooks.js';

const { state, note, save } = useMobileSaveButton();
</script>

<template>
  <span class="mob-save-wrap">
    <button type="button" class="mob-save" :class="{ lit: state.lit }" :title="state.title" :aria-label="state.title" data-testid="mob-save" @click="save">
      <ToolbarIcon name="save" />
    </button>
    <!-- Hangs under the button, right-aligned: over the panel's title bar or the chart's empty
         corner, never over a control. -->
    <span v-if="note" class="mob-save-note" role="status">{{ note }}</span>
  </span>
</template>

<style scoped>
.mob-save-wrap { position: relative; flex: none; margin-left: 6px; }
.mob-save {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  opacity: 0.55;
  filter: grayscale(1);
}
.mob-save.lit {
  opacity: 1;
  filter: none;
  border-color: var(--acc);
  background: var(--acc);
}
/* Solid blue with a white floppy, as in the approved mock-up (John, 17 Oct 2026). */
.mob-save.lit :deep(svg path) { fill: #fff; stroke: #fff; }
.mob-save.lit :deep(svg rect) { fill: var(--acc); }
.mob-save-note {
  position: absolute;
  top: calc(100% + 2px);
  right: 0;
  z-index: 30;
  max-width: 260px;
  box-sizing: border-box;
  padding: 4px 10px;
  background: #fff;
  color: var(--fg);
  border: 1px solid var(--acc);
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
  filter: none;
}
</style>
