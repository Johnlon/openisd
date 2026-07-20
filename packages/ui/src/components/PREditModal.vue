<script setup lang="ts">
import { computed, ref } from 'vue';
import { state } from '../store.js';
import { RHO, C, prVas as calcPrVas, prFs as calcPrFs, prQms as calcPrQms } from '@openisd/engine';
import { savePR, listPRs, deletePR, listBundledPRs } from '../utils/prLibrary.js';
import type { PRLibEntry, BundledPR } from '../types.js';
import NumInput from './NumInput.vue';
import { useEscToClose } from '../composables/useEscToClose.js';

// PR "Edit" — a real popup (unlike the driver What-If, this doesn't need the graph
// visible while typing: WinISD ref view_3_passive_radiator.png "Passive radiator
// parameters" box). Fields here describe the PR unit itself, not the box around it
// (that's BoxPanel's "Rear chamber" Fh) nor the tunable added-mass (PRWhatIfPanel).

const emit = defineEmits<{ close: [] }>();

const P = computed(() => state.P);
const prVas = computed(() => calcPrVas(P.value.prCms, P.value.prSd));
const prFsDisplay = computed(() => calcPrFs(P.value.prMmd, P.value.prCms));
const prQmsDisplay = computed(() => calcPrQms(P.value.prMmd, P.value.prCms, P.value.prRms));

function setWinIsdFs(newFsHz: number) {
  if (!(newFsHz > 0)) return;
  const Qms = prQmsDisplay.value || 5;
  const newMmd = 1 / ((2 * Math.PI * newFsHz) ** 2 * state.P.prCms);
  state.P.prMmd = newMmd;
  state.P.prRms = Math.sqrt(newMmd / state.P.prCms) / Qms;
}
function setWinIsdQms(newQms: number) {
  if (!(newQms > 0)) return;
  state.P.prRms = Math.sqrt(state.P.prMmd / state.P.prCms) / newQms;
}
function setWinIsdVas(newVasL: number) {
  if (!(newVasL > 0)) return;
  const Fs_curr = prFsDisplay.value || 30;
  const Qms_curr = prQmsDisplay.value || 5;
  const newCms = (newVasL / 1000) / (state.P.prSd * state.P.prSd * RHO * C * C);
  const newMmd = 1 / ((2 * Math.PI * Fs_curr) ** 2 * newCms);
  state.P.prCms = newCms;
  state.P.prMmd = newMmd;
  state.P.prRms = Math.sqrt(newMmd / newCms) / Qms_curr;
}

const prLib = ref(listPRs());
const bundledPRs = listBundledPRs();
const showPRLib = ref(false);
function saveCurrentPR() {
  const name = (state.P.prName || '').trim() || 'Custom PR';
  prLib.value = savePR(name, state.P);
}
function loadPR(entry: PRLibEntry) {
  state.P.prName = entry.name;
  state.P.prSd   = entry.prSd;
  state.P.prMmd  = entry.prMmd;
  state.P.prCms  = entry.prCms;
  state.P.prRms  = entry.prRms;
  state.P.prXmax = entry.prXmax;
  showPRLib.value = false;
}
function removePR(id: number) { prLib.value = deletePR(id); }

// Bundled PRs publish only Sd/Cms (Vas derives from them). Fs/Mms/Rms/Xmax are
// not in the datasheet, so they are blanked rather than left stale or fabricated.
function loadBundledPR(pr: BundledPR) {
  state.P.prName = pr.name;
  if (pr.Sd  != null) state.P.prSd  = pr.Sd;
  if (pr.Cms != null) state.P.prCms = pr.Cms;
  state.P.prMmd  = 0;
  state.P.prRms  = 0;
  state.P.prXmax = 0;
  showPRLib.value = false;
}

function close() { emit('close'); }
function onBackdrop(e: MouseEvent) { if (e.target === e.currentTarget) close(); }

// Mounted only while open (parent v-if), so it is always "open" for Escape purposes.
useEscToClose(() => true, close);
</script>

<template>
  <div class="overlay on" @click="onBackdrop">
    <div class="modal">
      <h2>Edit passive radiator<button class="x" @click="close" title="Close">✕</button></h2>
      <div class="body">
        <button style="width:100%" @click="showPRLib = !showPRLib"
          title="Browse your saved passive radiators and load one into the current design">
          {{ showPRLib ? 'Hide PR library ▾' : 'Browse PR library… ▸' }}
        </button>
        <div v-if="showPRLib" class="pr-lib" style="margin:6px 0">
          <div v-if="bundledPRs.length" class="pr-lib-hdr" title="Passive radiators bundled from the driver collections. Datasheets publish Sd/Cms/Vas only — Fs/Mms/Rms/Xmax are left blank for you to supply.">Bundled passive radiators</div>
          <div v-for="pr in bundledPRs" :key="pr.key + '/' + pr.path" class="pr-lib-item">
            <span class="pr-lib-name" @click="loadBundledPR(pr)"
              :title="'Load ' + pr.name + ' — Sd/Cms/Vas from the datasheet; Fs/Mms/Rms/Xmax not published, left blank'">{{ pr.name }}</span>
          </div>
          <div v-if="prLib.length" class="pr-lib-hdr">Saved</div>
          <div v-if="!prLib.length && !bundledPRs.length" style="color:var(--mut);font-size:11px;padding:4px 0">No saved PRs yet — fill in the fields below and click Save.</div>
          <div v-for="e in prLib" :key="e.id" class="pr-lib-item">
            <span class="pr-lib-name" @click="loadPR(e)">{{ e.name }}</span>
            <button class="pr-lib-del" @click="removePR(e.id)" title="Remove this PR from the library">✕</button>
          </div>
        </div>

        <div class="row" title="Name for this passive radiator">
          <label>PR name</label>
          <input style="flex:1" type="text" :value="state.P.prName" @input="e => state.P.prName = (e.target as HTMLInputElement).value" placeholder="e.g. Dayton SD270A-88">
        </div>
        <div class="row" title="Number of passive radiators in parallel">
          <label>PR count</label>
          <NumInput v-model="state.P.prNum" :scale="1" :precision="2" step="1" :min="1" />
          <span class="u"></span>
        </div>
        <div class="row" title="Effective piston area (from datasheet). WinISD: Sd.">
          <label>Sd</label>
          <NumInput v-model="state.P.prSd" :scale="1e4" :precision="4" />
          <span class="u">cm²</span>
        </div>
        <div class="row" title="Maximum linear one-way cone excursion (from datasheet). WinISD: Xmax.">
          <label>Xmax</label>
          <NumInput v-model="state.P.prXmax" :scale="1000" :precision="3" />
          <span class="u">mm</span>
        </div>
        <div class="row" title="PR free-air resonance (no added mass, no box). WinISD: Fs.">
          <label>Fs</label>
          <NumInput :model-value="prFsDisplay" :scale="1" :precision="4" @update:model-value="setWinIsdFs" />
          <span class="u">Hz</span>
        </div>
        <div class="row" title="Mechanical Q of the PR suspension. WinISD: Qms.">
          <label>Qms</label>
          <NumInput :model-value="prQmsDisplay" :scale="1" :precision="3" @update:model-value="setWinIsdQms" />
          <span class="u"></span>
        </div>
        <div class="row" title="Compliance volume. WinISD: Vas.">
          <label>Vas</label>
          <NumInput :model-value="prVas" :scale="1" :precision="3" @update:model-value="setWinIsdVas" />
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
