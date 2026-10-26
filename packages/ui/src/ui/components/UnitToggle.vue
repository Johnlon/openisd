<script setup lang="ts">
// The clickable unit label. Rotating it switches the field's display unit for every widget
// bound to the same field (the paired NumInput, or a calculated readout) — the app state
// stays SI; only the chosen token changes, and the displayed VALUE converts with it (a toggle
// that rotated the text without converting the value would silently misstate every reading).
// Pass the caller's own unit-span class via `unitClass`.
//
// Group and base token come from the field's OWN `display` (`NumberField.display`), never a
// separate `group=`/`base=` prop here — that pair used to be able to disagree with the
// registry's own `unit`/`unitGroup` (BUG_20260928, "NumInput's group/base props are a fourth
// table"). A field with a `fixed` display renders its symbol, unrotatable.
import {computed} from 'vue';
import {useApp} from '../../logic/app.js';
import type {NumberField} from '@openisd/design/fields';
const presentationState = useApp().presentation;

const props = defineProps<{
  /** The field this toggle rotates the display unit of. */
  field: NumberField;
  /** CSS class used only to place the unit span in its caller's layout. */
  unitClass: string;
}>();

const currentToken = computed(() => props.field.unitTokenFor(presentationState.ui.unitTokens ?? {}));
const label = computed(() => props.field.unitLabel(currentToken.value));
// A field with a `fixed` display, or a `switchable` one whose group has ONE unit (e.g. `percent`
// — a stored fraction shown as %), has nowhere to rotate: render a plain label, never a
// clickable toggle with nothing to cycle.
const hasChoice = computed(() => props.field.display.kind === 'switchable' && props.field.nextToken(currentToken.value) !== currentToken.value);

function cycle() {
  presentationState.ui.unitTokens = {...props.field.withNextUnit(presentationState.ui.unitTokens ?? {})};
}

function activate() {
  if (hasChoice.value) cycle();
}
</script>

<template>
  <span :class="[unitClass, 'unit-label', {'unit-toggle': hasChoice}]"
    :role="hasChoice ? 'button' : undefined" :tabindex="hasChoice ? 0 : undefined"
    :title="hasChoice ? `Click to change units (${label})` : undefined"
    @click="activate"
    @keydown.enter.prevent="activate"
    @keydown.space.prevent="activate">{{ label }}</span>
</template>

<style scoped>
/* The cue that a unit label has a tooltip and can be clicked to change units. Owned here so every
   caller, on every skin, shows it whatever class it passes (T373). A plain label has none. */
.unit-label { background: #fff; }
.unit-label:empty { background: transparent; }
.unit-toggle {
  box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center;
  padding: 0 6px; background: #efefef; color: #555;
  border: 1px solid #cfcfcf; border-radius: 0 3px 3px 0;
  cursor: pointer; text-decoration: underline dotted; text-decoration-thickness: 1px;
  text-underline-offset: 2px;
}
.unit-toggle:hover { color: #1868d1; }
</style>
<style>
/* On phones the same switchable-unit chip is bold and aligned to the phone field sizing. */
/* span.unit-label: one element more specific than a caller's scoped unit class (e.g. UIFieldBody's
   .ui-field-unit colour), so the chip wins whatever order the styles load in. */
.app-root-mobile span.unit-label {
  box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center;
  background: #fff;
  font-size: 13px; font-weight: 600; color: #888; white-space: nowrap;
}
.app-root-mobile span.unit-label:empty { background: transparent; }
.app-root-mobile span.unit-label.unit-toggle {
  padding: 0 6px; font-weight: 600; background: #efefef; text-decoration: underline solid;
  text-decoration-color: #1868d1; text-decoration-thickness: 1px; text-underline-offset: 5px;
}
.app-root-mobile span.unit-toggle:hover { color: #1868d1; }
</style>
