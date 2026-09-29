<script setup lang="ts">
// The clickable unit label. Rotating it switches the field's display unit for every widget
// bound to the same unitKey (the paired NumInput, or a calculated readout) — the app state
// stays SI; only the chosen token changes, and the displayed VALUE converts with it (a toggle
// that rotated the text without converting the value would silently misstate every reading).
// Pass the caller's own unit-span class via `unitClass`.
//
// Group and base token come from the field's OWN `display` (`NumberField.display`), never a
// separate `group=`/`base=` prop here — that pair used to be able to disagree with the
// registry's own `unit`/`unitGroup` (BUG_20260928, "NumInput's group/base props are a fourth
// table"). A field with a `fixed` display renders its symbol, unrotatable.
import {computed} from 'vue';
import {cycleUnitToken, unitToken} from '../../logic/presentationState.js';
import {UNIT_GROUPS, unitDef} from '../../logic/fields/units.js';
import type {NumberField} from '@openisd/design/fields';

const props = defineProps<{
  /** The field this toggle rotates the display unit of. */
  field: NumberField;
  /** The presentation-state key this field's SELECTED unit is stored under (shared with the
   *  paired `<NumInput unit-key="...">`) — not itself a fact about the field. */
  unitKey: string;
  /** CSS class for the unit span (e.g. 'unit unit-cyc' or 'u'). */
  unitClass?: string;
}>();

const display = computed(() => props.field.display);
const label = computed(() => {
  const d = display.value;
  if (d.kind === 'fixed') return d.symbol;
  return unitDef(d.group, unitToken(props.unitKey, d.base)).label;
});
// A field with a `fixed` display, or a `switchable` one whose group has ONE unit (e.g. `percent`
// — a stored fraction shown as %), has nowhere to rotate: render a plain label, never a
// clickable toggle with nothing to cycle.
const hasChoice = computed(() => display.value.kind === 'switchable' && UNIT_GROUPS[display.value.group].length > 1);

function cycle() {
  const d = display.value;
  if (d.kind !== 'switchable') return;
  cycleUnitToken(props.unitKey, d.group, d.base);
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
