<script setup lang="ts">
/** Lowpass/Highpass Filter Editor — one component for both, since they differ only in leading
 *  word and which side of the family's response they read (`PassFilter` on the engine side).
 *  Display only: every edit is decided by `api.editPass` (the engine's filters area), not here. */
import {NumberField, PASS_FAMILY_OPTIONS, WinisdFilterDeviation} from '@openisd/design/fields';
import WinisdDeviationCue from '../../../components/WinisdDeviationCue.vue';
import {selectedOption} from '../../../../logic/domEvents.js';
import {liveNum, numFrom} from './numericInput.js';
import type {PassFilter} from '@openisd/design/engine';
import type {OriginalFiltersAPI} from '../../../../hooks/OriginalFilters-hooks.js';

const {f, api} = defineProps<{ f: PassFilter; api: OriginalFiltersAPI }>();

function onFamily(e: Event): void {
  const family = selectedOption(e, PASS_FAMILY_OPTIONS);
  if (family !== null) api.editPass(f, {family});
}
</script>

<template>
  <div class="filter-edit-body">
    <label>Subtype
      <select :value="f.family" @change="onFamily">
        <option v-for="o in PASS_FAMILY_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </label>
    <WinisdDeviationCue v-if="api.deviationShown(WinisdFilterDeviation.BESSEL_HIGHPASS, f)" :deviation="WinisdFilterDeviation.BESSEL_HIGHPASS" />
    <label :title="api.passOrderEntry(f).title">Order <input type="number" :step="api.passOrderEntry(f).step" v-limits="api.passOrderEntry(f).limits" :disabled="!api.passOrderEntry(f).editable" :value="f.order" @input="liveNum($event, v => api.editPass(f, {order: v}))" @change="api.editPass(f, {order: numFrom($event)})"></label>
    <WinisdDeviationCue v-if="api.deviationShown(WinisdFilterDeviation.LINKWITZ_RILEY_ORDER, f)" :deviation="WinisdFilterDeviation.LINKWITZ_RILEY_ORDER" />
    <label>Q <input v-expo-step="NumberField.FILTER_Q" type="number" v-limits="NumberField.FILTER_Q.limits" :value="f.Q" @input="liveNum($event, v => api.editPass(f, {Q: v}))" @change="api.editPass(f, {Q: numFrom($event)})"></label>
    <label>Cutoff <input v-expo-step="NumberField.FILTER_FC_HZ" type="number" v-limits="NumberField.FILTER_FC_HZ.limits" :value="f.fc" @input="liveNum($event, v => api.editPass(f, {fc: v}))" @change="api.editPass(f, {fc: numFrom($event)})"> Hz</label>
  </div>
</template>
