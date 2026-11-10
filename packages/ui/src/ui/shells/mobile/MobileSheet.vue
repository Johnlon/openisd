<script setup lang="ts">
// One bottom sheet on the mobile Graph page, Tune or What-if (each its own sheet, with its own
// fields): a pull-tab when closed, a resizable sheet of rows when open. Its band (name and ?) is
// the drag handle. Behaviour lives in MobileSheet-hooks.ts.
import UIFixedField from '../../components/UIFixedField.vue';
import VentPortFields from '../../components/VentPortFields.vue';
import PhoneBand from './PhoneBand.vue';
import PhoneButton from './PhoneButton.vue';
import { useMobileSheet } from '../../../hooks/MobileSheet-hooks.js';
import { SheetMode } from '@openisd/design/fields';
import { inputChecked } from '../../../logic/domEvents.js';
import { createPhoneLabelColumnDirective } from '../../../hooks/phoneLabelColumnDirective.js';
const vPhoneLabelColumn = createPhoneLabelColumnDirective();

const props = defineProps<{ open: boolean; mode: SheetMode; hidden: boolean; autoY: boolean }>();
const emit = defineEmits<{ 'update:open': [open: boolean]; 'update:autoY': [on: boolean] }>();

const { isOpen, lines, rowSlots, mode, help, sizeStyle, portEditor, portView, portValuePress, closePortEditor, sheetEl, rowsEl, sheetStyle, setValue, openSheet, close, reset,
  onTabDown, onTabUp, onHandleDown, onHandleMove, onHandleUp } =
  useMobileSheet({ open: () => props.open, setOpen: v => emit('update:open', v), mode: props.mode });
</script>

<template>
  <PhoneButton v-if="!isOpen && !hidden" class="mob-sheet-tab" :style="sizeStyle" :aria-label="'Open ' + mode.label"
               @pointerdown="onTabDown" @pointerup="onTabUp" @click="openSheet">{{ mode.label }} ▲</PhoneButton>
  <section v-else-if="isOpen" ref="sheetEl" v-phone-label-column class="mob-sheet mob-classic" :style="[sizeStyle, sheetStyle]" :aria-label="mode.label">
    <div class="mob-sheet-handle" role="separator" aria-label="Drag to resize"
         @pointerdown="onHandleDown" @pointermove="onHandleMove" @pointerup="onHandleUp" @pointercancel="onHandleUp">
      <PhoneBand :section="help" />
    </div>
    <div ref="rowsEl" class="mob-sheet-rows" :style="{ '--mob-row-slots': rowSlots }">
      <div v-for="(line, lineIdx) in lines" :key="lineIdx" class="mob-sheet-line">
        <UIFixedField v-for="cell in line" :key="cell.field.label" class="mob-ui-field" :field="cell.field.field" :label="mode.labelOf(cell.field)" :value="cell.value" stepper
                      @pointerdown="portValuePress($event, cell)" @mousedown="portValuePress($event, cell)" @click="portValuePress($event, cell)"
                      @update:value="(v: number) => setValue(cell.field, v)" />
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
        <PhoneButton primary class="mob-sheet-btn mob-sheet-close" :title="mode.edits === 'whatIfLayer' ? 'Close. Your project will not be updated.' : 'Close'" @click="close">Close</PhoneButton>
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
