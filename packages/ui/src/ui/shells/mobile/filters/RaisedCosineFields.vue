<script setup lang="ts">
// The rows of one raised cosine filter card: standard field rows. Every edit is decided by the engine through `api`.
import {NumberField, PhoneLabels} from '@openisd/design/fields';
import type {RaisedCosineFilter} from '@openisd/design/engine';
import UIFixedField from '../../../components/UIFixedField.vue';
import type {OriginalFiltersAPI} from '../../../../hooks/OriginalFilters-hooks.js';

const {f, api} = defineProps<{ f: RaisedCosineFilter; api: OriginalFiltersAPI }>();
</script>

<template>
  <UIFixedField class="mob-ui-field" :field="NumberField.PHONE_FILTER_FC_HZ" :label="PhoneLabels.FC" :value="f.fc" stepper @update:value="v => api.editRaisedCosine(f, {fc: v})" />
  <UIFixedField class="mob-ui-field" :field="NumberField.FILTER_GAIN_DB" :label="PhoneLabels.GAIN" :value="f.gain" stepper @update:value="v => api.editRaisedCosine(f, {gain: v})" />
  <UIFixedField class="mob-ui-field" :field="NumberField.FILTER_BW_OCT" :label="PhoneLabels.BW" :value="f.bwOct" stepper @update:value="v => api.editRaisedCosine(f, {bwOct: v})" />
</template>
