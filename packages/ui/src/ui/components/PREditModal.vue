<script setup lang="ts">
import { computed, ref } from 'vue';
import { managedProject } from '../../logic/appState.js';
import { createLiveRef } from '../../logic/liveProject.js';
import type { PRLibEntry } from '@openisd/persistence';
import NumInput from './NumInput.vue';
import { useApp } from '../../logic/app.js';

const { prRepo } = useApp();

// PR "Edit" — a real popup (unlike the driver What-If, this doesn't need the graph
// visible while typing: WinISD ref view_3_passive_radiator.png "Passive radiator
// parameters" box). Fields here describe the PR unit itself, not the box around it.

import { useEscToClose } from '../../logic/useEscToClose.js';

const emit = defineEmits<{ close: [] }>();
useEscToClose(() => true, close);

const { live } = createLiveRef(managedProject);
// The datasheet vocabulary is the DOMAIN's own keyed surface now: cells read the derived
// views (SI — the ×1000 below is the litre display this dialog shows), entries re-solve the
// canonical Sd/Cms/Mmd/Rms with the ruled holds inside the domain object.
const prVas = computed(() => { void live.value; return managedProject.projectCell('prVas').value * 1000; });
const prFsShown = computed(() => { void live.value; return managedProject.projectCell('prFs').value; });
const prFsWithMassShown = computed(() => { void live.value; return managedProject.projectCell('prFsMass').value; });
const prQmsShown = computed(() => { void live.value; return managedProject.projectCell('prQms').value; });

function setWinIsdFs(newFsHz: number) { managedProject.enterProjectField('prFs', newFsHz); }
function setWinIsdQms(newQms: number) { managedProject.enterProjectField('prQms', newQms); }
function setWinIsdVas(newVasL: number) { managedProject.enterProjectField('prVas', newVasL / 1000); }

// No per-field computed wrapper for name/count/Sd/Xmax (`docs/design/REACTIVITY.md`) — the
// template below reads `managedProject`'s own getter directly (reactive via `live`) and
// writes through its own setter directly.

const prLib = ref(prRepo.list());
const showPRLib = ref(false);
function saveCurrentPR() {
  const name = (managedProject.prField('name') || '').trim() || 'Custom PR';
  prLib.value = prRepo.save(name, managedProject.toUiParams());
}
function loadPR(entry: PRLibEntry) {
  managedProject.setPrField('name', entry.name);
  managedProject.setPrField('Sd_m2', entry.prSd);
  managedProject.setPrField('Mmd_kg', entry.prMmd);
  managedProject.setPrField('Cms_m_per_N', entry.prCms);
  managedProject.setPrField('Rms_Ns_per_m', entry.prRms);
  managedProject.setPrField('Xmax_m', entry.prXmax);
  showPRLib.value = false;
}
function removePR(id: number) { prLib.value = prRepo.remove(id); }

function close() { emit('close'); }
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
            <span class="pr-lib-name" @click="loadPR(e)">{{ e.name }}</span>
            <button class="pr-lib-del" @click="removePR(e.id)" title="Remove this PR from the library">✕</button>
          </div>
        </div>

        <div class="row" title="Name for this passive radiator">
          <label>PR name</label>
          <input style="flex:1" type="text" :value="live && managedProject.prField('name')" @input="e => managedProject.setPrField('name', (e.target as HTMLInputElement).value)" placeholder="e.g. Dayton SD270A-88">
        </div>
        <div class="row" title="Number of passive radiators in parallel">
          <label>PR count</label>
          <NumInput :model-value="live && managedProject.prCount()" @update:model-value="v => managedProject.setPrCount(v ?? 0)" :scale="1" :precision="2" step="1" :min="1" />
          <span class="u"></span>
        </div>
        <div class="row" title="Effective piston area (from datasheet). WinISD: Sd.">
          <label>Sd</label>
          <NumInput :model-value="live && managedProject.prField('Sd_m2')" @update:model-value="v => managedProject.setPrField('Sd_m2', v ?? 0)" :scale="1e4" :precision="4" />
          <span class="u">cm²</span>
        </div>
        <div class="row" title="Maximum linear one-way cone excursion (from datasheet). WinISD: Xmax.">
          <label>Xmax</label>
          <NumInput :model-value="live && managedProject.prField('Xmax_m')" @update:model-value="v => managedProject.setPrField('Xmax_m', v ?? 0)" :scale="1000" :precision="3" />
          <span class="u">mm</span>
        </div>
        <div class="row" title="PR free-air resonance (no added mass, no box). WinISD: Fs.">
          <label>Fs</label>
          <NumInput :model-value="prFsShown" :scale="1" :precision="4" @update:model-value="v => setWinIsdFs(v ?? 0)" />
          <span class="u">Hz</span>
        </div>
        <div class="row" title="PR resonance WITH the added mass — the tuned, not free-air, frequency. Depends on the box's added-mass setting; read-only here.">
          <label>Fs (with mass)</label>
          <NumInput :model-value="prFsWithMassShown" :scale="1" :precision="4" readonly />
          <span class="u">Hz</span>
        </div>
        <div class="row" title="Mechanical Q of the PR suspension. WinISD: Qms.">
          <label>Qms</label>
          <NumInput :model-value="prQmsShown" :scale="1" :precision="3" @update:model-value="v => setWinIsdQms(v ?? 0)" />
          <span class="u"></span>
        </div>
        <div class="row" title="Compliance volume. WinISD: Vas.">
          <label>Vas</label>
          <NumInput :model-value="prVas" :scale="1" :precision="3" @update:model-value="v => setWinIsdVas(v ?? 0)" />
          <span class="u">L</span>
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
