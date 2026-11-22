<script setup lang="ts">
/** Lowpass/Highpass Filter Editor — one component for both, since they differ only in leading
 *  word and which side of the family's response they read (`PassFilter` on the engine side).
 *  Display only: every edit is decided by `api.editPass` (the engine's filters area), not here. */
import {NumberField, PASS_FAMILY_OPTIONS, WinisdFilterDeviation} from '@openisd/design/fields';
import WinisdDeviationCue from '../../../components/WinisdDeviationCue.vue';
import {selectedOption} from '../../../../logic/domEvents.js';
import {computed} from 'vue';
import type {PassFilter} from '@openisd/design/engine';
import UIFixedField from '../../../components/UIFixedField.vue';
import type {OriginalFiltersAPI} from '../../../../hooks/OriginalFilters-hooks.js';

const {f, api} = defineProps<{ f: PassFilter; api: OriginalFiltersAPI }>();

const entry = computed(() => api.passOrderEntry(f));

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
    <UIFixedField :title="entry.title" :field="NumberField.FILTER_ORDER" label="Order" :value="f.order" :min="entry.limits.min" :max="entry.limits.max" :spin="entry.spin" :readonly="!entry.editable" :deviation="api.deviationShown(WinisdFilterDeviation.LINKWITZ_RILEY_ORDER, f) ? WinisdFilterDeviation.LINKWITZ_RILEY_ORDER : undefined" @update:value="v => api.editPass(f, {order: v})" />
    <UIFixedField :field="NumberField.FILTER_Q" label="Q" :value="f.Q" @update:value="v => api.editPass(f, {Q: v})" />
    <UIFixedField :field="NumberField.FILTER_FC_HZ" label="Cutoff" :value="f.fc" @update:value="v => api.editPass(f, {fc: v})" />
  </div>
</template>
