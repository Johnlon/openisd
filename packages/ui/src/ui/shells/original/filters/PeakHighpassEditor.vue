<script setup lang="ts">
/** Display only: every edit is decided by `api.editPeakHighpass` (the engine's filters area), not here. */
import {NumberField} from '@openisd/design/fields';
import type {PeakHighpassFilter} from '@openisd/design/engine';
import UIFixedField from '../../../components/UIFixedField.vue';
import type {OriginalFiltersAPI} from '../../../../hooks/OriginalFilters-hooks.js';

const {f, api} = defineProps<{ f: PeakHighpassFilter; api: OriginalFiltersAPI }>();
</script>

<template>
  <div class="filter-edit-body">
    <UIFixedField :field="NumberField.FILTER_GAIN_DB" label="Gpk" :value="f.gainPk" @update:value="v => api.editPeakHighpass(f, {gainPk: v})" />
    <UIFixedField :field="NumberField.FILTER_FC_HZ" label="fpk" :value="f.fpk" @update:value="v => api.editPeakHighpass(f, {fpk: v})" />
  </div>
</template>
