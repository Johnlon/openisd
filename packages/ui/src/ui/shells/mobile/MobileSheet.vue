<script setup lang="ts">
// One bottom sheet on the mobile Graph page, Tune or What-if (each its own sheet, with its own
// fields): a pull-tab when closed, a resizable sheet of rows when open. Behaviour lives in
// MobileSheet-hooks.ts.
import NumInput from '../../components/NumInput.vue';
import VentPortFields from '../../components/VentPortFields.vue';
import UnitToggle from '../../components/UnitToggle.vue';
import { useMobileSheet } from '../../../hooks/MobileSheet-hooks.js';
import type { SheetMode } from '@openisd/design/fields';

const props = defineProps<{ open: boolean; mode: SheetMode; hidden: boolean }>();
const emit = defineEmits<{ 'update:open': [open: boolean] }>();

const { isOpen, lines, rowSlots, mode, portEditor, portView, portValuePress, closePortEditor, sheetEl, sheetStyle, setValue, openSheet, close, reset,
  onTabDown, onTabUp, onHandleDown, onHandleMove, onHandleUp } =
  useMobileSheet({ open: () => props.open, setOpen: v => emit('update:open', v), mode: props.mode });
</script>

<template>
  <button v-if="!isOpen && !hidden" type="button" class="mob-sheet-tab" :aria-label="'Open ' + mode.label"
          @pointerdown="onTabDown" @pointerup="onTabUp" @click="openSheet">{{ mode.label }} ▲</button>
  <section v-else-if="isOpen" ref="sheetEl" class="mob-sheet" :style="sheetStyle" :aria-label="mode.label">
    <div class="mob-sheet-handle" role="separator" aria-label="Drag to resize"
         @pointerdown="onHandleDown" @pointermove="onHandleMove" @pointerup="onHandleUp" @pointercancel="onHandleUp">
      <span class="mob-sheet-grip"></span>
    </div>
    <div class="mob-sheet-rows" :style="{ '--mob-row-slots': rowSlots }">
      <div v-for="(line, lineIdx) in lines" :key="lineIdx" class="mob-sheet-line">
        <div v-for="cell in line" :key="cell.field.label" class="mob-sheet-cell mob-sheet-row">
          <span class="mob-sheet-label">{{ mode.labelOf(cell.field) }}</span>
          <span class="mob-sheet-value">
            <NumInput :field="cell.field.field" :model-value="cell.value" :precision="cell.field.field.precision"
                      :aria-label="mode.labelOf(cell.field)" stepper
                      @pointerdown="portValuePress($event, cell)" @mousedown="portValuePress($event, cell)" @click="portValuePress($event, cell)"
                      @update:model-value="(v: number | null) => setValue(cell.field, v)" />
          </span>
          <UnitToggle :field="cell.field.field" unit-class="mob-sheet-unit" />
        </div>
      </div>
    </div>
    <div v-if="portEditor !== null" class="mob-sheet-port" role="dialog" :aria-label="portEditor.field.portTitle ?? 'Port'">
      <div class="mob-sheet-port-head">
        <span class="mob-sheet-port-title">{{ portEditor.field.portTitle }}</span>
        <button type="button" class="mob-sheet-btn mob-sheet-close" @click="closePortEditor">Close</button>
      </div>
      <div class="mob-sheet-port-body"><VentPortFields v-if="portView !== null" :port="portView" /></div>
    </div>
    <div class="mob-sheet-foot">
      <div class="mob-sheet-actions">
        <button v-if="mode.edits === 'whatIfLayer'" type="button" class="mob-sheet-btn" title="Back to the design's values" @click="reset">Reset</button>
        <button type="button" class="mob-sheet-btn mob-sheet-close" :title="mode.edits === 'whatIfLayer' ? 'Close. The design is not changed.' : 'Close'" @click="close">Close</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.mob-sheet-tab {
  flex: 1;
  min-width: 0;
  height: 28px;
  border: none;
  border-top: 1px solid var(--line);
  background: var(--panel2, #f0f0f0);
  color: var(--fg);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  touch-action: none;
  cursor: pointer;
}
.mob-sheet {
  /* The sheet keeps its own dense rows; the tab rows' roomier label line is not its. */
  --mob-row-pad-y: 2px;
  --mob-label-lh: 12px;
  /* Shrinks before the chart does (the chart keeps 120 px); its rows then scroll inside it. */
  flex: 1 1 0;
  min-width: 0;
  height: auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--panel);
  border-top: 1px solid var(--line);
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.15);
  position: relative;
}
/* A port's own fields over the sheet, a sheet within the sheet; Close returns to the rows. */
.mob-sheet-port {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  background: var(--panel);
}
.mob-sheet-port-head {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  border-bottom: 1px solid var(--line);
}
.mob-sheet-port-title { font-weight: 600; font-size: 15px; }
.mob-sheet-port-body { flex: 1; min-height: 0; overflow-y: auto; }
.mob-sheet-handle {
  flex: none;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: none;
  cursor: ns-resize;
}
.mob-sheet-grip { width: 40px; height: 4px; border-radius: 2px; background: var(--line); }

.mob-sheet-rows {
  /* Both modes reserve the same row slots, so the sheet never resizes on a mode switch; when the
     screen is too short the rows give way and scroll. */
  flex: 1 1 calc(var(--mob-row-slots, 0) * var(--mob-row-min) + 8px);
  min-height: 0;
  overflow-y: auto;
  padding-bottom: 8px;
}
.mob-sheet-line {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: var(--mob-row-pad-y) 12px;
  min-height: var(--mob-row-min);
  border-top: 1px solid var(--line);
  box-sizing: border-box;
}
.mob-sheet-line:first-child { border-top: none; }

.mob-sheet-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.mob-sheet-cell { flex: 1; }
.mob-sheet-label {
  flex: none;
  width: 96px;
  font-size: 13px;
  line-height: var(--mob-label-lh, 13px);
  color: var(--mut);
}

.mob-sheet-value {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  font-size: 16px;
  font-variant-numeric: tabular-nums;
}
.mob-sheet-value :deep(input) {
  flex: 1 1 auto;
  min-width: 0;
  min-height: var(--mob-input-h);
  padding: 2px 6px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #fff;
  color: var(--fg);
  font: inherit;
}
.mob-sheet-value :deep(input:focus) { border-color: var(--acc); outline: none; }
.mob-sheet-cell :deep(.mob-sheet-unit) {
  flex: none;
  min-width: 26px;
  font-size: 13px;
  color: var(--mut);
  white-space: nowrap;
}

.mob-sheet-foot {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 8px 12px;
  border-top: 1px solid var(--line);
}
.mob-sheet-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}
.mob-sheet-btn {
  min-height: 40px;
  padding: 0 16px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: #fff;
  color: var(--fg);
  font: inherit;
  font-size: 15px;
  cursor: pointer;
}
.mob-sheet-close {
  background: var(--acc, #36c);
  border-color: var(--acc, #36c);
  color: #fff;
}
</style>
