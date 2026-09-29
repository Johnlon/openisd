<script setup lang="ts">
/** Display only: every edit is decided by `api.editRaisedCosine` (the engine's filters area), not here. */
import {NumberField} from '@openisd/design/fields';
import {numFrom} from './numericInput.js';
import type {RaisedCosineFilter} from '@openisd/design/engine';
import type {OriginalFiltersAPI} from '../../../../hooks/OriginalFilters-hooks.js';

const {f, api} = defineProps<{ f: RaisedCosineFilter; api: OriginalFiltersAPI }>();
</script>

<template>
  <div class="filter-edit-body">
    <label>fc <input v-expo-step type="number" step="1" v-limits="NumberField.FILTER_FC_HZ.limits" :value="f.fc" @change="api.editRaisedCosine(f, {fc: numFrom($event)})"> Hz</label>
    <label>Gain <input v-expo-step type="number" step="0.5" v-limits="NumberField.FILTER_GAIN_DB.limits" :value="f.gain" @change="api.editRaisedCosine(f, {gain: numFrom($event)})"> dB</label>
    <label>BW <input v-expo-step type="number" step="0.01" v-limits="NumberField.FILTER_BW_OCT.limits" :value="f.bwOct" @change="api.editRaisedCosine(f, {bwOct: numFrom($event)})"> oct</label>
  </div>
</template>
