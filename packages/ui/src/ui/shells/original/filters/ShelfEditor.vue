<script setup lang="ts">
/** OpenISD-only low/high shelf editor — one component for both, they share every field.
 *  Display only: every edit is decided by `api.editShelf` (the engine's filters area), not here. */
import {NumberField} from '@openisd/design/fields';
import type {ShelfFilter} from '@openisd/design/engine';
import UIFixedField from '../../../components/UIFixedField.vue';
import type {OriginalFiltersAPI} from '../../../../hooks/OriginalFilters-hooks.js';

const {f, api} = defineProps<{ f: ShelfFilter; api: OriginalFiltersAPI }>();
</script>

<template>
  <div class="filter-edit-body">
    <UIFixedField :field="NumberField.FILTER_FC_HZ" label="fc" :value="f.fc" @update:value="v => api.editShelf(f, {fc: v})" />
    <UIFixedField :field="NumberField.FILTER_Q" label="Q" :value="f.Q" @update:value="v => api.editShelf(f, {Q: v})" />
    <UIFixedField :field="NumberField.FILTER_GAIN_DB" label="Gain" :value="f.gain" @update:value="v => api.editShelf(f, {gain: v})" />
  </div>
</template>
