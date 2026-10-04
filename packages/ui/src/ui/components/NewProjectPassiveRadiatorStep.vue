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
  /** Spell out "passive radiator" instead of WinISD's "PR" (the mobile skin). */
  fullNames?: boolean;
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
      <div class="field"><label>{{ fullNames ? 'Passive radiator' : 'PR' }}</label>
        <input id="np-pr-name" class="np-pr-name" type="text" readonly
          :value="radiator === null ? 'None chosen' : radiator.name">
      </div>
      <button id="np-pr-select" class="edit-btn" title="Choose a saved or bundled passive radiator, or define a new one." @click="emit('browse')">{{ fullNames ? 'Select passive radiator' : 'Select PR' }}</button>
    </div>
    <PRBrowser v-if="browsing" @close="emit('closeBrowse')"
      @load="id => emit('loadSaved', id)" @load-bundled="id => emit('loadBundled', id)" @define="emit('define')" />
    <template v-if="radiator !== null">
      <div class="field-row">
        <div class="field"><label>Vas</label><div class="field-inline"><NumInput id="np-pr-vas" :model-value="radiator.Vas_m3" @update:model-value="(v: number | null) => edits.setVas_m3(v)" :field="NumberField.PR_VAS_L" unit-key="prVas" :precision="NumberField.PR_VAS_L.precision" /><UnitToggle :field="NumberField.PR_VAS_L" unit-key="prVas" unit-class="unit unit-cyc" /></div></div>
        <div class="field"><label>Qms</label><div class="field-inline"><NumInput id="np-pr-qms" :model-value="radiator.Qms" @update:model-value="(v: number | null) => edits.setQms(v)" :field="NumberField.PR_QMS" :precision="NumberField.PR_QMS.precision" /></div></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Fs</label><div class="field-inline"><NumInput id="np-pr-fs" :model-value="radiator.Fs_hz" @update:model-value="(v: number | null) => edits.setFs_hz(v)" :field="NumberField.PR_FS_HZ" unit-key="prFs" :precision="NumberField.PR_FS_HZ.precision" /><UnitToggle :field="NumberField.PR_FS_HZ" unit-key="prFs" unit-class="unit unit-cyc" /></div></div>
        <div class="field"><label>Sd</label><div class="field-inline"><NumInput id="np-pr-sd" :model-value="radiator.Sd_m2" @update:model-value="(v: number | null) => edits.setSd_m2(v)" :field="NumberField.PR_SD_CM2" unit-key="prSd" :precision="NumberField.PR_SD_CM2.precision" /><UnitToggle :field="NumberField.PR_SD_CM2" unit-key="prSd" unit-class="unit unit-cyc" /></div></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Xmax</label><div class="field-inline"><NumInput id="np-pr-xmax" :model-value="radiator.Xmax_m" @update:model-value="(v: number | null) => edits.setXmax_m(v)" :field="NumberField.PR_XMAX_MM" unit-key="prXmax" :precision="NumberField.PR_XMAX_MM.precision" /><UnitToggle :field="NumberField.PR_XMAX_MM" unit-key="prXmax" unit-class="unit unit-cyc" /></div></div>
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
.field-inline { display: flex; align-items: center; gap: 8px; }
.np-pr-name { width: 220px; }
.edit-btn { border: 1px solid #999; background: #f0f0f0; color: #222; border-radius: 3px; padding: 4px 10px; cursor: pointer; font-size: 12px; }
.edit-btn:hover { background: #dbeaff; border-color: #7fb3ff; }

/* Mobile: stack fields vertically on small screens */
@media (max-width: 640px) {
  .field-row { flex-direction: column; align-items: stretch; }
  .field { flex-direction: column; align-items: stretch; gap: 4px; }
  .field label { min-width: auto; text-align: left; font-size: 13px; color: #555; }
  .field input { width: 100%; min-height: 40px; padding: 10px; border-radius: 4px; font: inherit; }
  .field-inline { width: 100%; }
  /* NumInput is a fragment (input + optional stepper), so its input is reached with :deep. */
  .field-inline :deep(input) { flex: 1; width: auto; min-width: 0; box-sizing: border-box; min-height: 40px; padding: 10px; border: 1px solid #999; border-radius: 4px; background: #fff; font: inherit; }
  .field-inline .unit { flex: 0 0 3.5em; }
  .np-pr-name { width: 100%; }
  .edit-btn { padding: 10px; font-size: 14px; }
}
</style>
