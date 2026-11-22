<script setup lang="ts">
/** Display only: every edit is decided by `api.editParametricEq` (the engine's filters area), not here. */
import {NumberField} from '@openisd/design/fields';
import type {ParametricEqFilter} from '@openisd/design/engine';
import UIFixedField from '../../../components/UIFixedField.vue';
import type {OriginalFiltersAPI} from '../../../../hooks/OriginalFilters-hooks.js';

const {f, api} = defineProps<{ f: ParametricEqFilter; api: OriginalFiltersAPI }>();
</script>

<template>
  <div class="filter-edit-body">
    <UIFixedField :field="NumberField.FILTER_FC_HZ" label="fc" :value="f.fc" @update:value="v => api.editParametricEq(f, {fc: v})" />
    <UIFixedField :field="NumberField.FILTER_GAIN_DB" label="Gain" :value="f.gain" @update:value="v => api.editParametricEq(f, {gain: v})" />
    <UIFixedField :field="NumberField.FILTER_Q" label="Q" :value="f.Q" @update:value="v => api.editParametricEq(f, {Q: v})" />
  </div>
</template>
