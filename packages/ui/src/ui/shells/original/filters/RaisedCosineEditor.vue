<script setup lang="ts">
/** Display only: every edit is decided by `api.updateRaisedCosineFilter` (`Engine`), not here. */
import {limits} from '../../../../logic/fields/uiFields.js';
import {numFrom} from './numericInput.js';
import type {Filter} from '@openisd/design/engine';
import type {OgFiltersAPI} from '../../../../hooks/OgFilters-hooks.js';

type RaisedCosineFilter = Extract<Filter, { type: 'raisedCosine' }>;
const {f, api} = defineProps<{ f: RaisedCosineFilter; api: OgFiltersAPI }>();
const emit = defineEmits<{ replace: [next: RaisedCosineFilter] }>();
</script>

<template>
  <div class="filter-edit-body">
    <label>fc <input v-expo-step type="number" step="1" v-limits="limits('filterFc')" :value="f.fc" @change="emit('replace', api.updateRaisedCosineFilter(f, {fc: numFrom($event)}))"> Hz</label>
    <label>Gain <input v-expo-step type="number" step="0.5" v-limits="limits('filterGain')" :value="f.gain" @change="emit('replace', api.updateRaisedCosineFilter(f, {gain: numFrom($event)}))"> dB</label>
    <label>BW <input v-expo-step type="number" step="0.01" v-limits="limits('filterBw')" :value="f.bwOct" @change="emit('replace', api.updateRaisedCosineFilter(f, {bwOct: numFrom($event)}))"> oct</label>
  </div>
</template>
