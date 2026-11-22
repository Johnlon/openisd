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
  /** The control takes the common number field's value width and left edge, so it lines up with the count beside it. */
  common?: boolean;
}>();
</script>

<template>
  <div class="ui-field ui-pick-field" :class="{'ui-pick-common': common}" :style="{'--pick-width': props.width?.css}">
    <label class="ui-field-label" :for="inputId">{{ label }}</label>
    <span class="ui-field-value"><slot /></span>
    <span v-if="$slots.dq" class="ui-field-dq"><slot name="dq" /></span>
    <slot name="unit" />
    <span v-if="$slots.cue" class="ui-field-dev"><slot name="cue" /></span>
  </div>
</template>

<style scoped>
.ui-pick-field:not(.mob-ui-field) {
  display: grid;
  grid-template-columns: var(--label-w, var(--ctl-label-w, 150px)) var(--pick-width, max-content) 16px;
  column-gap: 4px;
  align-items: center;
}
.ui-pick-common { --stepper-w: var(--ctl-stepper-w, 14px); --pick-width: calc(90px + 2px + 2 * var(--stepper-w)); }
/* The count dropdown beside it is the value column less its 4 px gap; the same width, never wider. */
.ui-pick-field.ui-pick-common:not(.mob-ui-field) :deep(select) { width: calc(var(--pick-width) - 4px); }
.ui-pick-field > label { grid-column: 1; white-space: nowrap; }
.ui-pick-field .ui-field-value { grid-column: 2; display: inline-flex; align-items: center; }
.ui-pick-field:not(.mob-ui-field) :deep(select), .ui-pick-field:not(.mob-ui-field) :deep(input) { width: 100%; }
.ui-pick-field:not(.mob-ui-field) :deep(select), .ui-pick-field:not(.mob-ui-field) :deep(input) { height: var(--ctl-h); box-sizing: border-box; }
.ui-pick-field .ui-field-dev { grid-column: 3; }
</style>
