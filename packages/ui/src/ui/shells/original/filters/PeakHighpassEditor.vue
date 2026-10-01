<script setup lang="ts">
/** Display only: every edit is decided by `api.editPeakHighpass` (the engine's filters area), not here. */
import {NumberField} from '@openisd/design/fields';
import {liveNum, numFrom} from './numericInput.js';
import type {PeakHighpassFilter} from '@openisd/design/engine';
import type {OriginalFiltersAPI} from '../../../../hooks/OriginalFilters-hooks.js';

const {f, api} = defineProps<{ f: PeakHighpassFilter; api: OriginalFiltersAPI }>();
</script>

<template>
  <div class="filter-edit-body">
    <label>Gpk <input v-expo-step type="number" step="0.5" v-limits="NumberField.FILTER_GAIN_DB.limits" :value="f.gainPk" @input="liveNum($event, v => api.editPeakHighpass(f, {gainPk: v}))" @change="api.editPeakHighpass(f, {gainPk: numFrom($event)})"> dB</label>
    <label>fpk <input v-expo-step type="number" step="1" v-limits="NumberField.FILTER_FC_HZ.limits" :value="f.fpk" @input="liveNum($event, v => api.editPeakHighpass(f, {fpk: v}))" @change="api.editPeakHighpass(f, {fpk: numFrom($event)})"> Hz</label>
  </div>
</template>
