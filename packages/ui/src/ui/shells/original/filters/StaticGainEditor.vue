<script setup lang="ts">
/** Display only: every edit is decided by `api.updateStaticGainFilter` (`Engine`), not here. */
import {limits} from '../../../../logic/fields/uiFields.js';
import {numFrom} from './numericInput.js';
import type {Filter} from '@openisd/design/engine';
import type {OgFiltersAPI} from '../../../../hooks/OgFilters-hooks.js';

type StaticGainFilter = Extract<Filter, { type: 'staticGain' }>;
const {f, api} = defineProps<{ f: StaticGainFilter; api: OgFiltersAPI }>();
const emit = defineEmits<{ replace: [next: StaticGainFilter] }>();
</script>

<template>
  <div class="filter-edit-body">
    <label>Gain <input v-expo-step type="number" step="0.5" v-limits="limits('filterGain')" :value="f.gain" @change="emit('replace', api.updateStaticGainFilter(f, {gain: numFrom($event)}))"> dB</label>
  </div>
</template>
