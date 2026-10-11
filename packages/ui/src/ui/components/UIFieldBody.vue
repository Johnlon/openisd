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
  stepper: false,
  readonly: false,
  deviation: undefined,
  dq: undefined,
});

const scope = useCellScope();
const generatedId = useId();
const id = computed(() => props.inputId ?? generatedId);

/** The cell read once per change of the hosting view: Vue cannot see the cell itself change. */
const view = computed(() => {
  void scope.revision.value;
  const binding = props.binding;
  switch (binding.kind) {
    case 'fixed': {
      const hasDq = props.dq && props.dq.length > 0;
      return {
        value: binding.cell.value, precision: null, provenanceClass: CellClass.Entered, mandatory: false, reason: hasDq ? props.dq!.join('; ') : '',
        dqClasses: {'dq-flag': hasDq || false, 'dq-root': false, 'dq-symptom': false},
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
    default: { const unhandled: never = binding; return unhandled; }
  }
  scope.written();
}
</script>

<template>
  <div class="ui-field">
    <label class="ui-field-label" :for="id" :title="field.description || undefined">{{ field.label }}</label>
    <span class="ui-field-value">
      <slot name="value" :view="view" :id="id" :write="write" :refusal="refusal" :set-refusal="(text: string) => refusal = text">
        <NumInput :id="id" :class="[view.provenanceClass, view.dqClasses]" :model-value="view.value" :field="field"
          :half-width="view.precision" :mandatory="view.mandatory" :max="max" :stepper="stepper" :readonly="readonly" :blank-refused="binding.kind === 'fixed'" hide-mark
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
  display: grid;
  grid-template-columns: var(--label-w, 150px) 90px 34px 16px 16px;
  column-gap: 4px;
  align-items: baseline;
  position: relative; flex: none;
}
.ui-field > label { grid-column: 1; white-space: nowrap; }
.ui-field-value { display: inline-flex; align-items: center; gap: 2px; width: 90px; flex: none; grid-column: 2; }
/* FIXED width, the same in every unit: the box never resizes when its unit is cycled. Wide
   enough for the longest value any field shows in any unit (a Vas in cu in, a Vd in cu ft). */
.ui-field-value :deep(input) { width: 90px; box-sizing: border-box; }
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
/* Under the whole field row, not under the ⚠, so on a phone it never runs off the left edge. */
.ui-field-note {
  position: absolute; z-index: 20; top: 100%; left: 0; right: 0; margin-top: 2px;
  white-space: normal; overflow-wrap: anywhere;
  padding: 4px 6px; border: 1px solid var(--bad); border-radius: 4px;
  background: var(--panel); color: var(--fg); font-size: 11px; line-height: 1.3;
  box-shadow: 0 2px 6px rgb(0 0 0 / 0.2);
}
</style>
