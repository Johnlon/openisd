<script setup lang="ts">
import {limits} from '../../../../logic/fields/uiFields.js';
import {numFrom} from './numericInput.js';
import type {Filter} from '@openisd/design/engine';

type PeakHighpassFilter = Extract<Filter, { type: 'peakHighpass' }>;
const {f} = defineProps<{ f: PeakHighpassFilter }>();
const emit = defineEmits<{ replace: [next: PeakHighpassFilter] }>();
</script>

<template>
  <div class="filter-edit-body">
    <label>Gpk <input v-expo-step type="number" step="0.5" v-limits="limits('filterGain')" :value="f.gainPk" @change="emit('replace', {...f, gainPk: numFrom($event)})"> dB</label>
    <label>fpk <input v-expo-step type="number" step="1" v-limits="limits('filterFc')" :value="f.fpk" @change="emit('replace', {...f, fpk: numFrom($event)})"> Hz</label>
  </div>
</template>
