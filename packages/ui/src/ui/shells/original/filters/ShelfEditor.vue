<script setup lang="ts">
/** OpenISD-only low/high shelf editor — one component for both, they share every field. */
import {limits} from '../../../../logic/fields/uiFields.js';
import {numFrom} from './numericInput.js';
import type {Filter} from '@openisd/design/engine';

type ShelfFilter = Extract<Filter, { type: 'lowshelf' | 'highshelf' }>;
const {f} = defineProps<{ f: ShelfFilter }>();
const emit = defineEmits<{ replace: [next: ShelfFilter] }>();
</script>

<template>
  <div class="filter-edit-body">
    <label>fc <input v-expo-step type="number" step="1" v-limits="limits('filterFc')" :value="f.fc" @change="emit('replace', {...f, fc: numFrom($event)})"> Hz</label>
    <label>Q <input v-expo-step type="number" step="0.01" v-limits="limits('filterQ')" :value="f.Q" @change="emit('replace', {...f, Q: numFrom($event)})"></label>
    <label>Gain <input v-expo-step type="number" step="0.5" v-limits="limits('filterGain')" :value="f.gain" @change="emit('replace', {...f, gain: numFrom($event)})"> dB</label>
  </div>
</template>
