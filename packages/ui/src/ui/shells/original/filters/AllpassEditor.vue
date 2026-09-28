<script setup lang="ts">
/** Display only: every edit is decided by `api.updateAllpassFilter` (`Engine`), not here. */
import {NumberField} from '@openisd/design/fields';
import {numFrom} from './numericInput.js';
import type {AllpassFilter} from '@openisd/design/engine';
import type {OgFiltersAPI} from '../../../../hooks/OgFilters-hooks.js';

const {f, api} = defineProps<{ f: AllpassFilter; api: OgFiltersAPI }>();
const emit = defineEmits<{ replace: [next: AllpassFilter] }>();
</script>

<template>
  <div class="filter-edit-body">
    <label>Order <input type="number" step="1" v-limits="NumberField.FILTER_ORDER.limits" :value="f.order" @change="emit('replace', api.updateAllpassFilter(f, {order: numFrom($event)}))"></label>
    <label>Q <input v-expo-step type="number" step="0.01" v-limits="NumberField.FILTER_Q.limits" :value="f.Q" @change="emit('replace', api.updateAllpassFilter(f, {Q: numFrom($event)}))"></label>
    <label>t <input v-expo-step type="number" step="0.001" v-limits="NumberField.FILTER_T_S.limits" :value="f.t" @change="emit('replace', api.updateAllpassFilter(f, {t: numFrom($event)}))"> s</label>
  </div>
</template>
