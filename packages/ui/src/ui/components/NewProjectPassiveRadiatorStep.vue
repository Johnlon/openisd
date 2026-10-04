<script setup lang="ts">
// The New Project wizard's passive-radiator step, as WinISD's wizard has it: choose a saved or
// bundled radiator, or define one, then its Vas / Qms / Fs / Sd / Xmax. Both skins show it.
import {NumberField} from '@openisd/design/fields';
import NumInput from './NumInput.vue';
import UnitToggle from './UnitToggle.vue';
import PRBrowser from './PRBrowser.vue';
import {inputValue} from '../../logic/domEvents.js';
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
    <button id="np-pr-select" class="np-pr-browse" title="Choose a saved or bundled passive radiator, or define a new one." @click="emit('browse')">{{ fullNames ? 'Select passive radiator' : 'Select PR' }} ▸</button>
    <PRBrowser v-if="browsing" @close="emit('closeBrowse')"
      @load="id => emit('loadSaved', id)" @load-bundled="id => emit('loadBundled', id)" @define="emit('define')" />
    <p class="np-pr-hint">Pick one above, or type the values straight in.</p>

    <!-- The same rows as the Edit passive radiator popup: label, fixed-width value, fixed-width unit. -->
    <div class="np-row">
      <label>{{ fullNames ? 'Passive radiator name' : 'PR name' }}</label>
      <input id="np-pr-name" class="np-pr-name" type="text" :value="radiator?.name ?? ''" placeholder="e.g. Dayton SD270A-88"
        @input="e => edits.setName(inputValue(e))">
    </div>
    <div class="np-row"><label>Vas</label><NumInput id="np-pr-vas" :model-value="radiator?.Vas_m3 ?? null" @update:model-value="(v: number | null) => edits.setVas_m3(v)" :field="NumberField.PR_VAS_L" unit-key="prVas" :precision="NumberField.PR_VAS_L.precision" /><UnitToggle :field="NumberField.PR_VAS_L" unit-key="prVas" unit-class="np-unit" /></div>
    <div class="np-row"><label>Qms</label><NumInput id="np-pr-qms" :model-value="radiator?.Qms ?? null" @update:model-value="(v: number | null) => edits.setQms(v)" :field="NumberField.PR_QMS" :precision="NumberField.PR_QMS.precision" /><span class="np-unit"></span></div>
    <div class="np-row"><label>Fs</label><NumInput id="np-pr-fs" :model-value="radiator?.Fs_hz ?? null" @update:model-value="(v: number | null) => edits.setFs_hz(v)" :field="NumberField.PR_FS_HZ" unit-key="prFs" :precision="NumberField.PR_FS_HZ.precision" /><UnitToggle :field="NumberField.PR_FS_HZ" unit-key="prFs" unit-class="np-unit" /></div>
    <div class="np-row"><label>Sd</label><NumInput id="np-pr-sd" :model-value="radiator?.Sd_m2 ?? null" @update:model-value="(v: number | null) => edits.setSd_m2(v)" :field="NumberField.PR_SD_CM2" unit-key="prSd" :precision="NumberField.PR_SD_CM2.precision" /><UnitToggle :field="NumberField.PR_SD_CM2" unit-key="prSd" unit-class="np-unit" /></div>
    <div class="np-row"><label>Xmax</label><NumInput id="np-pr-xmax" :model-value="radiator?.Xmax_m ?? null" @update:model-value="(v: number | null) => edits.setXmax_m(v)" :field="NumberField.PR_XMAX_MM" unit-key="prXmax" :precision="NumberField.PR_XMAX_MM.precision" /><UnitToggle :field="NumberField.PR_XMAX_MM" unit-key="prXmax" unit-class="np-unit" /></div>
  </div>
</template>

<style scoped>
.np-pr-step { margin-top: 10px; }
.np-pr-browse { width: 100%; min-height: 44px; border: 1px solid #999; background: #f0f0f0; color: #222; border-radius: 4px; font: inherit; cursor: pointer; }
.np-pr-hint { color: #555; font-size: 13px; margin: 8px 0 12px; }
/* One row per field, as in the Edit passive radiator popup: label, fixed-width value, fixed-width
   unit. Fixed widths so cycling a unit never reflows the row. NumInput renders a fragment, so its
   input is reached with :deep. */
.np-row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.np-row label { flex: 0 0 90px; color: #333; font-size: 13px; }
.np-row :deep(input) { flex: 0 0 auto; width: 110px; box-sizing: border-box; min-height: 40px; padding: 10px; border: 1px solid #999; border-radius: 4px; background: #fff; font: inherit; }
.np-row :deep(input.np-pr-name), .np-row input.np-pr-name { flex: 1; width: auto; min-width: 0; box-sizing: border-box; min-height: 40px; padding: 10px; border: 1px solid #999; border-radius: 4px; background: #fff; font: inherit; }
.np-unit { flex: 0 0 34px; width: 34px; color: #555; font-size: 13px; text-align: left; white-space: nowrap; }
</style>
