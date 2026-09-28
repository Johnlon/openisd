<script setup lang="ts">
/** Display only: every edit is decided by `api.updateStaticGainFilter` (`Engine`), not here. */
import {NumberField} from '@openisd/design/fields';
import {numFrom} from './numericInput.js';
import type {StaticGainFilter} from '@openisd/design/engine';
import type {OgFiltersAPI} from '../../../../hooks/OgFilters-hooks.js';

const {f, api} = defineProps<{ f: StaticGainFilter; api: OgFiltersAPI }>();
const emit = defineEmits<{ replace: [next: StaticGainFilter] }>();
</script>

<template>
  <div class="filter-edit-body">
    <label>Gain <input v-expo-step type="number" step="0.5" v-limits="NumberField.FILTER_GAIN_DB.limits" :value="f.gain" @change="emit('replace', api.updateStaticGainFilter(f, {gain: numFrom($event)}))"> dB</label>
  </div>
</template>
