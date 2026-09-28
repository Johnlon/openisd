<script setup lang="ts">
/** Display only: every edit is decided by `api.updateParametricEqFilter` (`Engine`), not here. */
import {NumberField} from '@openisd/design/fields';
import {numFrom} from './numericInput.js';
import type {Filter} from '@openisd/design/engine';
import type {OgFiltersAPI} from '../../../../hooks/OgFilters-hooks.js';

type PeakingFilter = Extract<Filter, { type: 'peaking' }>;
const {f, api} = defineProps<{ f: PeakingFilter; api: OgFiltersAPI }>();
const emit = defineEmits<{ replace: [next: PeakingFilter] }>();
</script>

<template>
  <div class="filter-edit-body">
    <label>fc <input v-expo-step type="number" step="1" v-limits="NumberField.FILTER_FC_HZ.limits" :value="f.fc" @change="emit('replace', api.updateParametricEqFilter(f, {fc: numFrom($event)}))"> Hz</label>
    <label>Gain <input v-expo-step type="number" step="0.5" v-limits="NumberField.FILTER_GAIN_DB.limits" :value="f.gain" @change="emit('replace', api.updateParametricEqFilter(f, {gain: numFrom($event)}))"> dB</label>
    <label>Q <input v-expo-step type="number" step="0.01" v-limits="NumberField.FILTER_Q.limits" :value="f.Q" @change="emit('replace', api.updateParametricEqFilter(f, {Q: numFrom($event)}))"></label>
  </div>
</template>
