<script setup lang="ts">
import {limits} from '../../../../logic/fields/uiFields.js';
import {numFrom, intFrom} from './numericInput.js';
import type {Filter} from '@openisd/design/engine';

type AllpassFilter = Extract<Filter, { type: 'allpass' }>;
const {f} = defineProps<{ f: AllpassFilter }>();
const emit = defineEmits<{ replace: [next: AllpassFilter] }>();
</script>

<template>
  <div class="filter-edit-body">
    <label>Order <input type="number" step="1" v-limits="limits('filterOrder')" :value="f.order" @change="emit('replace', {...f, order: intFrom($event)})"></label>
    <label>Q <input v-expo-step type="number" step="0.01" v-limits="limits('filterQ')" :value="f.Q" @change="emit('replace', {...f, Q: numFrom($event)})"></label>
    <label>t <input v-expo-step type="number" step="0.001" v-limits="limits('filterT')" :value="f.t" @change="emit('replace', {...f, t: numFrom($event)})"> s</label>
  </div>
</template>
