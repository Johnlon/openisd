<script setup lang="ts">
// The rows of one Linkwitz transform filter card: standard field rows. Every edit is decided by the engine through `api`.
import {NumberField, PhoneLabels} from '@openisd/design/fields';
import type {LinkwitzFilter} from '@openisd/design/engine';
import UIFixedField from '../../../components/UIFixedField.vue';
import type {OriginalFiltersAPI} from '../../../../hooks/OriginalFilters-hooks.js';

const {f, api} = defineProps<{ f: LinkwitzFilter; api: OriginalFiltersAPI }>();
</script>

<template>
  <UIFixedField class="mob-ui-field" :field="NumberField.PHONE_FILTER_FC_HZ" :label="PhoneLabels.F0" :value="f.f0" stepper @update:value="v => api.editLinkwitz(f, {f0: v})" />
  <UIFixedField class="mob-ui-field" :field="NumberField.FILTER_Q" :label="PhoneLabels.Q0" :value="f.Q0" stepper @update:value="v => api.editLinkwitz(f, {Q0: v})" />
  <UIFixedField class="mob-ui-field" :field="NumberField.PHONE_FILTER_FC_HZ" :label="PhoneLabels.FP" :value="f.fp" stepper @update:value="v => api.editLinkwitz(f, {fp: v})" />
  <UIFixedField class="mob-ui-field" :field="NumberField.FILTER_Q" :label="PhoneLabels.QP" :value="f.Qp" stepper @update:value="v => api.editLinkwitz(f, {Qp: v})" />
</template>
