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
import {presentationState} from '../../logic/presentationState.js';
import type {NumberField} from '@openisd/design/fields';

const props = defineProps<{
  /** The field this toggle rotates the display unit of. */
  field: NumberField;
  /** CSS class for the unit span (e.g. 'unit unit-cyc' or 'u'). */
  unitClass?: string;
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
</script>

<template>
  <span v-if="hasChoice" :class="unitClass ?? 'u'" role="button" tabindex="0"
    :title="`Click to change units (${label})`"
    @click="cycle"
    @keydown.enter.prevent="cycle"
    @keydown.space.prevent="cycle">{{ label }}</span>
  <span v-else :class="unitClass ?? 'u'">{{ label }}</span>
</template>
