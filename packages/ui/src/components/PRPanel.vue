<script setup lang="ts">
import { computed, ref } from 'vue';
import { state, driver } from '../store.js';
import { prTuning, prMassForFp, ventedAlignment, RHO, C,
         prVas as calcPrVas, prFs as calcPrFs, prFsWithMass as calcPrFsMass, prQms as calcPrQms } from '@openisd/engine';
import { savePR } from '../utils/prLibrary.js';
import type { PRLibEntry, BundledPR } from '../types.js';
import NumInput from './NumInput.vue';
import PRBrowser from './PRBrowser.vue';
import PRDefineModal from './PRDefineModal.vue';
import { precision as fieldDp } from '../fields/fieldRegistry.js';

const P = computed(() => state.P);
const drv = driver;

const fp = computed(() => prTuning(P.value));

const prVas = computed(() => calcPrVas(P.value.prCms, P.value.prSd));
const prFsDisplay = computed(() => calcPrFs(P.value.prMmd, P.value.prCms));
const prQmsDisplay = computed(() => calcPrQms(P.value.prMmd, P.value.prCms, P.value.prRms));
// Free-air resonance with added mass (no box) — WinISD "Fs with added mass" cross-check
const prFsLoaded = computed(() => calcPrFsMass(P.value.prMmd, P.value.prMadd, P.value.prCms));

// WinISD mode handlers — each reads Fs/Qms from canonical T/S at full precision,
// then rewrites the affected T/S fields while holding the other two WinISD params fixed.
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

function autoPRMass() {
  if (!drv.value) return;
  const target = ventedAlignment(drv.value).Fb;
  const totalMass = prMassForFp(state.P, target);
  state.P.prMadd = Math.max(0, totalMass - state.P.prMmd);
}

const editPR = ref(false);
const browseOpen = ref(false);

function saveCurrentPR() {
  const name = (state.P.prName || '').trim() || 'Custom PR';
  savePR(name, state.P);
}

// Load a saved PR-library entry into the current design.
function loadPR(entry: PRLibEntry) {
  state.P.prName = entry.name;
  state.P.prSd   = entry.prSd;
  state.P.prMmd  = entry.prMmd;
  state.P.prCms  = entry.prCms;
  state.P.prRms  = entry.prRms;
  state.P.prXmax = entry.prXmax;
  browseOpen.value = false;
  editPR.value = false;
}

// Load a bundled PR. Datasheets publish only Sd/Cms (Vas derives) — Fs/Mms/Rms/Xmax
// are not on the sheet, so they are blanked rather than left stale or fabricated
// (mirrors PREditModal.loadBundledPR).
function loadBundledPR(pr: BundledPR) {
  state.P.prName = pr.name;
  if (pr.Sd  != null) state.P.prSd  = pr.Sd;
  if (pr.Cms != null) state.P.prCms = pr.Cms;
  state.P.prMmd  = 0;
  state.P.prRms  = 0;
  state.P.prXmax = 0;
  browseOpen.value = false;
  editPR.value = true;   // open the editor so the user can supply the blank fields
}

// Define a brand-new PR from scratch — open a BLANK buffered define modal (the PR
// analogue of the driver browser's "Add new Driver" → DriverDefineModal, which comes
// up empty). It only writes to the live design on Create, so blank fields never
// corrupt state.P mid-entry.
const defineOpen = ref(false);
function defineNewPR() {
  browseOpen.value = false;
  defineOpen.value = true;
}
</script>

