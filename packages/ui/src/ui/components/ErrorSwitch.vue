<script setup lang="ts">
// The frame every error switch sits in, in both shells: a WinISD-compatibility control that can
// reproduce a known WinISD error. The design package decides which controls are error switches,
// whether one applies to the open box and whether it is reproducing the error now
// (`OpenISDProject.errorSwitches`); this component only turns those three flags into classes and
// puts the shared first line on the tooltip.
const props = defineProps<{
  /** The root element: `label` for a checkbox switch, `div` around a drop-down. */
  as: 'label' | 'div';
  /** The control carries the warning look, ticked or not. */
  marked: boolean;
  /** The open box has what the control acts on; false renders it inactive. */
  applicable: boolean;
  /** The control is reproducing the error now; the warning look gets a stronger fill. */
  reproducesError: boolean;
  /** The control's own tooltip. */
  title: string;
  fieldKey?: string;
}>();

const ERROR_SWITCH_TITLE = 'Reproduces a WinISD error.';
</script>

<template>
  <component :is="props.as" class="error-switch" :data-field-key="props.fieldKey"
             :class="{ 'error-switch-marked': props.marked, 'error-switch-on': props.marked && props.reproducesError, 'error-switch-na': !props.applicable }"
             :title="props.marked ? `${ERROR_SWITCH_TITLE}\n${props.title}` : props.title">
    <span v-if="props.marked" class="error-switch-mark" aria-hidden="true">⚠</span>
    <slot />
  </component>
</template>

<style>
.error-switch { display: flex; align-items: center; gap: 6px; cursor: pointer; min-width: 0; }
.error-switch-marked { border: 1px solid #d9a400; border-radius: 3px; padding: 0 4px; background: rgba(255, 196, 0, 0.12); }
.error-switch-marked.error-switch-on { background: rgba(255, 196, 0, 0.45); }
.error-switch-mark { color: #b88400; }
.error-switch-na { opacity: 0.45; cursor: default; }
</style>
