<script setup lang="ts">
// One port's own fields, as the Enclosure tab's vent panels show them: number of vents, shape, end
// correction, diameter (or width and height) and length, with the same entered/calculated colours
// and the same writes. Used by the What-if sheet's port overlay; a write lands wherever the project
// is writing (in the What-if layer while one is open).
import {END_CORRECTION_OPTIONS, NumberField, VENT_SHAPE_OPTIONS} from '@openisd/design/fields';
import {selectedOption} from '../../logic/domEvents.js';
import {VENT_GEOMETRY_TIP} from '../../hooks/ventReadouts.js';
import type {PortFieldsView} from '../../hooks/portFieldsView.js';
import UIField from './UIField.vue';

defineProps<{ port: PortFieldsView }>();
const VENT_COUNT_OPTIONS = NumberField.VENT_COUNT.countOptions();
</script>

<template>
  <div class="vpf-row">
    <label class="vpf-label">Number of Vents</label>
    <select class="vpf-select" :value="port.count"
            @change="e => { const n = selectedOption(e, VENT_COUNT_OPTIONS); if (n !== null) port.setCount(n); }">
      <option v-for="o in VENT_COUNT_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
  </div>
  <div class="vpf-row">
    <label class="vpf-label">Shape</label>
    <select class="vpf-select" :value="port.shape"
            @change="e => { const shape = selectedOption(e, VENT_SHAPE_OPTIONS); if (shape !== null) port.setShape(shape); }">
      <option v-for="o in VENT_SHAPE_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
  </div>
  <div class="vpf-row">
    <label class="vpf-label">End Correction</label>
    <select class="vpf-select" :value="port.endCorrection"
            @change="e => { const k = selectedOption(e, END_CORRECTION_OPTIONS); if (k !== null) port.setEndCorrection(k); }">
      <option v-for="o in END_CORRECTION_OPTIONS" :key="o.value" :value="o.value">{{ o.label }} ({{ o.value }})</option>
    </select>
  </div>
  <template v-if="port.shape === 'slotted'">
    <UIField class="mob-ui-field" :title="VENT_GEOMETRY_TIP" :field="NumberField.VENT_W_CM" :cell="port.width" stepper />
    <UIField class="mob-ui-field" :title="VENT_GEOMETRY_TIP" :field="NumberField.VENT_H_CM" :cell="port.height" stepper />
  </template>
  <UIField v-else class="mob-ui-field" :title="VENT_GEOMETRY_TIP" :field="NumberField.VENT_D_CM" :cell="port.diameter" stepper />
  <UIField class="mob-ui-field" :field="NumberField.VENT_L_CM" :cell="port.length" stepper />
</template>

<style scoped>
.vpf-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: var(--mob-row-pad-y) 12px;
  min-height: var(--mob-row-min);
  border-top: 1px solid var(--line);
}
.vpf-label { font-size: 14px; color: var(--fg); }
.vpf-select {
  flex: 1;
  max-width: 60%;
  min-height: 36px;
  padding: 6px 8px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: #fff;
  color: var(--fg);
  font: inherit;
  font-size: 14px;
}
</style>
