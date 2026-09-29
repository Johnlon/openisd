<script setup lang="ts">
/** Display only: every edit is decided by `api.editLinkwitz` (the engine's filters area), not here. */
import {NumberField} from '@openisd/design/fields';
import {numFrom} from './numericInput.js';
import type {LinkwitzFilter} from '@openisd/design/engine';
import type {OriginalFiltersAPI} from '../../../../hooks/OriginalFilters-hooks.js';

const {f, api} = defineProps<{ f: LinkwitzFilter; api: OriginalFiltersAPI }>();
</script>

<template>
  <div class="filter-edit-body">
    <label>f0 <input v-expo-step type="number" step="1" v-limits="NumberField.FILTER_FC_HZ.limits" :value="f.f0" @change="api.editLinkwitz(f, {f0: numFrom($event)})"> Hz</label>
    <label>Q0 <input v-expo-step type="number" step="0.01" v-limits="NumberField.FILTER_Q.limits" :value="f.Q0" @change="api.editLinkwitz(f, {Q0: numFrom($event)})"></label>
    <label>fp <input v-expo-step type="number" step="1" v-limits="NumberField.FILTER_FC_HZ.limits" :value="f.fp" @change="api.editLinkwitz(f, {fp: numFrom($event)})"> Hz</label>
    <label>Qp <input v-expo-step type="number" step="0.01" v-limits="NumberField.FILTER_Q.limits" :value="f.Qp" @change="api.editLinkwitz(f, {Qp: numFrom($event)})"></label>
  </div>
</template>
