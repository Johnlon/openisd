<script setup lang="ts">
/** Display only: every edit is decided by `api.updatePeakHighpassFilter` (`Engine`), not here. */
import {limits} from '../../../../logic/fields/uiFields.js';
import {numFrom} from './numericInput.js';
import type {Filter} from '@openisd/design/engine';
import type {OgFiltersAPI} from '../../../../hooks/OgFilters-hooks.js';

type PeakHighpassFilter = Extract<Filter, { type: 'peakHighpass' }>;
const {f, api} = defineProps<{ f: PeakHighpassFilter; api: OgFiltersAPI }>();
const emit = defineEmits<{ replace: [next: PeakHighpassFilter] }>();
</script>

<template>
  <div class="filter-edit-body">
    <label>Gpk <input v-expo-step type="number" step="0.5" v-limits="limits('filterGain')" :value="f.gainPk" @change="emit('replace', api.updatePeakHighpassFilter(f, {gainPk: numFrom($event)}))"> dB</label>
    <label>fpk <input v-expo-step type="number" step="1" v-limits="limits('filterFc')" :value="f.fpk" @change="emit('replace', api.updatePeakHighpassFilter(f, {fpk: numFrom($event)}))"> Hz</label>
  </div>
</template>
