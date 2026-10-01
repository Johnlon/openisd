<script setup lang="ts">
/** OpenISD-only low/high shelf editor — one component for both, they share every field.
 *  Display only: every edit is decided by `api.editShelf` (the engine's filters area), not here. */
import {NumberField} from '@openisd/design/fields';
import {liveNum, numFrom} from './numericInput.js';
import type {ShelfFilter} from '@openisd/design/engine';
import type {OriginalFiltersAPI} from '../../../../hooks/OriginalFilters-hooks.js';

const {f, api} = defineProps<{ f: ShelfFilter; api: OriginalFiltersAPI }>();
</script>

<template>
  <div class="filter-edit-body">
    <label>fc <input v-expo-step type="number" step="1" v-limits="NumberField.FILTER_FC_HZ.limits" :value="f.fc" @input="liveNum($event, v => api.editShelf(f, {fc: v}))" @change="api.editShelf(f, {fc: numFrom($event)})"> Hz</label>
    <label>Q <input v-expo-step type="number" step="0.01" v-limits="NumberField.FILTER_Q.limits" :value="f.Q" @input="liveNum($event, v => api.editShelf(f, {Q: v}))" @change="api.editShelf(f, {Q: numFrom($event)})"></label>
    <label>Gain <input v-expo-step type="number" step="0.5" v-limits="NumberField.FILTER_GAIN_DB.limits" :value="f.gain" @input="liveNum($event, v => api.editShelf(f, {gain: v}))" @change="api.editShelf(f, {gain: numFrom($event)})"> dB</label>
  </div>
</template>
