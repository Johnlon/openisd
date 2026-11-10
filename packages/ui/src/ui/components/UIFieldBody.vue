<script setup lang="ts">
/**
 * ONE NUMBER FIELD: LABEL | VALUE | DQ | UNIT, bound to a domain cell (`UIField` or `UIFixedField`, one per `UIBinding` kind).
 *
 * Every part's behaviour lives here, so a field behaves the same in every view:
 * - LABEL is the field's registry label; hovering it gives the registry description.
 * - VALUE is a fixed-width box coloured by provenance (entered / calculated / none). A number
 *   writes `cell.set(v, precision)`; an emptied box writes `cell.clear()`, never 0.
 * - DQ is a ⚠ button when the cell carries flags. A tap or click opens the reason as a popup
 *   under the glyph, out of the grid; a `title` alone is never shown on a touch screen.
 * - UNIT is the field's unit toggle, in a fixed-width slot that is kept even when empty.
 *
 * The root is a 4-track grid. A parent grid can make it `subgrid` so every field in a column
 * shares one label edge, one value edge and one unit edge.
 * bugs/BUG_20261005_no-common-ui-field-component.md
 */
import {computed, onBeforeUnmount, ref, useId, watch} from 'vue';
import {NumberEditor, PhoneRowColumns} from '@openisd/design/fields';
import NumInput from './NumInput.vue';
import {selectedOption} from '../../logic/domEvents.js';
import NumReadout from './NumReadout.vue';
import UnitToggle from './UnitToggle.vue';
import WinisdDeviationCue from './WinisdDeviationCue.vue';
import {useCellScope} from './cellScope.js';
import type {UIBinding, UIFieldCommon} from './uiFieldBinding.js';
import {CellClass, cellClassOf} from '../../logic/driverCells.js';
import {dqOfCell, dqReason} from '../../logic/cellDataQuality.js';
import {useFieldNotePlacement} from '../../hooks/useFieldNotePlacement.js';

const props = withDefaults(defineProps<UIFieldCommon & {binding: UIBinding}>(), {
  required: false,
  inputId: undefined,
  min: undefined,
  max: undefined,
  stepper: true,
  spin: undefined,
  readonly: false,
  plain: false,
  label: undefined,
  deviation: undefined,
  dq: undefined,
  noteTone: undefined,
  dqState: undefined,
  allowOutOfRange: false,
  defaulted: undefined,
});

const scope = useCellScope();
const generatedId = useId();
/** The row's column widths as CSS variables, from the design constant. The label column is the page's (it follows the page's longest label). */
const columnVars = Object.fromEntries([...PhoneRowColumns.STANDARD.cssVars()].filter(([name]) => name !== PhoneRowColumns.LABEL_COLUMN_VAR));
const id = computed(() => props.inputId ?? generatedId);

/** The cell read once per change of the hosting view: Vue cannot see the cell itself change. */
const view = computed(() => {
  void scope.revision.value;
  const binding = props.binding;
  switch (binding.kind) {
    case 'fixed':
    case 'settling': {
      const dq = props.dq ?? [];
      const hasDq = dq.length > 0;
      return {
        value: binding.cell.value, precision: null, provenanceClass: props.defaulted === true ? CellClass.Calculated : CellClass.Entered, mandatory: false,
        reason: hasDq ? dqReason({dq, dqState: props.dqState ?? 'N'}) : '',
        dqClasses: {'dq-flag': hasDq, 'dq-root': hasDq && props.dqState === 'E', 'dq-symptom': hasDq && props.dqState === 'C'},
      };
    }
    case 'clearable': {
      const cell = binding.cell;
      const readout = dqOfCell(cell);
      const dq = [...readout.dq, ...(props.dq ?? [])];
      const dqState = props.dqState ?? readout.dqState;
      return {
        value: cell.value,
        precision: cell.precision,
        provenanceClass: cellClassOf(cell),
        mandatory: props.required || cell.mandatoryAndUnsatisfied,
        reason: dqReason({dq, dqState}),
        dqClasses: {
          'dq-flag': dq.length > 0,
          'dq-root': dq.length > 0 && dqState === 'E',
          'dq-symptom': dq.length > 0 && dqState === 'C',
        },
      };
    }
    default: { const unhandled: never = binding; return unhandled; }
  }
});

