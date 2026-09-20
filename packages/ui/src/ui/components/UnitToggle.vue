<script setup lang="ts">
// The clickable unit label. Rotating it switches the field's display unit for every widget
// bound to the same field id (the paired NumInput, or a calculated readout) — the app state
// stays SI; only the chosen token changes, and the displayed VALUE converts with it (a toggle
// that rotated the text without converting the value would silently misstate every reading).
// Pass the caller's own unit-span class via `unitClass`.
import {computed} from 'vue';
import {cycleUnitToken, unitToken} from '../../logic/presentationState.js';
import {UNIT_GROUPS, unitDef} from '../../logic/fields/units.js';
import type {UnitGroup} from '@openisd/design/fields';

const props = defineProps<{
  /** Field id — the shared key for this field's selected unit. */
  field: string;
  /** Which interchangeable-unit group this field belongs to. */
  group: UnitGroup;
  /** The field's base (default) unit token, shown until the user rotates it. */
  base: string;
  /** CSS class for the unit span (e.g. 'unit unit-cyc' or 'u'). */
  unitClass?: string;
}>();

const label = computed(() => unitDef(props.group, unitToken(props.field, props.base)).label);
// A group with ONE unit (e.g. `percent` — a stored fraction shown as %) has nowhere to rotate:
// render it as a plain label, never a clickable toggle with nothing to cycle.
const hasChoice = computed(() => UNIT_GROUPS[props.group].length > 1);
</script>

<template>
  <span v-if="hasChoice" :class="unitClass ?? 'u'" role="button" tabindex="0"
    :title="`Click to change units (${label})`"
    @click="cycleUnitToken(field, group, base)"
    @keydown.enter.prevent="cycleUnitToken(field, group, base)"
    @keydown.space.prevent="cycleUnitToken(field, group, base)">{{ label }}</span>
  <span v-else :class="unitClass ?? 'u'">{{ label }}</span>
</template>
