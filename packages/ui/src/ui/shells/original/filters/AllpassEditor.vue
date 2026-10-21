<script setup lang="ts">
/** Display only: every edit is decided by `api.editAllpass` (the engine's filters area), not here. */
import {NumberField, WinisdFilterDeviation} from '@openisd/design/fields';
import type {AllpassFilter} from '@openisd/design/engine';
import UIFixedField from '../../../components/UIFixedField.vue';
import type {OriginalFiltersAPI} from '../../../../hooks/OriginalFilters-hooks.js';

const {f, api} = defineProps<{ f: AllpassFilter; api: OriginalFiltersAPI }>();
</script>

<template>
  <div class="filter-edit-body">
    <UIFixedField :field="NumberField.FILTER_ORDER" label="Order" :value="f.order" :deviation="api.deviationShown(WinisdFilterDeviation.ALLPASS_ORDER, f) ? WinisdFilterDeviation.ALLPASS_ORDER : undefined" @update:value="v => api.editAllpass(f, {order: v})" />
    <UIFixedField :field="NumberField.FILTER_Q" label="Q" :value="f.Q" @update:value="v => api.editAllpass(f, {Q: v})" />
    <UIFixedField :field="NumberField.FILTER_T_S" label="t" :value="f.t" @update:value="v => api.editAllpass(f, {t: v})" />
  </div>
</template>
