<script setup lang="ts">
// The rows of one peaking highpass filter card: standard field rows. Every edit is decided by the engine through `api`.
import {NumberField, PhoneLabels} from '@openisd/design/fields';
import type {PeakHighpassFilter} from '@openisd/design/engine';
import UIFixedField from '../../../components/UIFixedField.vue';
import type {OriginalFiltersAPI} from '../../../../hooks/OriginalFilters-hooks.js';

const {f, api} = defineProps<{ f: PeakHighpassFilter; api: OriginalFiltersAPI }>();
</script>

<template>
  <UIFixedField class="mob-ui-field" :field="NumberField.FILTER_GAIN_DB" :label="PhoneLabels.GPK" :value="f.gainPk" stepper @update:value="v => api.editPeakHighpass(f, {gainPk: v})" />
  <UIFixedField class="mob-ui-field" :field="NumberField.PHONE_FILTER_FC_HZ" :label="PhoneLabels.FPK" :value="f.fpk" stepper @update:value="v => api.editPeakHighpass(f, {fpk: v})" />
</template>
