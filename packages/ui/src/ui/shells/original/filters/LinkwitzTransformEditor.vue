<script setup lang="ts">
import {limits} from '../../../../logic/fields/uiFields.js';
import {numFrom} from './numericInput.js';
import type {Filter} from '@openisd/design/engine';

type LinkwitzFilter = Extract<Filter, { type: 'linkwitz' }>;
const {f} = defineProps<{ f: LinkwitzFilter }>();
const emit = defineEmits<{ replace: [next: LinkwitzFilter] }>();
</script>

<template>
  <div class="filter-edit-body">
    <label>f0 <input v-expo-step type="number" step="1" v-limits="limits('filterFc')" :value="f.f0" @change="emit('replace', {...f, f0: numFrom($event)})"> Hz</label>
    <label>Q0 <input v-expo-step type="number" step="0.01" v-limits="limits('filterQ')" :value="f.Q0" @change="emit('replace', {...f, Q0: numFrom($event)})"></label>
    <label>fp <input v-expo-step type="number" step="1" v-limits="limits('filterFc')" :value="f.fp" @change="emit('replace', {...f, fp: numFrom($event)})"> Hz</label>
    <label>Qp <input v-expo-step type="number" step="0.01" v-limits="limits('filterQ')" :value="f.Qp" @change="emit('replace', {...f, Qp: numFrom($event)})"></label>
  </div>
</template>
