<script setup lang="ts">
/** A field row for a control that is not a number: a pick list or a text box. It is laid out as a
 *  `UIFieldBody` row is (label column, then the control), so every row on a screen starts its label
 *  and its control at the same x and is as tall as a number box. The control is the default slot. */
defineProps<{
  label: string;
  /** The id of the control in the slot; the label is tied to it. */
  inputId: string;
}>();
</script>

<template>
  <div class="ui-field ui-pick-field">
    <label class="ui-field-label" :for="inputId">{{ label }}</label>
    <span class="ui-field-value"><slot /></span>
    <span v-if="$slots.cue" class="ui-field-dev"><slot name="cue" /></span>
  </div>
</template>

<style scoped>
.ui-pick-field:not(.mob-ui-field) {
  display: grid;
  grid-template-columns: var(--label-w, var(--ctl-label-w)) max-content 16px;
  column-gap: 4px;
  align-items: center;
}
.ui-pick-field > label { grid-column: 1; white-space: nowrap; }
.ui-pick-field .ui-field-value { grid-column: 2; display: inline-flex; align-items: center; }
.ui-pick-field:not(.mob-ui-field) :deep(select), .ui-pick-field:not(.mob-ui-field) :deep(input) { height: var(--ctl-h); box-sizing: border-box; }
.ui-pick-field .ui-field-dev { grid-column: 3; }
</style>
