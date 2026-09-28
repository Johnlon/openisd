<script setup lang="ts">
/** Display only: every edit is decided by `api.updatePeakHighpassFilter` (`Engine`), not here. */
import {NumberField} from '@openisd/design/fields';
import {numFrom} from './numericInput.js';
import type {PeakHighpassFilter} from '@openisd/design/engine';
import type {OgFiltersAPI} from '../../../../hooks/OgFilters-hooks.js';

const {f, api} = defineProps<{ f: PeakHighpassFilter; api: OgFiltersAPI }>();
const emit = defineEmits<{ replace: [next: PeakHighpassFilter] }>();
</script>

<template>
  <div class="filter-edit-body">
    <label>Gpk <input v-expo-step type="number" step="0.5" v-limits="NumberField.FILTER_GAIN_DB.limits" :value="f.gainPk" @change="emit('replace', api.updatePeakHighpassFilter(f, {gainPk: numFrom($event)}))"> dB</label>
    <label>fpk <input v-expo-step type="number" step="1" v-limits="NumberField.FILTER_FC_HZ.limits" :value="f.fpk" @change="emit('replace', api.updatePeakHighpassFilter(f, {fpk: numFrom($event)}))"> Hz</label>
  </div>
</template>
