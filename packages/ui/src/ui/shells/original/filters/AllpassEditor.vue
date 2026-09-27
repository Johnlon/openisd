<script setup lang="ts">
/** Display only: every edit is decided by `api.updateAllpassFilter` (`Engine`), not here. */
import {limits} from '../../../../logic/fields/uiFields.js';
import {numFrom} from './numericInput.js';
import type {Filter} from '@openisd/design/engine';
import type {OgFiltersAPI} from '../../../../hooks/OgFilters-hooks.js';

type AllpassFilter = Extract<Filter, { type: 'allpass' }>;
const {f, api} = defineProps<{ f: AllpassFilter; api: OgFiltersAPI }>();
const emit = defineEmits<{ replace: [next: AllpassFilter] }>();
</script>

<template>
  <div class="filter-edit-body">
    <label>Order <input type="number" step="1" v-limits="limits('filterOrder')" :value="f.order" @change="emit('replace', api.updateAllpassFilter(f, {order: numFrom($event)}))"></label>
    <label>Q <input v-expo-step type="number" step="0.01" v-limits="limits('filterQ')" :value="f.Q" @change="emit('replace', api.updateAllpassFilter(f, {Q: numFrom($event)}))"></label>
    <label>t <input v-expo-step type="number" step="0.001" v-limits="limits('filterT')" :value="f.t" @change="emit('replace', api.updateAllpassFilter(f, {t: numFrom($event)}))"> s</label>
  </div>
</template>
