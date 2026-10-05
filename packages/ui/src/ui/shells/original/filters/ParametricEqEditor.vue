<script setup lang="ts">
/** Display only: every edit is decided by `api.editParametricEq` (the engine's filters area), not here. */
import {NumberField} from '@openisd/design/fields';
import {liveNum, numFrom} from './numericInput.js';
import type {ParametricEqFilter} from '@openisd/design/engine';
import type {OriginalFiltersAPI} from '../../../../hooks/OriginalFilters-hooks.js';

const {f, api} = defineProps<{ f: ParametricEqFilter; api: OriginalFiltersAPI }>();
</script>

<template>
  <div class="filter-edit-body">
    <label>fc <input v-expo-step="NumberField.FILTER_FC_HZ" type="number" v-limits="NumberField.FILTER_FC_HZ.limits" :value="f.fc" @input="liveNum($event, v => api.editParametricEq(f, {fc: v}))" @change="api.editParametricEq(f, {fc: numFrom($event)})"> Hz</label>
    <label>Gain <input v-expo-step="NumberField.FILTER_GAIN_DB" type="number" v-limits="NumberField.FILTER_GAIN_DB.limits" :value="f.gain" @input="liveNum($event, v => api.editParametricEq(f, {gain: v}))" @change="api.editParametricEq(f, {gain: numFrom($event)})"> dB</label>
    <label>Q <input v-expo-step="NumberField.FILTER_Q" type="number" v-limits="NumberField.FILTER_Q.limits" :value="f.Q" @input="liveNum($event, v => api.editParametricEq(f, {Q: v}))" @change="api.editParametricEq(f, {Q: numFrom($event)})"></label>
  </div>
</template>
