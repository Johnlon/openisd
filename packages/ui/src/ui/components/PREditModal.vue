<script setup lang="ts">
import {NumberField} from '@openisd/design/fields';
import NumInput from './NumInput.vue';
import UnitToggle from './UnitToggle.vue';
import {useEscToClose} from '../../logic/useEscToClose.js';
import {usePREditModal} from '../../hooks/PREditModal-hooks.js';

// PR "Edit" — a real popup (unlike Tune, this doesn't need the graph
// visible while typing: WinISD ref view_3_passive_radiator.png "Passive radiator
// parameters" box). Fields here describe the PR unit itself, not the box around it.

const emit = defineEmits<{ close: [] }>();

const {
  radiator,
  prFsWithMassShown,
  prLib,
  showPRLib,
  count,
  setCount,
  saveCurrentPR,
  loadPR,
  removePR,
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
        <button style="width:100%" @click="showPRLib = !showPRLib"
          title="Browse your saved passive radiators and load one into the current design">
          {{ showPRLib ? 'Hide PR library ▾' : 'Browse PR library… ▸' }}
        </button>
        <div v-if="showPRLib" class="pr-lib" style="margin:6px 0">
          <div v-if="!prLib.length" style="color:var(--mut);font-size:11px;padding:4px 0">No saved PRs yet — fill in the fields below and click Save.</div>
          <div v-for="e in prLib" :key="e.id" class="pr-lib-item">
            <span class="pr-lib-name" @click="loadPR(e.id)"
              :title="`Load ${e.name} — Sd=${e.sd} Mms=${e.mms} Cms=${e.cms}`">{{ e.name }}</span>
            <button class="pr-lib-del" @click="removePR(e.id)" title="Remove this PR from the library">✕</button>
          </div>
        </div>

        <div class="row">
          <label>PR name</label>
          <input style="flex:1" type="text" :value="radiator.model.value" @input="e => radiator.model.set(inputValue(e))" placeholder="e.g. Dayton SD270A-88">
        </div>
        <div class="row" data-field-key="prNum" :title="NumberField.PR_NUM.description">
          <label>PR count</label>
          <NumInput :model-value="count" @update:model-value="v => setCount(v ?? 0)" :field="NumberField.PR_NUM" :precision="0" step="1" />
          <span class="u"></span>
        </div>
        <div class="row" data-field-key="prSd" :title="NumberField.PR_SD_CM2.description">
          <label>Sd</label>
          <NumInput :model-value="radiator.spec.Sd_m2.value" @update:model-value="v => radiator.spec.Sd_m2.set(v ?? 0)" :field="NumberField.PR_SD_CM2" unit-key="prSd" group="area" base="cm2" :precision="4" />
          <UnitToggle field="prSd" group="area" base="cm2" unit-class="u" />
        </div>
        <div class="row" data-field-key="prXmax" :title="NumberField.PR_XMAX_MM.description">
          <label>Xmax</label>
          <NumInput :model-value="radiator.spec.Xmax_m.value" @update:model-value="v => radiator.spec.Xmax_m.set(v ?? 0)" :field="NumberField.PR_XMAX_MM" unit-key="prXmax" group="length" base="mm" :precision="3" />
          <UnitToggle field="prXmax" group="length" base="mm" unit-class="u" />
        </div>
        <div class="row" data-field-key="prFs" :title="NumberField.PR_FS_HZ.description">
          <label>Fs</label>
          <NumInput :model-value="radiator.spec.Fs_hz.value" :field="NumberField.PR_FS_HZ" :precision="4" @update:model-value="v => radiator.spec.Fs_hz.set(v ?? 0)" />
          <span class="u">Hz</span>
        </div>
        <div class="row" data-field-key="prFsMass" :title="NumberField.PR_FSMASS_HZ.description">
          <label>Fs (with mass)</label>
          <NumInput :model-value="prFsWithMassShown" :field="NumberField.PR_FSMASS_HZ" :precision="4" readonly />
          <span class="u">Hz</span>
        </div>
        <div class="row" data-field-key="prQms" :title="NumberField.PR_QMS.description">
          <label>Qms</label>
          <NumInput :model-value="radiator.spec.Qms.value" :field="NumberField.PR_QMS" :precision="3" @update:model-value="v => radiator.spec.Qms.set(v ?? 0)" />
          <span class="u"></span>
        </div>
        <div class="row" data-field-key="prVas" :title="NumberField.PR_VAS_L.description">
          <label>Vas</label>
          <NumInput :model-value="radiator.spec.Vas_m3.value" @update:model-value="v => radiator.spec.Vas_m3.set(v ?? 0)" :field="NumberField.PR_VAS_L" unit-key="prVas" group="volume" base="L" :precision="3" />
          <UnitToggle field="prVas" group="volume" base="L" unit-class="u" />
        </div>

        <div class="btns" style="margin-top:8px">
          <button @click="saveCurrentPR" title="Save these PR parameters to your library under the current PR name">Save to PR library</button>
          <button class="pri" @click="close" title="Close">Done</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pri { background: var(--acc); color: #fff; border-color: var(--acc); }
</style>