<template>
  <!-- PR library — two buttons mirroring the Driver panel (Browse / Define new) -->
  <div class="row" style="margin-bottom:6px">
    <button style="flex:1" @click="browseOpen = true"
      title="Browse bundled + saved passive radiators — click one to load it into the current design">Browse / Select…</button>
    <button style="flex:1" @click="defineOpen = true"
      title="Enter parameters from a datasheet to create a new custom passive radiator">Define new…</button>
  </div>
  <PRBrowser v-if="browseOpen" @close="browseOpen = false"
    @load="loadPR" @load-bundled="loadBundledPR" @define="defineNewPR" />
  <PRDefineModal v-if="defineOpen" @close="defineOpen = false" />

  <!-- PR name + summary (collapsed) or fields (expanded), mirroring DriverPanel -->
  <template v-if="!editPR">
    <div class="drvsum" @click="editPR = true" title="Click to edit passive radiator parameters">
      <span class="nm">{{ state.P.prName || 'Custom PR' }}</span>
      <span class="ed">Edit ✎</span>
    </div>
    <div class="drvspecs">
      Sd <b>{{ (state.P.prSd*1e4).toFixed(0) }} cm²</b> ·
      Fs <b>{{ prFsDisplay.toFixed(1) }} Hz</b> ·
      Qms <b>{{ prQmsDisplay.toFixed(2) }}</b> ·
      Vas <b>{{ prVas.toFixed(2) }} L</b> ·
      Xmax <b>{{ (state.P.prXmax*1000).toFixed(1) }} mm</b>
    </div>
  </template>
  <template v-else>
    <div class="row" title="Name for this passive radiator — shown in the summary and saved with the PR library entry">
      <label>PR name</label>
      <input style="flex:1" type="text" :value="state.P.prName" @input="e => state.P.prName = (e.target as HTMLInputElement).value" placeholder="e.g. Dayton SD270A-88">
    </div>

    <div class="row" title="Number of passive radiators. Multiple PRs in parallel lower the effective acoustic impedance of the PR branch, increasing output without changing the tuning frequency Fp. WinISD: 'Number of radiators'.">
      <label>PR count</label>
      <NumInput v-model="state.P.prNum" :scale="1" :precision="fieldDp('prNum')" step="1" :min="1" />
      <span class="u"></span>
    </div>
    <div class="row" title="Effective piston area of the passive radiator cone (from datasheet). WinISD: Sd.">
      <label>Sd</label>
      <NumInput v-model="state.P.prSd" :scale="1e4" :precision="fieldDp('prSd')" />
      <span class="u">cm²</span>
    </div>
    <div class="row" title="Maximum linear one-way cone excursion before distortion (from datasheet). WinISD: Xmax.">
      <label>Xmax</label>
      <NumInput v-model="state.P.prXmax" :scale="1000" :precision="fieldDp('prXmax')" />
      <span class="u">mm</span>
    </div>

    <div class="row" title="Choose between WinISD-style parameter entry (Fs, Qms, Vas) or raw T/S parameters (Mms, Cms, Rms). Both are equivalent — WinISD uses the same conversions internally.">
      <label>Input mode</label>
      <select v-model="state.P.prMode" style="flex:1">
        <option value="winisd">WinISD</option>
        <option value="ts">T/S</option>
      </select>
    </div>

    <!-- Inputs -->
    <template v-if="P.prMode === 'winisd'">
      <div class="row" title="PR free-air resonance (no added mass, no box).">
        <label>Fs</label>
        <NumInput :model-value="prFsDisplay" :scale="1" :precision="fieldDp('prFs')" @update:model-value="setWinIsdFs" />
        <span class="u">Hz</span>
      </div>
      <div class="row" title="Mechanical Q of the PR suspension.">
        <label>Qms</label>
        <NumInput :model-value="prQmsDisplay" :scale="1" :precision="fieldDp('prQms')" @update:model-value="setWinIsdQms" />
        <span class="u"></span>
      </div>
      <div class="row" title="Compliance volume. Holds Fs and Qms fixed; updates Cms and Mms.">
        <label>Vas</label>
        <NumInput :model-value="prVas" :scale="1" :precision="fieldDp('prVas')" @update:model-value="setWinIsdVas" />
        <span class="u">L</span>
      </div>
    </template>
    <template v-else>
      <div class="row" title="Total moving mass — diaphragm + surround + entrained air. No added weight.">
        <label>Mms</label>
        <NumInput v-model="state.P.prMmd" :scale="1000" :precision="2" />
        <span class="u">g</span>
      </div>
      <div class="row" title="Mechanical compliance of the PR suspension. Higher Cms → lower Fp.">
        <label>Cms</label>
        <NumInput v-model="state.P.prCms" :scale="1000" :precision="4" />
        <span class="u">mm/N</span>
      </div>
      <div class="row" title="Mechanical damping of the PR suspension.">
        <label>Rms</label>
        <NumInput v-model="state.P.prRms" :scale="1" :precision="4" />
        <span class="u">kg/s</span>
      </div>
    </template>

    <!-- Derived (always shown below inputs) -->
    <div class="subsect">Derived</div>
    <template v-if="P.prMode === 'winisd'">
      <div class="row pr-derived" title="Derived: Mms = 1 / (4π²Fs²·Cms)">
        <label>Mms</label>
        <span class="pr-roval">{{ (P.prMmd*1000).toPrecision(4) }} g</span>
        <span class="u"></span>
      </div>
      <div class="row pr-derived" title="Derived: Cms = Vas / (Sd²·ρc²)">
        <label>Cms</label>
        <span class="pr-roval">{{ (P.prCms*1000).toPrecision(3) }} mm/N</span>
        <span class="u"></span>
      </div>
      <div class="row pr-derived" title="Derived: Rms = √(Mms/Cms) / Qms">
        <label>Rms</label>
        <span class="pr-roval">{{ P.prRms.toPrecision(3) }} kg/s</span>
        <span class="u"></span>
      </div>
    </template>
    <template v-else>
      <div class="row pr-derived" title="Derived: Fs = 1/(2π·√(Mms·Cms))">
        <label>Fs</label>
        <span class="pr-roval">{{ prFsDisplay.toFixed(2) }} Hz</span>
        <span class="u"></span>
      </div>
      <div class="row pr-derived" title="Derived: Qms = √(Mms/Cms) / Rms">
        <label>Qms</label>
        <span class="pr-roval">{{ prQmsDisplay.toFixed(2) }}</span>
        <span class="u"></span>
      </div>
      <div class="row pr-derived" title="Derived: Vas = Cms × Sd² × ρc²">
        <label>Vas</label>
        <span class="pr-roval">{{ prVas.toFixed(3) }} L</span>
        <span class="u"></span>
      </div>
    </template>

    <div class="btns" style="margin-top:4px">
      <button @click="() => { saveCurrentPR(); editPR = false; }" title="Save these PR parameters to your library under the current PR name, then return to the summary view">Save</button>
    </div>
  </template>

  <!-- PR tuning — always visible; not intrinsic to the device -->
  <div class="subsect">PR tuning</div>
  <div class="row" title="Extra mass physically bolted to the PR cone (e.g. steel washer, lead shot). Shifts the tuning frequency down without changing the PR's other parameters. WinISD: 'Added mass'.">
    <label>Added mass <span style="color:var(--mut);font-size:10px">(tunable)</span></label>
    <NumInput v-model="state.P.prMadd" :scale="1000" :precision="fieldDp('prMadd')" />
    <span class="u">g</span>
  </div>
  <div class="row" title="Total moving mass = Mms + added mass. This is what the acoustic circuit uses.">
    <label>Total Mms</label>
    <span style="font-size:11px;color:var(--mut);text-align:right;flex:0 0 96px">{{ ((P.prMmd + P.prMadd)*1000).toPrecision(4) }} g</span>
    <span class="u"></span>
  </div>
  <div class="row">
    <label></label>
    <span style="font-size:11px;color:var(--acc2)" title="PR in-box tuning frequency — passive radiator resonance in this enclosure. Analogous to Fb in a vented box. WinISD: Fp.">Fp ≈ <b>{{ fp.toFixed(1) }} Hz</b></span>
  </div>
  <div class="row" title="Free-air PR resonance with added mass applied, no box. In-box Fp is higher because the box compliance in series reduces the total system compliance, raising the resonance. WinISD calls this 'Fs with added mass'.">
    <label></label>
    <span style="font-size:11px;color:var(--mut)">Fs+mass ≈ {{ prFsLoaded.toFixed(1) }} Hz</span>
  </div>

  <div class="btns">
    <button @click="autoPRMass"
      title="Calculates and sets the added mass so Fp matches the B4 alignment's optimal tuning for this driver. B4 = 4th-order Butterworth — flat response to Fp, then steep rolloff.">
      Tune added mass to B4 Fp
    </button>
  </div>
</template>
