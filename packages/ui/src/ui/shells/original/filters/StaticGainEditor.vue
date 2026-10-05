<script setup lang="ts">
/** Display only: every edit is decided by `api.editStaticGain` (the engine's filters area), not here. */
import {NumberField} from '@openisd/design/fields';
import {liveNum, numFrom} from './numericInput.js';
import type {StaticGainFilter} from '@openisd/design/engine';
import type {OriginalFiltersAPI} from '../../../../hooks/OriginalFilters-hooks.js';

const {f, api} = defineProps<{ f: StaticGainFilter; api: OriginalFiltersAPI }>();
</script>

<template>
  <div class="filter-edit-body">
    <label>Gain <input v-expo-step="NumberField.FILTER_GAIN_DB" type="number" v-limits="NumberField.FILTER_GAIN_DB.limits" :value="f.gain" @input="liveNum($event, v => api.editStaticGain(f, {gain: v}))" @change="api.editStaticGain(f, {gain: numFrom($event)})"> dB</label>
  </div>
</template>
