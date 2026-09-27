<script setup lang="ts">
/** Lowpass/Highpass Filter Editor — one component for both, since they differ only in leading
 *  word and which side of the family's response they read (`PassFilter` on the engine side).
 *  Display only: every edit is decided by `api.updatePassFilter` (`Engine`), not here. */
import {limits, passFamilyOptions} from '../../../../logic/fields/uiFields.js';
import {selectedOption} from '../../../../logic/domEvents.js';
import {numFrom} from './numericInput.js';
import type {Filter} from '@openisd/design/engine';
import type {OgFiltersAPI} from '../../../../hooks/OgFilters-hooks.js';

type PassFilter = Extract<Filter, { type: 'lowpass' | 'highpass' }>;
const {f, api} = defineProps<{ f: PassFilter; api: OgFiltersAPI }>();
const emit = defineEmits<{ replace: [next: PassFilter] }>();

const PASS_FAMILY_OPTIONS = passFamilyOptions();

function onFamily(e: Event): void {
  const family = selectedOption(e, PASS_FAMILY_OPTIONS);
  if (family !== null) emit('replace', api.updatePassFilter(f, {family}));
}
</script>

<template>
  <div class="filter-edit-body">
    <label>Subtype
      <select :value="f.family" @change="onFamily">
        <option v-for="o in PASS_FAMILY_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </label>
    <label>Order <input type="number" step="1" v-limits="limits('filterOrder')" :value="f.order" @change="emit('replace', api.updatePassFilter(f, {order: numFrom($event)}))"></label>
    <label>Q <input v-expo-step type="number" step="0.01" v-limits="limits('filterQ')" :value="f.Q" @change="emit('replace', api.updatePassFilter(f, {Q: numFrom($event)}))"></label>
    <label>Cutoff <input v-expo-step type="number" step="1" v-limits="limits('filterFc')" :value="f.fc" @change="emit('replace', api.updatePassFilter(f, {fc: numFrom($event)}))"> Hz</label>
  </div>
</template>
