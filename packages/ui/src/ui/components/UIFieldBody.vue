<script setup lang="ts">
/**
 * ONE NUMBER FIELD: LABEL | VALUE | DQ | UNIT, bound to a domain cell (`UIField` or `UIFixedField`, one per `UIBinding` kind).
 *
 * Every part's behaviour lives here, so a field behaves the same in every view:
 * - LABEL is the field's registry label; hovering it gives the registry description.
 * - VALUE is a fixed-width box coloured by provenance (entered / calculated / none). A number
 *   writes `cell.set(v, precision)`; an emptied box writes `cell.clear()`, never 0.
 * - DQ is a ⚠ button when the cell carries flags. A tap or click opens the reason under the
 *   field; a `title` alone is never shown on a touch screen.
 * - UNIT is the field's unit toggle, in a fixed-width slot that is kept even when empty.
 *
 * The root is a 4-track grid. A parent grid can make it `subgrid` so every field in a column
 * shares one label edge, one value edge and one unit edge.
 * bugs/BUG_20261005_no-common-ui-field-component.md
 */
import {computed, ref, useId} from 'vue';
import NumInput from './NumInput.vue';
import NumReadout from './NumReadout.vue';
import UnitToggle from './UnitToggle.vue';
import WinisdDeviationCue from './WinisdDeviationCue.vue';
import {useCellScope} from './cellScope.js';
import type {UIBinding, UIFieldCommon} from './uiFieldBinding.js';
import {CellClass, cellClassOf} from '../../logic/driverCells.js';
import {dqOfCell, dqReason} from '../../logic/cellDataQuality.js';

const props = withDefaults(defineProps<UIFieldCommon & {binding: UIBinding}>(), {
  required: false,
  inputId: undefined,
  max: undefined,
  stepper: true,
  readonly: false,
  plain: false,
  label: undefined,
  deviation: undefined,
  dq: undefined,
  dqState: undefined,
  allowOutOfRange: false,
  defaulted: undefined,
});

const scope = useCellScope();
const generatedId = useId();
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
      return {
        value: cell.value,
        precision: cell.precision,
        provenanceClass: cellClassOf(cell),
        mandatory: props.required || cell.mandatoryAndUnsatisfied,
        reason: dqReason(readout),
        dqClasses: {
          'dq-flag': readout.dq.length > 0,
          'dq-root': readout.dq.length > 0 && readout.dqState === 'E',
          'dq-symptom': readout.dq.length > 0 && readout.dqState === 'C',
        },
      };
    }
    default: { const unhandled: never = binding; return unhandled; }
  }
});

const reasonOpen = ref(false);
/** What is wrong with the text in the box, from the box itself; '' when it may be stored. A
 *  refused entry was never stored, so the cell's own DQ cannot know about it. */
const refusal = ref('');
/** The ⚠ sentence: a refused entry first, since it is what the person is looking at. */
const reason = computed(() => refusal.value !== '' ? refusal.value : view.value.reason);

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
  <div :class="['ui-field', {'ui-field-readout': readonly, 'ui-field-defaulted': defaulted === true, 'ui-field-stored': defaulted === false}]">
    <label class="ui-field-label" :for="id" :title="field.description || undefined">{{ label ?? field.label }}</label>
    <span class="ui-field-value">
      <slot name="value" :view="view" :id="id" :write="write" :refusal="refusal" :set-refusal="(text: string) => refusal = text">
        <NumReadout v-if="readonly" :id="id" :class="['calculated', 'greyed', view.dqClasses, {'mob-readonly': plain}]" :value="view.value" :field="field" :as-input="!plain" />
        <NumInput v-else :id="id" :class="[view.provenanceClass, view.dqClasses]" :model-value="view.value" :field="field"
          :half-width="view.precision" :mandatory="view.mandatory" :max="max" :allow-out-of-range="allowOutOfRange" :stepper="stepper" :blank-refused="binding.kind === 'fixed'" hide-mark
          @update:model-value="write" @refusal="text => refusal = text" />
      </slot>
    </span>
    <UnitToggle :field="field" unit-class="ui-field-unit" />
    <span class="ui-field-dq">
      <button v-if="reason" type="button" class="ui-field-dq-btn" :title="reason" :aria-expanded="reasonOpen"
        aria-label="Why this value is flagged" @click.stop="reasonOpen = !reasonOpen">&#9888;</button>
    </span>
    <span v-if="deviation" class="ui-field-dev">
      <WinisdDeviationCue :deviation="deviation" />
    </span>
    <span v-if="(reasonOpen || refusal !== '') && reason" class="ui-field-note" role="note" @click.stop="reasonOpen = false">{{ reason }}</span>
  </div>
</template>

<style scoped>
.ui-field {
  /* The box, its gap and the ▲▼ pair. */
  --ui-value-w: calc(90px + 2px + 2 * var(--ctl-stepper-w, 14px));
  display: grid;
  grid-template-columns: var(--label-w, var(--ctl-label-w, 150px)) var(--ui-value-w) 34px 16px 16px;
  column-gap: 4px;
  align-items: baseline;
  position: relative; flex: none;
}
.ui-field-readout { grid-template-columns: var(--label-w, var(--ctl-label-w, 150px)) 90px 34px 16px 16px; }
.ui-field-readout .ui-field-value { width: 90px; }
.ui-field > label { grid-column: 1; white-space: nowrap; }
.ui-field-value { display: inline-flex; align-items: center; gap: 2px; width: var(--ui-value-w); flex: none; grid-column: 2; }
/* FIXED width, the same in every unit: the box never resizes when its unit is cycled. Wide
   enough for the longest value any field shows in any unit (a Vas in cu in, a Vd in cu ft). */
.ui-field-value :deep(input) { width: 90px; height: var(--ctl-h); box-sizing: border-box; }
.ui-field-dq { display: inline-flex; justify-content: center; width: 16px; flex: none; grid-column: 4; }
.ui-field-dev { display: inline-flex; justify-content: center; width: 16px; flex: none; grid-column: 5; }
.ui-field-dq-btn {
  border: none; background: none; padding: 0 2px; margin: 0;
  font-family: inherit; font-size: 15px; line-height: 1; color: #d68a00; cursor: help;
}
.ui-field-unit { flex: none; 
  grid-column: 3; width: 34px; box-sizing: border-box;
  color: var(--mut); white-space: nowrap; text-align: left;
}
/* Under the field's own row, in the layout: it takes its own space and never covers the row below. */
.ui-field-note {
  grid-column: 1 / -1; margin-top: 2px;
  white-space: normal; overflow-wrap: anywhere;
  padding: 4px 6px; border: 1px solid var(--bad); border-radius: 4px;
  background: var(--panel); color: var(--fg); font-size: 11px; line-height: 1.3;
}
</style>
