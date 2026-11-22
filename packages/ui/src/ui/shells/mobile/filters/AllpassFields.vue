<script setup lang="ts">
// The rows of one allpass filter card: standard field rows. Every edit is decided by the engine through `api`.
import {NumberField, PhoneLabels, WinisdFilterDeviation} from '@openisd/design/fields';
import type {AllpassFilter} from '@openisd/design/engine';
import UIFixedField from '../../../components/UIFixedField.vue';
import type {OriginalFiltersAPI} from '../../../../hooks/OriginalFilters-hooks.js';

const {f, api} = defineProps<{ f: AllpassFilter; api: OriginalFiltersAPI }>();
</script>

<template>
  <UIFixedField class="mob-ui-field" :field="NumberField.FILTER_ORDER" :label="PhoneLabels.ORDER" :value="f.order" :deviation="api.deviationShown(WinisdFilterDeviation.ALLPASS_ORDER, f) ? WinisdFilterDeviation.ALLPASS_ORDER : undefined" stepper @update:value="v => api.editAllpass(f, {order: v})" />
  <UIFixedField class="mob-ui-field" :field="NumberField.FILTER_Q" :label="PhoneLabels.Q" :value="f.Q" stepper @update:value="v => api.editAllpass(f, {Q: v})" />
  <UIFixedField class="mob-ui-field" :field="NumberField.FILTER_T_S" :label="PhoneLabels.T" :value="f.t" stepper @update:value="v => api.editAllpass(f, {t: v})" />
</template>
