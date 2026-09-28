<script setup lang="ts">
/** Lowpass/Highpass Filter Editor — one component for both, since they differ only in leading
 *  word and which side of the family's response they read (`PassFilter` on the engine side).
 *  Display only: every edit is decided by `api.updatePassFilter` (`Engine`), not here. */
import {NumberField, PASS_FAMILY_OPTIONS} from '@openisd/design/fields';
import {selectedOption} from '../../../../logic/domEvents.js';
import {numFrom} from './numericInput.js';
import type {PassFilter} from '@openisd/design/engine';
import type {OgFiltersAPI} from '../../../../hooks/OgFilters-hooks.js';

const {f, api} = defineProps<{ f: PassFilter; api: OgFiltersAPI }>();
const emit = defineEmits<{ replace: [next: PassFilter] }>();

function onFamily(e: Event): void {
  const family = selectedOption(e, PASS_FAMILY_OPTIONS);
  if (family !== null) emit('replace', api.updatePassFilter(f, {family}));
}
</script>

<template>
  <div class="filter-edit-body">
    <label>Subtype
      <select :value="f.family" @change="onFamily">
        <option v-for="o in PASS_FAMILY_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </label>
    <label>Order <input type="number" step="1" v-limits="NumberField.FILTER_ORDER.limits" :value="f.order" @change="emit('replace', api.updatePassFilter(f, {order: numFrom($event)}))"></label>
    <label>Q <input v-expo-step type="number" step="0.01" v-limits="NumberField.FILTER_Q.limits" :value="f.Q" @change="emit('replace', api.updatePassFilter(f, {Q: numFrom($event)}))"></label>
    <label>Cutoff <input v-expo-step type="number" step="1" v-limits="NumberField.FILTER_FC_HZ.limits" :value="f.fc" @change="emit('replace', api.updatePassFilter(f, {fc: numFrom($event)}))"> Hz</label>
  </div>
</template>
