<script setup lang="ts">
import {NumberEditor} from '@openisd/design/fields';
import UIField from './UIField.vue';
import {selectedOption} from '../../logic/domEvents.js';
import type {WhatIfBoxRow} from '../../hooks/OriginalWhatIf-hooks.js';

const props = defineProps<{row: WhatIfBoxRow; setValue: (row: WhatIfBoxRow, value: number) => void}>();

function label(): string {
  if (props.row.field.whatIfLabel !== null) return props.row.field.whatIfLabel;
  switch (props.row.field.slot) {
    case 'prAddedMass': return 'Added mass';
    default: return props.row.field.label;
  }
}
</script>

<template>
  <div v-if="row.field.field.editor === NumberEditor.CountSelect" class="what-if-count-fld">
    <label :for="`what-if-${row.field.slot}`">{{ label() }}</label>
    <select :id="`what-if-${row.field.slot}`" :value="row.value ?? ''" :aria-label="row.field.label"
            @change="event => { const value = selectedOption(event, row.field.field.countOptions()); if (value !== null) setValue(row, Number(value)); }">
      <option v-for="option in row.field.field.countOptions()" :key="option.value" :value="option.value">{{ option.label }}</option>
    </select>
  </div>
  <UIField v-else class="what-if-fld"
           :title="row.field.slot === 'volume' ? 'Net acoustic internal volume — excludes driver displacement, port tube volume and bracing. Tried here only: the project is not changed. WinISD: Vb.' : row.field.label"
           :field="row.field.field" :label="label()" :cell="row.cell!" />
</template>

<style scoped>
.what-if-fld { min-width:0; }
.what-if-count-fld {
  display:grid;
  grid-template-columns:var(--label-w, 128px) var(--what-if-box-w, 114px) calc(2 * var(--ctl-stepper-w, 18px) + 2px) 24px;
  column-gap:2px; align-items:center; min-width:0;
}
.what-if-count-fld label { grid-column:1; justify-self:stretch; margin-right:22px; max-width:calc(100% - 22px); white-space:nowrap; font:inherit; color:#333; text-align:left; }
.what-if-count-fld select {
  grid-column:2; width:100%; min-width:0; height:var(--ctl-h, 28px); min-height:var(--ctl-h, 28px);
  box-sizing:border-box; border:1px solid var(--line, #c4c4c4); border-radius:3px;
  padding:0 6px; background:#fff; color:var(--fg, #222); font:inherit;
}
</style>
