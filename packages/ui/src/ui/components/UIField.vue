<script setup lang="ts">
/**
 * ONE NUMBER FIELD: LABEL | VALUE | DQ | UNIT, bound to a domain cell.
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
import type {Clearable, Precise, Readable, Writable} from '@openisd/design';
import type {NumberField} from '@openisd/design/fields';
import NumInput from './NumInput.vue';
import UnitToggle from './UnitToggle.vue';
import {useCellScope} from './cellScope.js';
import {cellClassOf} from '../../logic/driverCells.js';
import {dqOfCell, dqReason} from '../../logic/cellDataQuality.js';

/** What a `UIField` reads and writes: a number a person can enter, clear and state the precision of. */
export type UICell = Readable<number | null> & Precise & Writable<number> & Clearable;

const props = withDefaults(defineProps<{
  field: NumberField;
  cell: UICell;
  /** Always drawn as mandatory. Otherwise mandatory only while the cell is needed and empty. */
  required?: boolean;
  /** The input's id, for a view or test that addresses the box directly. */
  inputId?: string;
  /** An upper bound tighter than the registry's, in SI. */
  max?: number;
  /** ▲▼ buttons beside the box (the phone layout). */
  stepper?: boolean;
  /** Shown but not editable, e.g. a value another field is deriving. */
  readonly?: boolean;
}>(), {
  required: false,
  inputId: undefined,
  max: undefined,
  stepper: false,
  readonly: false,
});

const scope = useCellScope();
const generatedId = useId();
const id = computed(() => props.inputId ?? generatedId);

/** The cell read once per change of the hosting view: Vue cannot see the cell itself change. */
const view = computed(() => {
  void scope.revision.value;
  const cell = props.cell;
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
});

const reasonOpen = ref(false);
/** What is wrong with the text in the box, from the box itself; '' when it may be stored. A
 *  refused entry was never stored, so the cell's own DQ cannot know about it. */
const refusal = ref('');
/** The ⚠ sentence: a refused entry first, since it is what the person is looking at. */
const reason = computed(() => refusal.value !== '' ? refusal.value : view.value.reason);

function write(v: number | null, precision?: number): void {
  if (v === null) props.cell.clear(); else props.cell.set(v, precision);
  scope.written();
}
</script>

<template>
  <div class="ui-field">
    <label class="ui-field-label" :for="id" :title="field.description || undefined">{{ field.label }}</label>
    <span class="ui-field-value">
      <NumInput :id="id" :class="[view.provenanceClass, view.dqClasses]" :model-value="view.value" :field="field"
        :half-width="view.precision" :mandatory="view.mandatory" :max="max" :stepper="stepper" :readonly="readonly" hide-mark
        @update:model-value="write" @refusal="text => refusal = text" />
    </span>
    <span class="ui-field-dq">
      <button v-if="reason" type="button" class="ui-field-dq-btn" :title="reason" :aria-expanded="reasonOpen"
        aria-label="Why this value is flagged" @click.stop="reasonOpen = !reasonOpen">&#9888;</button>
    </span>
    <UnitToggle :field="field" unit-class="ui-field-unit" />
    <span v-if="(reasonOpen || refusal !== '') && reason" class="ui-field-note" role="note" @click.stop="reasonOpen = false">{{ reason }}</span>
  </div>
</template>

<style scoped>
.ui-field {
  display: grid;
  grid-template-columns: max-content max-content 16px 34px;
  column-gap: 4px;
  align-items: center;
  position: relative;
}
.ui-field > label { grid-column: 1; white-space: nowrap; }
.ui-field-value { grid-column: 2; display: inline-flex; align-items: center; gap: 2px; }
/* FIXED width, the same in every unit: the box never resizes when its unit is cycled. Wide
   enough for the longest value any field shows in any unit (a Vas in cu in, a Vd in cu ft). */
.ui-field-value :deep(input) { width: 90px; box-sizing: border-box; }
.ui-field-dq { grid-column: 3; display: inline-flex; justify-content: center; }
.ui-field-dq-btn {
  border: none; background: none; padding: 0 2px; margin: 0;
  font: inherit; font-size: 12px; line-height: 1; color: #d68a00; cursor: help;
}
.ui-field-unit {
  grid-column: 4; width: 34px; box-sizing: border-box;
  font-size: 11px; color: var(--mut); white-space: nowrap; text-align: left;
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
