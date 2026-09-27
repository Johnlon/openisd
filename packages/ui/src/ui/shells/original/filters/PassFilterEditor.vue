<script setup lang="ts">
/** Lowpass/Highpass Filter Editor — one component for both, since they differ only in leading
 *  word and which side of the family's response they read (`PassFilter` on the engine side). */
import {limits} from '../../../../logic/fields/uiFields.js';
import {selectedOption} from '../../../../logic/domEvents.js';
import {numFrom, intFrom} from './numericInput.js';
import type {Filter, PassFamily} from '@openisd/design/engine';
import type {SelectorOption} from '@openisd/design/fields';

type PassFilter = Extract<Filter, { type: 'lowpass' | 'highpass' }>;
const {f} = defineProps<{ f: PassFilter }>();
const emit = defineEmits<{ replace: [next: PassFilter] }>();

/** WinISD's Filter Editor "Subtype" choices, its order and wording. */
const PASS_FAMILY_OPTIONS: readonly SelectorOption<PassFamily>[] = [
  { value: 'butterworth',   label: 'Butterworth' },
  { value: 'linkwitzRiley', label: 'Linkwitz-Riley (4th order only)' },
  { value: 'bessel',        label: 'Bessel' },
  { value: 'sos',           label: 'SOS, User specified fc and Q' },
];

function onFamily(e: Event): void {
  const family = selectedOption(e, PASS_FAMILY_OPTIONS);
  if (family !== null) emit('replace', {...f, family});
}
</script>

<template>
  <div class="filter-edit-body">
    <label>Subtype
      <select :value="f.family" @change="onFamily">
        <option v-for="o in PASS_FAMILY_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </label>
    <label>Order <input type="number" step="1" v-limits="limits('filterOrder')" :value="f.order" @change="emit('replace', {...f, order: intFrom($event)})"></label>
    <label>Q <input v-expo-step type="number" step="0.01" v-limits="limits('filterQ')" :value="f.Q" @change="emit('replace', {...f, Q: numFrom($event)})"></label>
    <label>Cutoff <input v-expo-step type="number" step="1" v-limits="limits('filterFc')" :value="f.fc" @change="emit('replace', {...f, fc: numFrom($event)})"> Hz</label>
  </div>
</template>
