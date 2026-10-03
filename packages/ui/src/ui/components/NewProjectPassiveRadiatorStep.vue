<script setup lang="ts">
// The New Project wizard's passive-radiator step, as WinISD's wizard has it: choose a saved or
// bundled radiator, or define one, then its Vas / Qms / Fs / Sd / Xmax. Both skins show it.
import {NumberField} from '@openisd/design/fields';
import NumInput from './NumInput.vue';
import UnitToggle from './UnitToggle.vue';
import PRBrowser from './PRBrowser.vue';
import type {PassiveRadiatorStepEdits, PassiveRadiatorStepView} from '../../hooks/OriginalNewProject-hooks.js';

interface Props {
  radiator: PassiveRadiatorStepView | null;
  edits: PassiveRadiatorStepEdits;
  /** The PR picker is open over the step. */
  browsing: boolean;
}

defineProps<Props>();
const emit = defineEmits<{
  loadSaved: [string];
  loadBundled: [string];
  define: [];
  browse: [];
  closeBrowse: [];
}>();
</script>

<template>
  <div class="np-pr-step">
    <div class="field-row">
      <div class="field"><label>PR</label>
        <input id="np-pr-name" type="text" style="width:220px" readonly
          :value="radiator === null ? 'None chosen' : radiator.name">
      </div>
      <button id="np-pr-select" class="edit-btn" title="Choose a saved or bundled passive radiator, or define a new one." @click="emit('browse')">Select PR</button>
    </div>
    <PRBrowser v-if="browsing" @close="emit('closeBrowse')"
      @load="id => emit('loadSaved', id)" @load-bundled="id => emit('loadBundled', id)" @define="emit('define')" />
    <template v-if="radiator !== null">
      <div class="field-row">
        <div class="field"><label>Vas</label><NumInput id="np-pr-vas" :model-value="radiator.Vas_m3" @update:model-value="(v: number | null) => edits.setVas_m3(v)" :field="NumberField.PR_VAS_L" unit-key="prVas" :precision="NumberField.PR_VAS_L.precision" /><UnitToggle :field="NumberField.PR_VAS_L" unit-key="prVas" unit-class="unit unit-cyc" /></div>
        <div class="field"><label>Qms</label><NumInput id="np-pr-qms" :model-value="radiator.Qms" @update:model-value="(v: number | null) => edits.setQms(v)" :field="NumberField.PR_QMS" :precision="NumberField.PR_QMS.precision" /></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Fs</label><NumInput id="np-pr-fs" :model-value="radiator.Fs_hz" @update:model-value="(v: number | null) => edits.setFs_hz(v)" :field="NumberField.PR_FS_HZ" unit-key="prFs" :precision="NumberField.PR_FS_HZ.precision" /><UnitToggle :field="NumberField.PR_FS_HZ" unit-key="prFs" unit-class="unit unit-cyc" /></div>
        <div class="field"><label>Sd</label><NumInput id="np-pr-sd" :model-value="radiator.Sd_m2" @update:model-value="(v: number | null) => edits.setSd_m2(v)" :field="NumberField.PR_SD_CM2" unit-key="prSd" :precision="NumberField.PR_SD_CM2.precision" /><UnitToggle :field="NumberField.PR_SD_CM2" unit-key="prSd" unit-class="unit unit-cyc" /></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Xmax</label><NumInput id="np-pr-xmax" :model-value="radiator.Xmax_m" @update:model-value="(v: number | null) => edits.setXmax_m(v)" :field="NumberField.PR_XMAX_MM" unit-key="prXmax" :precision="NumberField.PR_XMAX_MM.precision" /><UnitToggle :field="NumberField.PR_XMAX_MM" unit-key="prXmax" unit-class="unit unit-cyc" /></div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.np-pr-step { margin-top: 10px; }
.field-row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
.field { display: flex; align-items: center; gap: 6px; }
.field label { color: #333; display: inline-block; min-width: 80px; }
.field input { border: 1px solid #999; padding: 4px 6px; border-radius: 2px; background: #fff; width: 140px; }
.field .unit { color: #555; }
.edit-btn { border: 1px solid #999; background: #f0f0f0; color: #222; border-radius: 3px; padding: 4px 10px; cursor: pointer; font-size: 12px; }
.edit-btn:hover { background: #dbeaff; border-color: #7fb3ff; }

/* Mobile: stack fields vertically on small screens */
@media (max-width: 640px) {
  .field-row { flex-direction: column; align-items: stretch; }
  .field { flex-direction: column; }
  .field label { min-width: auto; }
  .field input { width: 100%; }
}
</style>
