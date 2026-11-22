<script setup lang="ts">
import {NumberEditor} from '@openisd/design/fields';
import UIField from './UIField.vue';
import UIFixedField from './UIFixedField.vue';
import type {WhatIfBoxRow} from '../../hooks/OriginalWhatIf-hooks.js';

const props = defineProps<{row: WhatIfBoxRow; setValue: (row: WhatIfBoxRow, value: number) => void}>();

function label(): string {
  if (props.row.field.whatIfLabel !== null) return props.row.field.whatIfLabel;
  switch (props.row.field.slot) {
    case 'prAddedMass': return 'Added mass';
    default: return props.row.field.label;
  }
}

function cellForNumericField(row: WhatIfBoxRow) {
  if (row.cell === null) throw new Error(`What-if numeric field ${row.field.slot} has no editable cell`);
  return row.cell;
}
</script>

<template>
  <UIFixedField v-if="row.field.field.editor === NumberEditor.CountSelect" class="what-if-fld" :input-id="`what-if-${row.field.slot}`" :field="row.field.field" :label="label()" :value="row.value" @update:value="value => setValue(row, value)" />
  <UIField v-else class="what-if-fld"
           :title="row.field.slot === 'volume' ? 'Net acoustic internal volume — excludes driver displacement, port tube volume and bracing. Tried here only: the project is not changed. WinISD: Vb.' : row.field.label"
           :field="row.field.field" :label="label()" :cell="cellForNumericField(row)" />
</template>

<style scoped>
.what-if-fld { min-width:0; }
</style>
