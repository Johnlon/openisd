<script setup lang="ts">
import {limits} from '../../../../logic/fields/uiFields.js';
import {numFrom} from './numericInput.js';
import type {Filter} from '@openisd/design/engine';

type RaisedCosineFilter = Extract<Filter, { type: 'raisedCosine' }>;
const {f} = defineProps<{ f: RaisedCosineFilter }>();
const emit = defineEmits<{ replace: [next: RaisedCosineFilter] }>();
</script>

<template>
  <div class="filter-edit-body">
    <label>fc <input v-expo-step type="number" step="1" v-limits="limits('filterFc')" :value="f.fc" @change="emit('replace', {...f, fc: numFrom($event)})"> Hz</label>
    <label>Gain <input v-expo-step type="number" step="0.5" v-limits="limits('filterGain')" :value="f.gain" @change="emit('replace', {...f, gain: numFrom($event)})"> dB</label>
    <label>BW <input v-expo-step type="number" step="0.01" v-limits="limits('filterBw')" :value="f.bwOct" @change="emit('replace', {...f, bwOct: numFrom($event)})"> oct</label>
  </div>
</template>
