<script setup lang="ts">
// The rows of one shelf filter card: standard field rows. Every edit is decided by the engine through `api`.
import {NumberField, PhoneLabels} from '@openisd/design/fields';
import type {ShelfFilter} from '@openisd/design/engine';
import UIFixedField from '../../../components/UIFixedField.vue';
import type {OriginalFiltersAPI} from '../../../../hooks/OriginalFilters-hooks.js';

const {f, api} = defineProps<{ f: ShelfFilter; api: OriginalFiltersAPI }>();
</script>

<template>
  <UIFixedField class="mob-ui-field" :field="NumberField.PHONE_FILTER_FC_HZ" :label="PhoneLabels.FC" :value="f.fc" stepper @update:value="v => api.editShelf(f, {fc: v})" />
  <UIFixedField class="mob-ui-field" :field="NumberField.FILTER_Q" :label="PhoneLabels.Q" :value="f.Q" stepper @update:value="v => api.editShelf(f, {Q: v})" />
  <UIFixedField class="mob-ui-field" :field="NumberField.FILTER_GAIN_DB" :label="PhoneLabels.GAIN" :value="f.gain" stepper @update:value="v => api.editShelf(f, {gain: v})" />
</template>
