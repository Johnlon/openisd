<script setup lang="ts">
// The clickable unit label. Rotating it switches the field's display unit for every widget
// bound to the same field id (the paired NumInput, or a calculated readout) — the store stays
// SI; only the chosen token changes. Reusable across all skins: pass the skin's own unit-span
// class via `unitClass`. This replaces the old decorative cycleUnit, which rotated the text but
// never converted the value.
import { computed } from 'vue';
import { unitToken, cycleUnitToken } from '../store.js';
import { unitDef, type UnitGroup } from '../fields/units.js';

const props = defineProps<{
  /** Field id — the shared key for this field's selected unit. */
  field: string;
  /** Which interchangeable-unit group this field belongs to. */
  group: UnitGroup;
  /** The field's base (default) unit token, shown until the user rotates it. */
  base: string;
  /** Skin-specific CSS class for the unit span (e.g. 'unit unit-cyc' or 'u'). */
  unitClass?: string;
}>();

const label = computed(() => unitDef(props.group, unitToken(props.field, props.base)).label);
</script>

<template>
  <span :class="unitClass ?? 'u'" role="button" tabindex="0"
    :title="`Click to change units (${label})`"
    @click="cycleUnitToken(field, group, base)"
    @keydown.enter.prevent="cycleUnitToken(field, group, base)"
    @keydown.space.prevent="cycleUnitToken(field, group, base)">{{ label }}</span>
</template>
