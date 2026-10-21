<script setup lang="ts">
// The rows of one static gain filter card: standard field rows. Every edit is decided by the engine through `api`.
import {NumberField, PhoneLabels} from '@openisd/design/fields';
import type {StaticGainFilter} from '@openisd/design/engine';
import UIFixedField from '../../../components/UIFixedField.vue';
import type {OriginalFiltersAPI} from '../../../../hooks/OriginalFilters-hooks.js';

const {f, api} = defineProps<{ f: StaticGainFilter; api: OriginalFiltersAPI }>();
</script>

<template>
  <UIFixedField class="mob-ui-field" :field="NumberField.FILTER_GAIN_DB" :label="PhoneLabels.GAIN" :value="f.gain" stepper @update:value="v => api.editStaticGain(f, {gain: v})" />
</template>
