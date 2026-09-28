<script setup lang="ts">
/** OpenISD-only low/high shelf editor — one component for both, they share every field.
 *  Display only: every edit is decided by `api.updateShelfFilter` (`Engine`), not here. */
import {NumberField} from '@openisd/design/fields';
import {numFrom} from './numericInput.js';
import type {ShelfFilter} from '@openisd/design/engine';
import type {OgFiltersAPI} from '../../../../hooks/OgFilters-hooks.js';

const {f, api} = defineProps<{ f: ShelfFilter; api: OgFiltersAPI }>();
const emit = defineEmits<{ replace: [next: ShelfFilter] }>();
</script>

<template>
  <div class="filter-edit-body">
    <label>fc <input v-expo-step type="number" step="1" v-limits="NumberField.FILTER_FC_HZ.limits" :value="f.fc" @change="emit('replace', api.updateShelfFilter(f, {fc: numFrom($event)}))"> Hz</label>
    <label>Q <input v-expo-step type="number" step="0.01" v-limits="NumberField.FILTER_Q.limits" :value="f.Q" @change="emit('replace', api.updateShelfFilter(f, {Q: numFrom($event)}))"></label>
    <label>Gain <input v-expo-step type="number" step="0.5" v-limits="NumberField.FILTER_GAIN_DB.limits" :value="f.gain" @change="emit('replace', api.updateShelfFilter(f, {gain: numFrom($event)}))"> dB</label>
  </div>
</template>
