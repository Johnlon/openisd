<script setup lang="ts">
// One bottom sheet on the mobile Graph page, Tune or What-if (each its own sheet, with its own
// fields): a pull-tab when closed, a resizable sheet of rows when open. Its band (name and ?) is
// the drag handle. Behaviour lives in MobileSheet-hooks.ts.
import NumInput from '../../components/NumInput.vue';
import VentPortFields from '../../components/VentPortFields.vue';
import UnitToggle from '../../components/UnitToggle.vue';
import PhoneBand from './PhoneBand.vue';
import PhoneButton from './PhoneButton.vue';
import { useMobileSheet } from '../../../hooks/MobileSheet-hooks.js';
import { SheetMode } from '@openisd/design/fields';
import { inputChecked } from '../../../logic/domEvents.js';

const props = defineProps<{ open: boolean; mode: SheetMode; hidden: boolean; autoY: boolean }>();
const emit = defineEmits<{ 'update:open': [open: boolean]; 'update:autoY': [on: boolean] }>();

const { isOpen, lines, rowSlots, mode, help, sizeStyle, portEditor, portView, portValuePress, closePortEditor, sheetEl, sheetStyle, setValue, openSheet, close, reset,
  onTabDown, onTabUp, onHandleDown, onHandleMove, onHandleUp } =
  useMobileSheet({ open: () => props.open, setOpen: v => emit('update:open', v), mode: props.mode });
</script>

<template>
  <PhoneButton v-if="!isOpen && !hidden" class="mob-sheet-tab" :style="sizeStyle" :aria-label="'Open ' + mode.label"
               @pointerdown="onTabDown" @pointerup="onTabUp" @click="openSheet">{{ mode.label }} ▲</PhoneButton>
  <section v-else-if="isOpen" ref="sheetEl" class="mob-sheet mob-classic" :style="[sizeStyle, sheetStyle]" :aria-label="mode.label">
    <div class="mob-sheet-handle" role="separator" aria-label="Drag to resize"
         @pointerdown="onHandleDown" @pointermove="onHandleMove" @pointerup="onHandleUp" @pointercancel="onHandleUp">
      <PhoneBand :section="help" />
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
        <PhoneButton primary class="mob-sheet-btn mob-sheet-close" @click="closePortEditor">Close</PhoneButton>
      </div>
      <div class="mob-sheet-port-body"><VentPortFields v-if="portView !== null" :port="portView" /></div>
    </div>
    <div class="mob-sheet-foot">
      <label class="mob-sheet-autoy" :title="SheetMode.AUTO_Y_TITLE">
        <input type="checkbox" :checked="autoY" @change="emit('update:autoY', inputChecked($event))">{{ SheetMode.AUTO_Y_LABEL }}
      </label>
      <div class="mob-sheet-actions">
        <PhoneButton v-if="mode.edits === 'whatIfLayer'" class="mob-sheet-btn" title="Back to the design's values" @click="reset">Reset</PhoneButton>
        <PhoneButton primary class="mob-sheet-btn mob-sheet-close" :title="mode.edits === 'whatIfLayer' ? 'Close. The design is not changed.' : 'Close'" @click="close">Close</PhoneButton>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Sizes: ChartPageSizes (--gp-*, set on the chart view) and PhoneRowSizes.CLASSIC (--mob-*, set on the sheet). */
.mob-sheet-tab {
  /* The one phone button (PhoneButton), plain grey; only its drag behaviour is its own. */
  min-width: 0;
  font-size: 15px;
  font-weight: 600;
  touch-action: none;
}
.mob-sheet {
  /* Its rows give way and scroll once it is taller than the cap; it shrinks before the chart does (120 px). */
  flex: 1 1 0;
  min-width: 0;
  height: auto;
  max-height: var(--gp-sheet-max);
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: #fff;
  border-top: 2px solid var(--acc);
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
.mob-sheet-port-head .mob-sheet-btn { flex: none; }
.mob-sheet-port-title { font-weight: 600; font-size: 15px; }
.mob-sheet-port-body { flex: 1; min-height: 0; overflow-y: auto; }
/* The band is the handle: drag it to resize the sheet, tap its ? for help. */
.mob-sheet-handle { flex: none; touch-action: none; cursor: ns-resize; }
.mob-sheet-handle :deep(.mob-band) { height: var(--gp-sheet-band); margin-top: 0; }

.mob-sheet-rows {
  /* The rows take their own height; when the screen is too short they give way and scroll. */
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}
.mob-sheet-line {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  height: var(--mob-row-min);
  padding: 0 16px;
  border-bottom: 1px solid #e6e6e6;
}
.mob-sheet-line:last-child { border-bottom: none; }

.mob-sheet-cell {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}
.mob-sheet-label {
  flex: none;
  box-sizing: border-box;
  width: var(--mob-label-w);
  padding-right: 8px;
  font-size: 14px;
  line-height: var(--mob-label-lh);
  color: #555;
}

.mob-sheet-value {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  font-size: 15px;
  font-variant-numeric: tabular-nums;
}
.mob-sheet-value :deep(.num-input-wrap) { flex: 1 1 auto; width: 0; min-width: 0; }
.mob-sheet-value :deep(.num-stepper) { flex: none; margin-left: 6px !important; gap: 4px; }
.mob-sheet-value :deep(.num-stepper-btn) {
  width: var(--mob-stepper-w) !important;
  min-width: var(--mob-stepper-w);
  height: var(--mob-input-h) !important;
  padding: 0;
  border: 1px solid #999;
  border-radius: 6px;
  background: linear-gradient(#fdfdfd, #e2e2e2);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  font-size: 18px !important;
  line-height: 1;
  color: #222;
}
.mob-sheet-value :deep(input) {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  height: var(--mob-input-h);
  padding: 0 46px 0 14px;
  border: 1px solid #c4c4c4;
  border-radius: 4px;
  background: #fff;
  color: var(--fg);
  font: inherit;
}
.mob-sheet-value :deep(input:focus) { border: 2px solid var(--acc); outline: none; }
/* The unit sits inside the box's right edge, left of the ▲▼ pair (two buttons, a 4 px gap, a 6 px margin). */
.mob-sheet-cell :deep(.mob-sheet-unit) {
  position: absolute;
  top: 1px;
  bottom: 1px;
  right: calc(var(--mob-stepper-w) * 2 + 10px + 1px);
  box-sizing: border-box;
  min-width: var(--mob-stepper-w);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
/* The unit's look (chip) is drawn by UnitToggle, the same for fixed and rotating units. */

.mob-sheet-foot {
  flex: none;
  display: flex;
  align-items: center;
  padding: 4px 16px;
  border-top: 1px solid var(--line);
  background: var(--panel);
}
.mob-sheet-foot { gap: 8px; }
/* Auto Y: a 44 px tall tap row at the footer's left (QO267 mock .gsf .ay). */
.mob-sheet-autoy { flex: none; display: inline-flex; align-items: center; gap: 8px; min-height: 44px; font-size: 15px; color: var(--fg); cursor: pointer; user-select: none; }
.mob-sheet-autoy input { margin: 0; width: 22px; height: 22px; }
.mob-sheet-actions { display: flex; flex: 1; gap: 8px; align-items: center; justify-content: flex-end; }
.mob-sheet-btn {
  /* The one phone button (PhoneButton); Close is the primary. */
  min-width: 0;
  padding: 0 12px;
  font-size: 15px;
}
</style>
