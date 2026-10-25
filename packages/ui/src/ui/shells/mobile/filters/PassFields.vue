<script setup lang="ts">
// The rows of one lowpass or highpass filter card: standard field rows. Every edit is decided by the engine through `api`.
import {computed} from 'vue';
import {NumberField, PhoneLabels, PASS_FAMILY_OPTIONS, WinisdFilterDeviation} from '@openisd/design/fields';
import type {PassFilter} from '@openisd/design/engine';
import UIFixedField from '../../../components/UIFixedField.vue';
import type {OriginalFiltersAPI} from '../../../../hooks/OriginalFilters-hooks.js';
import WinisdDeviationCue from '../../../components/WinisdDeviationCue.vue';
import {selectedOption} from '../../../../logic/domEvents.js';

const {f, api} = defineProps<{ f: PassFilter; api: OriginalFiltersAPI }>();

const entry = computed(() => api.passOrderEntry(f));
function onFamily(e: Event): void {
  const family = selectedOption(e, PASS_FAMILY_OPTIONS);
  if (family !== null) api.editPass(f, {family});
}
</script>

<template>
  <div class="mob-crow">
    <label class="mob-crow-label" :for="`mob-fsub-${f.id}`">{{ PhoneLabels.SUBTYPE }}</label>
    <select :id="`mob-fsub-${f.id}`" class="mob-cselect mob-cselect-wide" :value="f.family" @change="onFamily">
      <option v-for="o in PASS_FAMILY_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
    <WinisdDeviationCue v-if="api.deviationShown(WinisdFilterDeviation.BESSEL_HIGHPASS, f)" :deviation="WinisdFilterDeviation.BESSEL_HIGHPASS" />
  </div>
  <UIFixedField class="mob-ui-field" :title="entry.title" :field="NumberField.FILTER_ORDER" :label="PhoneLabels.ORDER" :value="f.order" :max="entry.limits.max" :readonly="!entry.editable" plain
                :deviation="api.deviationShown(WinisdFilterDeviation.LINKWITZ_RILEY_ORDER, f) ? WinisdFilterDeviation.LINKWITZ_RILEY_ORDER : undefined" stepper @update:value="v => api.editPass(f, {order: v})" />
  <UIFixedField class="mob-ui-field" :field="NumberField.FILTER_Q" :label="PhoneLabels.Q" :value="f.Q" stepper @update:value="v => api.editPass(f, {Q: v})" />
  <UIFixedField class="mob-ui-field" :field="NumberField.PHONE_FILTER_FC_HZ" :label="PhoneLabels.CUTOFF" :value="f.fc" stepper @update:value="v => api.editPass(f, {fc: v})" />
</template>
