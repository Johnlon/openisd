<script setup lang="ts">
import {NumberField} from '@openisd/design/fields';
import NumInput from './NumInput.vue';
import UnitToggle from './UnitToggle.vue';
import {useEscToClose} from '../../logic/useEscToClose.js';
import {selectedOption} from '../../logic/domEvents.js';
import {usePREditModal} from '../../hooks/PREditModal-hooks.js';

// PR "Edit" — a real popup (unlike Tune, this doesn't need the graph
// visible while typing: WinISD ref passive-radiator-tab.png "Passive radiator
// parameters" box). Fields here describe the PR unit itself, not the box around it.

const emit = defineEmits<{ close: []; browse: [] }>();

const {
  radiator,
  prFsWithMassShown,
  count,
  setCount,
  countOptions,
  saveCurrentPR,
  close,
  inputValue,
} = usePREditModal(emit);

useEscToClose(() => true, close);
</script>

<template>
  <div class="overlay on">
    <div class="modal">
      <h2>Edit passive radiator<button class="x" @click="close" title="Close">✕</button></h2>
      <div class="body">
        <button style="width:100%" @click="emit('browse')"
          title="Back to the passive radiator library — your saved passive radiators, the bundled catalogue, or define a new one">
          Browse passive radiator library… ▸
        </button>

        <div class="row">
          <label>Passive radiator name</label>
          <input style="flex:1" type="text" :value="radiator.model.value" @input="e => radiator.model.set(inputValue(e))" placeholder="e.g. Dayton SD270A-88">
        </div>
        <div class="row" data-field-key="prNum" :title="NumberField.PR_NUM.description">
          <label>Passive radiator count</label>
          <select id="pr-edit-count" :value="count" @change="e => { const n = selectedOption(e, countOptions); if (n !== null) setCount(n); }"><option v-for="o in countOptions" :key="o.value" :value="o.value">{{ o.label }}</option></select>
          <span class="u"></span>
        </div>
        <div class="row" data-field-key="prSd" :title="NumberField.PR_SD_CM2.description">
          <label>Sd</label>
          <NumInput :model-value="radiator.spec.Sd_m2.value" @update:model-value="v => radiator.spec.Sd_m2.set(v ?? 0)" :field="NumberField.PR_SD_CM2" unit-key="prSd" :precision="4" />
          <UnitToggle :field="NumberField.PR_SD_CM2" unit-key="prSd" unit-class="u" />
        </div>
        <div class="row" data-field-key="prXmax" :title="NumberField.PR_XMAX_MM.description">
          <label>Xmax</label>
          <NumInput :model-value="radiator.spec.Xmax_m.value" @update:model-value="v => radiator.spec.Xmax_m.set(v ?? 0)" :field="NumberField.PR_XMAX_MM" unit-key="prXmax" :precision="3" />
          <UnitToggle :field="NumberField.PR_XMAX_MM" unit-key="prXmax" unit-class="u" />
        </div>
        <div class="row" data-field-key="prFs" :title="NumberField.PR_FS_HZ.description">
          <label>Fs</label>
          <NumInput :model-value="radiator.spec.Fs_hz.value" :field="NumberField.PR_FS_HZ" :precision="4" @update:model-value="v => radiator.spec.Fs_hz.set(v ?? 0)" />
          <UnitToggle :field="NumberField.PR_FS_HZ" unit-key="prFs" unit-class="u" />
        </div>
        <div class="row" data-field-key="prFsMass" :title="NumberField.PR_FSMASS_HZ.description">
          <label>Fs (with mass)</label>
          <NumInput :model-value="prFsWithMassShown" :field="NumberField.PR_FSMASS_HZ" :precision="4" readonly />
          <UnitToggle :field="NumberField.PR_FSMASS_HZ" unit-key="prFsMass" unit-class="u" />
        </div>
        <div class="row" data-field-key="prQms" :title="NumberField.PR_QMS.description">
          <label>Qms</label>
          <NumInput :model-value="radiator.spec.Qms.value" :field="NumberField.PR_QMS" :precision="3" @update:model-value="v => radiator.spec.Qms.set(v ?? 0)" />
          <span class="u"></span>
        </div>
        <div class="row" data-field-key="prVas" :title="NumberField.PR_VAS_L.description">
          <label>Vas</label>
          <NumInput :model-value="radiator.spec.Vas_m3.value" @update:model-value="v => radiator.spec.Vas_m3.set(v ?? 0)" :field="NumberField.PR_VAS_L" unit-key="prVas" :precision="3" />
          <UnitToggle :field="NumberField.PR_VAS_L" unit-key="prVas" unit-class="u" />
        </div>

        <div class="btns" style="margin-top:8px">
          <button @click="saveCurrentPR" title="Save these passive radiator parameters to your library under the current passive radiator name">Save to passive radiator library</button>
          <button class="pri" @click="close" title="Close">Done</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pri { background: var(--acc); color: #fff; border-color: var(--acc); }
</style>
