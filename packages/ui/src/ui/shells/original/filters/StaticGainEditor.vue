<script setup lang="ts">
/** Display only: every edit is decided by `api.editStaticGain` (the engine's filters area), not here. */
import {NumberField} from '@openisd/design/fields';
import type {StaticGainFilter} from '@openisd/design/engine';
import UIFixedField from '../../../components/UIFixedField.vue';
import type {OriginalFiltersAPI} from '../../../../hooks/OriginalFilters-hooks.js';

const {f, api} = defineProps<{ f: StaticGainFilter; api: OriginalFiltersAPI }>();
</script>

<template>
  <div class="filter-edit-body">
    <UIFixedField :field="NumberField.FILTER_GAIN_DB" label="Gain" :value="f.gain" @update:value="v => api.editStaticGain(f, {gain: v})" />
  </div>
</template>
