<script setup lang="ts">
/** Display only: every edit is decided by `api.updateLinkwitzFilter` (`Engine`), not here. */
import {limits} from '../../../../logic/fields/uiFields.js';
import {numFrom} from './numericInput.js';
import type {Filter} from '@openisd/design/engine';
import type {OgFiltersAPI} from '../../../../hooks/OgFilters-hooks.js';

type LinkwitzFilter = Extract<Filter, { type: 'linkwitz' }>;
const {f, api} = defineProps<{ f: LinkwitzFilter; api: OgFiltersAPI }>();
const emit = defineEmits<{ replace: [next: LinkwitzFilter] }>();
</script>

<template>
  <div class="filter-edit-body">
    <label>f0 <input v-expo-step type="number" step="1" v-limits="limits('filterFc')" :value="f.f0" @change="emit('replace', api.updateLinkwitzFilter(f, {f0: numFrom($event)}))"> Hz</label>
    <label>Q0 <input v-expo-step type="number" step="0.01" v-limits="limits('filterQ')" :value="f.Q0" @change="emit('replace', api.updateLinkwitzFilter(f, {Q0: numFrom($event)}))"></label>
    <label>fp <input v-expo-step type="number" step="1" v-limits="limits('filterFc')" :value="f.fp" @change="emit('replace', api.updateLinkwitzFilter(f, {fp: numFrom($event)}))"> Hz</label>
    <label>Qp <input v-expo-step type="number" step="0.01" v-limits="limits('filterQ')" :value="f.Qp" @change="emit('replace', api.updateLinkwitzFilter(f, {Qp: numFrom($event)}))"></label>
  </div>
</template>
