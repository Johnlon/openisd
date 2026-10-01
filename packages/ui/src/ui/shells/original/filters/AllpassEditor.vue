<script setup lang="ts">
/** Display only: every edit is decided by `api.editAllpass` (the engine's filters area), not here. */
import {NumberField} from '@openisd/design/fields';
import {liveNum, numFrom} from './numericInput.js';
import type {AllpassFilter} from '@openisd/design/engine';
import type {OriginalFiltersAPI} from '../../../../hooks/OriginalFilters-hooks.js';

const {f, api} = defineProps<{ f: AllpassFilter; api: OriginalFiltersAPI }>();
</script>

<template>
  <div class="filter-edit-body">
    <label>Order <input type="number" step="1" v-limits="NumberField.FILTER_ORDER.limits" :value="f.order" @input="liveNum($event, v => api.editAllpass(f, {order: v}))" @change="api.editAllpass(f, {order: numFrom($event)})"></label>
    <label>Q <input v-expo-step type="number" step="0.01" v-limits="NumberField.FILTER_Q.limits" :value="f.Q" @input="liveNum($event, v => api.editAllpass(f, {Q: v}))" @change="api.editAllpass(f, {Q: numFrom($event)})"></label>
    <label>t <input v-expo-step type="number" step="0.001" v-limits="NumberField.FILTER_T_S.limits" :value="f.t" @input="liveNum($event, v => api.editAllpass(f, {t: v}))" @change="api.editAllpass(f, {t: numFrom($event)})"> s</label>
  </div>
</template>
