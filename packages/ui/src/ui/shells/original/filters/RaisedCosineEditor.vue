<script setup lang="ts">
/** Display only: every edit is decided by `api.editRaisedCosine` (the engine's filters area), not here. */
import {NumberField} from '@openisd/design/fields';
import type {RaisedCosineFilter} from '@openisd/design/engine';
import UIFixedField from '../../../components/UIFixedField.vue';
import type {OriginalFiltersAPI} from '../../../../hooks/OriginalFilters-hooks.js';

const {f, api} = defineProps<{ f: RaisedCosineFilter; api: OriginalFiltersAPI }>();
</script>

<template>
  <div class="filter-edit-body">
    <UIFixedField :field="NumberField.FILTER_FC_HZ" label="fc" :value="f.fc" @update:value="v => api.editRaisedCosine(f, {fc: v})" />
    <UIFixedField :field="NumberField.FILTER_GAIN_DB" label="Gain" :value="f.gain" @update:value="v => api.editRaisedCosine(f, {gain: v})" />
    <UIFixedField :field="NumberField.FILTER_BW_OCT" label="BW" :value="f.bwOct" @update:value="v => api.editRaisedCosine(f, {bwOct: v})" />
  </div>
</template>
