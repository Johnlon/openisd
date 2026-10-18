<script setup lang="ts">
import type {PickWidth} from '@openisd/design/fields';
/** A field row for a control that is not a number: a pick list or a text box. It is laid out as a
 *  `UIFieldBody` row is (label column, then the control), so every row on a screen starts its label
 *  and its control at the same x and is as tall as a number box. The control is the default slot. */
const props = defineProps<{
  label: string;
  /** The id of the control in the slot; the label is tied to it. */
  inputId: string;
  /** How wide the control is on the desktop; the phone's row sizes its own and passes none. */
  width?: PickWidth;
}>();
</script>

<template>
  <div class="ui-field ui-pick-field" :style="{'--pick-width': props.width?.css}">
    <label class="ui-field-label" :for="inputId">{{ label }}</label>
    <span class="ui-field-value"><slot /></span>
    <span v-if="$slots.cue" class="ui-field-dev"><slot name="cue" /></span>
  </div>
</template>

<style scoped>
.ui-pick-field:not(.mob-ui-field) {
  display: grid;
  grid-template-columns: var(--label-w, var(--ctl-label-w)) var(--pick-width, max-content) 16px;
  column-gap: 4px;
  align-items: center;
}
.ui-pick-field > label { grid-column: 1; white-space: nowrap; }
.ui-pick-field .ui-field-value { grid-column: 2; display: inline-flex; align-items: center; }
.ui-pick-field:not(.mob-ui-field) :deep(select), .ui-pick-field:not(.mob-ui-field) :deep(input) { width: 100%; }
.ui-pick-field:not(.mob-ui-field) :deep(select), .ui-pick-field:not(.mob-ui-field) :deep(input) { height: var(--ctl-h); box-sizing: border-box; }
.ui-pick-field .ui-field-dev { grid-column: 3; }
</style>
