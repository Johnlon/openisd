<script setup lang="ts">
import {limits} from '../../../../logic/fields/uiFields.js';
import {numFrom} from './numericInput.js';
import type {Filter} from '@openisd/design/engine';

type StaticGainFilter = Extract<Filter, { type: 'staticGain' }>;
const {f} = defineProps<{ f: StaticGainFilter }>();
const emit = defineEmits<{ replace: [next: StaticGainFilter] }>();
</script>

<template>
  <div class="filter-edit-body">
    <label>Gain <input v-expo-step type="number" step="0.5" v-limits="limits('filterGain')" :value="f.gain" @change="emit('replace', {...f, gain: numFrom($event)})"> dB</label>
  </div>
</template>