/** Whether the popup is shown: a click on the glyph toggles it, a new refusal opens it; a click
 *  outside, Esc and a cleared refusal close it, so it can always be dismissed. */
const reasonOpen = ref(false);
const root = ref<HTMLElement | null>(null);
const noteEl = ref<HTMLElement | null>(null);
/** Inline offsets that keep the popup inside the window. */
const noteStyle = useFieldNotePlacement(root, noteEl, reasonOpen);
/** What is wrong with the text in the box, from the box itself; '' when it may be stored. A
 *  refused entry was never stored, so the cell's own DQ cannot know about it. */
const refusal = ref('');
/** The ⚠ sentence: a refused entry first, since it is what the person is looking at. */
const reason = computed(() => refusal.value !== '' ? refusal.value : view.value.reason);

watch(refusal, text => { reasonOpen.value = text !== ''; });

function closeOnOutsideClick(event: MouseEvent): void {
  if (event.target instanceof Node && root.value?.contains(event.target) === true) return;
  reasonOpen.value = false;
}
/** Focus leaving the field (box, glyph or popup) closes the popup (John, 8 Nov, QO462). */
function closeOnFocusLeave(event: FocusEvent): void {
  if (event.relatedTarget instanceof Node && root.value?.contains(event.relatedTarget) === true) return;
  reasonOpen.value = false;
}
function closeOnEscape(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return;
  // Esc dismisses only the popup: the dialog behind it stays open.
  if (refusal.value === '') event.stopPropagation();
  reasonOpen.value = false;
}
watch(reasonOpen, open => {
  if (open) {
    document.addEventListener('click', closeOnOutsideClick, true);
    document.addEventListener('keydown', closeOnEscape, true);
  } else {
    document.removeEventListener('click', closeOnOutsideClick, true);
    document.removeEventListener('keydown', closeOnEscape, true);
  }
});
onBeforeUnmount(() => {
  document.removeEventListener('click', closeOnOutsideClick, true);
  document.removeEventListener('keydown', closeOnEscape, true);
});

function write(v: number | null, precision?: number): void {
  const binding = props.binding;
  switch (binding.kind) {
    case 'fixed':
      if (v === null) return;   // the box shows the refusal; nothing is stored
      binding.cell.set(v);
      break;
    case 'clearable':
      if (v === null) binding.cell.clear(); else binding.cell.set(v, precision);
      break;
    case 'settling':
      if (v === null) binding.cell.clear(); else binding.cell.set(v);
      break;
    default: { const unhandled: never = binding; return unhandled; }
  }
  scope.written();
}
</script>

<template>
  <div ref="root" @focusout="closeOnFocusLeave" :data-field="field.value" :data-access="readonly ? 'readonly' : 'writable'" :style="columnVars" :class="['ui-field', {'ui-field-readout': readonly, 'ui-field-defaulted': defaulted === true, 'ui-field-stored': defaulted === false}]">
    <label class="ui-field-label" :for="id" :title="field.description || undefined">{{ label ?? field.label }}</label>
    <span class="ui-field-dq">
      <button v-if="reason" type="button" class="ui-field-dq-btn" :title="reason" :aria-expanded="reasonOpen"
        aria-label="Why this value is flagged" @click.stop="reasonOpen = !reasonOpen">&#9888;</button>
    </span>
    <span class="ui-field-value">
      <slot name="value" :view="view" :id="id" :write="write" :refusal="refusal" :set-refusal="(text: string) => refusal = text">
        <NumReadout v-if="readonly" :id="id" :class="['calculated', 'greyed', view.dqClasses]" :value="view.value" :field="field" :format="format" />
        <select v-else-if="field.editor === NumberEditor.CountSelect" :id="id" :value="view.value"
          @change="event => { const value = selectedOption(event, field.countOptions()); if (value !== null) write(value); }">
          <option v-for="option in field.countOptions()" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
        <NumInput v-else :id="id" :class="[view.provenanceClass, view.dqClasses]" :model-value="view.value" :field="field"
          :half-width="view.precision" :mandatory="view.mandatory" :min="min" :max="max" :allow-out-of-range="allowOutOfRange" :stepper="stepper" :spin="spin" :blank-refused="binding.kind === 'fixed'"
          @update:model-value="write" @refusal="text => refusal = text">
          <template #unit><UnitToggle :field="field" unit-class="ui-field-unit" /></template>
        </NumInput>
      </slot>
    </span>
    <UnitToggle v-if="readonly || field.editor === NumberEditor.CountSelect || $slots.value" :field="field" unit-class="ui-field-unit" />
    <span v-if="deviation" class="ui-field-dev">
      <WinisdDeviationCue :deviation="deviation" />
    </span>
    <span v-if="reasonOpen && reason" ref="noteEl" :style="noteStyle" :class="['ui-field-note', {'ui-field-note-warning': noteTone === 'warning'}]" role="note">{{ reason }}</span>
  </div>
