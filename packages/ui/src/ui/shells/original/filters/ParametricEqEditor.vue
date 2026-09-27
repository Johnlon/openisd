<script setup lang="ts">
import {limits} from '../../../../logic/fields/uiFields.js';
import {numFrom} from './numericInput.js';
import type {Filter} from '@openisd/design/engine';

type PeakingFilter = Extract<Filter, { type: 'peaking' }>;
const {f} = defineProps<{ f: PeakingFilter }>();
const emit = defineEmits<{ replace: [next: PeakingFilter] }>();
</script>

<template>
  <div class="filter-edit-body">
    <label>fc <input v-expo-step type="number" step="1" v-limits="limits('filterFc')" :value="f.fc" @change="emit('replace', {...f, fc: numFrom($event)})"> Hz</label>
    <label>Gain <input v-expo-step type="number" step="0.5" v-limits="limits('filterGain')" :value="f.gain" @change="emit('replace', {...f, gain: numFrom($event)})"> dB</label>
    <label>Q <input v-expo-step type="number" step="0.01" v-limits="limits('filterQ')" :value="f.Q" @change="emit('replace', {...f, Q: numFrom($event)})"></label>
  </div>
</template>
