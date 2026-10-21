<script setup lang="ts">
/** Display only: every edit is decided by `api.editLinkwitz` (the engine's filters area), not here. */
import {NumberField} from '@openisd/design/fields';
import type {LinkwitzFilter} from '@openisd/design/engine';
import UIFixedField from '../../../components/UIFixedField.vue';
import type {OriginalFiltersAPI} from '../../../../hooks/OriginalFilters-hooks.js';

const {f, api} = defineProps<{ f: LinkwitzFilter; api: OriginalFiltersAPI }>();
</script>

<template>
  <div class="filter-edit-body">
    <UIFixedField :field="NumberField.FILTER_FC_HZ" label="f0" :value="f.f0" @update:value="v => api.editLinkwitz(f, {f0: v})" />
    <UIFixedField :field="NumberField.FILTER_Q" label="Q0" :value="f.Q0" @update:value="v => api.editLinkwitz(f, {Q0: v})" />
    <UIFixedField :field="NumberField.FILTER_FC_HZ" label="fp" :value="f.fp" @update:value="v => api.editLinkwitz(f, {fp: v})" />
    <UIFixedField :field="NumberField.FILTER_Q" label="Qp" :value="f.Qp" @update:value="v => api.editLinkwitz(f, {Qp: v})" />
  </div>
</template>