</template>

<style scoped>
.ui-field {
  /* The box, its gap and the ▲▼ pair. */
  --stepper-w: var(--ctl-stepper-w, 14px);
  --stepper-h: var(--ctl-h, 20px);
  --ui-field-column-gap: 4px;
  --ui-value-w: calc(90px + 2px + 2 * var(--stepper-w));
  display: grid;
  grid-template-columns: var(--label-w, var(--ctl-label-w, 150px)) var(--ui-value-w) minmax(34px, max-content) 16px minmax(16px, max-content);
  column-gap: var(--ui-field-column-gap);
  align-items: center;
  position: relative; flex: none;
}
.ui-field-readout { grid-template-columns: var(--label-w, var(--ctl-label-w, 150px)) 90px minmax(34px, max-content) 16px minmax(16px, max-content); }
.ui-field-readout { padding-bottom: 1px; }
.ui-field-readout .ui-field-value { width: 90px; }
/* A switchable readout unit is part of the same control, with no white gutter between the value
   and its unit chip. The unit component owns the grey background and border. */
.ui-field > :deep(.ui-field-unit.unit-toggle) { margin-left: calc(-1 * var(--ui-field-column-gap)); border-left: 0; height: var(--ctl-h); }
.ui-field > label { grid-column: 1; white-space: nowrap; }
.ui-field-value { display: inline-flex; align-items: center; gap: 2px; width: var(--ui-value-w); flex: none; grid-column: 2; }
/* FIXED width, the same in every unit: the box never resizes when its unit is cycled. Wide
   enough for the longest value any field shows in any unit (a Vas in cu in, a Vd in cu ft). */
.ui-field-value :deep(input) {
  width: 90px; height: var(--ctl-h); box-sizing: border-box;
  border: 1px solid var(--line); border-radius: 2px; padding: 4px 3px;
  background: #fff; font: inherit; text-align: left;
}
.ui-field-value :deep(.num-stepper) { margin-left: 0; }
.ui-field-value :deep(input.calculated) { color: var(--acc); }
.ui-field-value :deep(input.greyed) { background: #e9e9e9; }
.ui-field-dq { display: inline-flex; justify-content: center; width: 16px; flex: none; grid-column: 4; }
.ui-field-dev { display: inline-flex; justify-content: center; min-width: 16px; width: auto; flex: none; grid-column: 5; }
.ui-field-dq-btn {
  border: none; background: none; padding: 0 2px; margin: 0;
  font-family: inherit; font-size: 15px; line-height: 1; color: #d68a00; cursor: help;
}
.ui-field-unit { flex: none; 
  grid-column: 3; justify-self: start; width: max-content; min-width: 34px; box-sizing: border-box;
  white-space: nowrap; text-align: left;
}
/* A popup under the glyph's row, out of the grid: it takes no space, so a note can never change a
   row's height or push a box (John, 8 Nov 2026: "Use a popup every where instead of this"). */
.ui-field-note {
  position: absolute; top: 100%; left: 0; z-index: 20; margin-top: 2px;
  width: max-content; max-width: min(320px, 90vw); box-sizing: border-box;
  white-space: normal; overflow-wrap: anywhere; box-shadow: 0 2px 8px rgb(0 0 0 / 25%);
  padding: 4px 6px; border: 1px solid var(--bad); border-radius: 4px;
  background: var(--panel); color: var(--fg); font-size: 11px; line-height: 1.3;
}
.ui-field-note-warning { border-color: var(--acc2); background: color-mix(in srgb, var(--acc2) 8%, var(--panel)); }
</style>
