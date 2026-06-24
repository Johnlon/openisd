<script setup>
import { computed, ref, watch } from 'vue';
import { state, driver } from '../store.js';
import { sealedFromQtc, ventedAlignment, ventLength, tuningFromLength, prTuning, prMassForFp } from '../core/alignments.js';
import { RHO, C } from '../core/constants.js';
import { savePR, listPRs, deletePR } from '../utils/prLibrary.js';
import NumInput from './NumInput.vue';

const P = computed(() => state.P);
const drv = driver;

const fb = computed(() => {
  const sp = Math.PI * (P.value.ventD / 2) ** 2;
  return tuningFromLength(P.value.Vb, P.value.ventL, sp);
});

const fp = computed(() => prTuning(P.value));

// T/S ↔ Vas conversion (used by both modes)
const prVas = computed(() => P.value.prCms * P.value.prSd * P.value.prSd * RHO * C * C * 1000);

// WinISD-mode display values derived from canonical T/S params
const prFsDisplay = computed(() => {
  const { prMmd, prCms } = P.value;
  return prMmd > 0 && prCms > 0 ? 1 / (2 * Math.PI * Math.sqrt(prMmd * prCms)) : 0;
});
const prQmsDisplay = computed(() => {
  const { prMmd, prCms, prRms } = P.value;
  return prRms > 0 ? Math.sqrt(prMmd / prCms) / prRms : 0;
});
// Free-air resonance with added mass (no box) — WinISD "Fs with added mass" cross-check
const prFsLoaded = computed(() => {
  const { prMmd, prMadd, prCms } = P.value;
  const m = prMmd + prMadd;
  return m > 0 && prCms > 0 ? 1 / (2 * Math.PI * Math.sqrt(m * prCms)) : 0;
});

function setPrVas(vasL) {
  if (vasL > 0)
    state.P.prCms = (vasL / 1000) / (state.P.prSd * state.P.prSd * RHO * C * C);
}

// WinISD mode handlers — each reads Fs/Qms from canonical T/S at full precision,
// then rewrites the affected T/S fields while holding the other two WinISD params fixed.
function setWinIsdFs(newFsHz) {
  if (!(newFsHz > 0)) return;
  const Qms = prQmsDisplay.value || 5;
  const newMmd = 1 / ((2 * Math.PI * newFsHz) ** 2 * state.P.prCms);
  state.P.prMmd = newMmd;
  state.P.prRms = Math.sqrt(newMmd / state.P.prCms) / Qms;
}

function setWinIsdQms(newQms) {
  if (!(newQms > 0)) return;
  state.P.prRms = Math.sqrt(state.P.prMmd / state.P.prCms) / newQms;
}

function setWinIsdVas(newVasL) {
  if (!(newVasL > 0)) return;
  const Fs_curr = prFsDisplay.value || 30;
  const Qms_curr = prQmsDisplay.value || 5;
  const newCms = (newVasL / 1000) / (state.P.prSd * state.P.prSd * RHO * C * C);
  const newMmd = 1 / ((2 * Math.PI * Fs_curr) ** 2 * newCms);
  state.P.prCms = newCms;
  state.P.prMmd = newMmd;
  state.P.prRms = Math.sqrt(newMmd / newCms) / Qms_curr;
}

function setVbForQtc() {
  const vb = sealedFromQtc(drv.value, 0.707);
  if (vb) state.P.Vb = vb;
}

function autoVentAlign() {
  const a = ventedAlignment(drv.value);
  state.P.Vb = a.Vb;
  state.P.ventL = ventLength(a.Vb, a.Fb, Math.PI * (state.P.ventD / 2) ** 2);
}

function autoPRMass() {
  const target = ventedAlignment(drv.value).Fb;
  const totalMass = prMassForFp(state.P, target);
  state.P.prMadd = Math.max(0, totalMass - state.P.prMmd);
}

// PR library
const showLosses = ref(false);

const prLib = ref(listPRs());
const showPRLib = ref(false);

function saveCurrentPR() {
  const name = prompt('Save PR as:', '');
  if (!name?.trim()) return;
  prLib.value = savePR(name.trim(), state.P);
}

function loadPR(entry) {
  state.P.prSd   = entry.prSd;
  state.P.prMmd  = entry.prMmd;
  state.P.prCms  = entry.prCms;
  state.P.prRms  = entry.prRms;
  state.P.prXmax = entry.prXmax;
  showPRLib.value = false;
}

function removePR(id) {
  prLib.value = deletePR(id);
}
</script>

<template>
  <fieldset>
    <legend>Enclosure</legend>
    <div class="row">
      <label>Type</label>
      <select id="boxtype" v-model="state.box" style="flex:1">
        <option value="sealed">Sealed (closed)</option>
        <option value="vented">Vented (bass-reflex)</option>
        <option value="bandpass4">Bandpass 4th order</option>
        <option value="pr">Passive radiator</option>
      </select>
    </div>
    <div class="row">
      <label>Box volume Vb</label>
      <NumInput v-model="state.P.Vb" :scale="1000" :precision="4" />
      <span class="u">L</span>
    </div>
    <template v-if="state.box === 'bandpass4'">
      <div class="row">
        <label>Front chamber Vf</label>
        <NumInput v-model="state.P.Vf" :scale="1000" :precision="3" />
        <span class="u">L</span>
      </div>
    </template>
    <template v-if="state.box === 'vented' || state.box === 'bandpass4'">
      <div class="row">
        <label>Vent diameter</label>
        <NumInput v-model="state.P.ventD" :scale="100" :precision="3" />
        <span class="u">cm</span>
      </div>
      <div class="row">
        <label>Vent length</label>
        <NumInput v-model="state.P.ventL" :scale="100" :precision="4" />
        <span class="u">cm</span>
      </div>
      <div class="row">
        <label></label>
        <span style="font-size:11px;color:var(--acc2)">Fb ≈ <b>{{ fb.toFixed(1) }} Hz</b></span>
      </div>
    </template>
    <template v-if="state.box === 'pr'">
      <div class="row" title="Number of passive radiators. Multiple PRs in parallel lower the effective acoustic impedance of the PR branch, increasing output without changing the tuning frequency Fp.">
        <label>PR count</label>
        <NumInput v-model="state.P.prNum" :scale="1" :precision="2" step="1" :min="1" />
        <span class="u"></span>
      </div>
      <div class="row" title="Effective piston area of the passive radiator cone (from datasheet).">
        <label>Sd</label>
        <NumInput v-model="state.P.prSd" :scale="1e4" :precision="4" />
        <span class="u">cm²</span>
      </div>
      <div class="row" title="Maximum linear one-way cone excursion before distortion (from datasheet).">
        <label>Xmax</label>
        <NumInput v-model="state.P.prXmax" :scale="1000" :precision="3" />
        <span class="u">mm</span>
      </div>

      <div class="row">
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
          <NumInput :model-value="prFsDisplay" :scale="1" :precision="4" @update:model-value="setWinIsdFs" />
          <span class="u">Hz</span>
        </div>
        <div class="row" title="Mechanical Q of the PR suspension.">
          <label>Qms</label>
          <NumInput :model-value="prQmsDisplay" :scale="1" :precision="3" @update:model-value="setWinIsdQms" />
          <span class="u"></span>
        </div>
        <div class="row" title="Compliance volume. Holds Fs and Qms fixed; updates Cms and Mms.">
          <label>Vas</label>
          <NumInput :model-value="prVas" :scale="1" :precision="3" @update:model-value="setWinIsdVas" />
          <span class="u">L</span>
        </div>
      </template>
      <template v-else>
        <div class="row" title="Total moving mass — diaphragm + surround + entrained air. No added weight.">
          <label>Mms</label>
          <NumInput v-model="state.P.prMmd" :scale="1000" :precision="4" />
          <span class="u">g</span>
        </div>
        <div class="row" title="Mechanical compliance of the PR suspension. Higher Cms → lower Fp.">
          <label>Cms</label>
          <NumInput v-model="state.P.prCms" :scale="1000" :precision="3" />
          <span class="u">mm/N</span>
        </div>
        <div class="row" title="Mechanical damping of the PR suspension.">
          <label>Rms</label>
          <NumInput v-model="state.P.prRms" :scale="1" :precision="3" />
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

      <div class="subsect">PR tuning</div>
      <div class="row" title="Extra mass physically bolted to the PR cone (e.g. steel washer, lead shot). Shifts the tuning frequency down. Total = Mms + added mass.">
        <label>Added mass <span style="color:var(--mut);font-size:10px">(tunable)</span></label>
        <NumInput v-model="state.P.prMadd" :scale="1000" :precision="4" />
        <span class="u">g</span>
      </div>
      <div class="row" title="Total moving mass = Mms (manufacture) + added mass. This is what the circuit uses.">
        <label>Total Mms</label>
        <span style="font-size:11px;color:var(--mut);text-align:right;flex:0 0 96px">{{ ((P.prMmd + P.prMadd)*1000).toPrecision(4) }} g</span>
        <span class="u"></span>
      </div>
      <div class="row">
        <label></label>
        <span style="font-size:11px;color:var(--acc2)" title="PR in-box tuning frequency — passive radiator resonance in this box. Analogous to Fb in a vented box.">Fp ≈ <b>{{ fp.toFixed(1) }} Hz</b></span>
      </div>
      <div class="row" title="Free-air PR resonance with added mass, no box. WinISD calls this 'Fs with added mass'. In-box Fp is lower because box compliance shifts it down.">
        <label></label>
        <span style="font-size:11px;color:var(--mut)">Fs+mass ≈ {{ prFsLoaded.toFixed(1) }} Hz</span>
      </div>

      <!-- PR library -->
      <div class="subsect">PR library</div>
      <div class="btns" style="margin-bottom:4px">
        <button @click="saveCurrentPR" title="Save current PR specs (Sd, Mms, Cms, Rms, Xmax) to local library for reuse.">Save PR…</button>
        <button @click="showPRLib = !showPRLib" title="Browse saved PRs and load into current design.">{{ showPRLib ? 'Hide library' : 'Browse PRs' }}</button>
      </div>
      <div v-if="showPRLib" class="pr-lib">
        <div v-if="!prLib.length" style="color:var(--mut);font-size:11px;padding:4px 0">No saved PRs yet. Enter specs and click Save PR.</div>
        <div v-for="e in prLib" :key="e.id" class="pr-lib-item">
          <span class="pr-lib-name" @click="loadPR(e)" :title="`Sd=${(e.prSd*1e4).toFixed(0)}cm² Mms=${(e.prMmd*1000).toFixed(1)}g Cms=${(e.prCms*1000).toFixed(2)}mm/N`">{{ e.name }}</span>
          <button class="pr-lib-del" @click="removePR(e.id)" title="Remove from library">✕</button>
        </div>
      </div>
    </template>
    <div class="btns">
      <button v-if="state.box === 'sealed'" @click="setVbForQtc"
        title="Sets the box volume so the system Q (Qtc) equals 0.707 — the Butterworth (B2) alignment. Maximally flat frequency response.">
        Set Vb for Qtc=0.707
      </button>
      <button v-if="state.box === 'vented'" @click="autoVentAlign"
        title="Applies the QB3 or B4 vented alignment for this driver. Sets Vb and vent length for optimal bass-reflex tuning.">
        Auto QB3/B4 align
      </button>
      <button v-if="state.box === 'pr'" @click="autoPRMass"
        title="Calculates and sets the added mass so Fp matches the B4 alignment's optimal tuning for this driver. B4 = 4th-order Butterworth — flat response to Fp, then steep rolloff.">
        Tune added mass to B4 Fp
      </button>
      <button class="losses-toggle" @click="showLosses = !showLosses">
        Box losses {{ showLosses ? '▾' : '▸' }}
      </button>
    </div>
    <template v-if="showLosses">
      <div class="row" title="Leakage loss — enclosure sealing and driver surround leaks. WinISD default: 10. Lower = more leakage.">
        <label>Leakage Ql</label>
        <NumInput v-model="state.P.Ql" :scale="1" :precision="3" />
        <span class="u"></span>
      </div>
      <div class="row" title="Absorption loss from stuffing material. WinISD default: 100 (no stuffing).">
        <label>Absorption Qa</label>
        <NumInput v-model="state.P.Qa" :scale="1" :precision="3" />
        <span class="u"></span>
      </div>
      <div class="losses-guide">
        100 = no stuffing &nbsp;·&nbsp; 20–50 = light &nbsp;·&nbsp; 5–10 = heavy<br>
        <span class="losses-note">Real stuffing also increases apparent Vb — this model captures resistive loss only.</span>
      </div>
    </template>
  </fieldset>
</template>

<style scoped>
.losses-toggle {
  font-size: 11px;
  padding: 1px 6px;
  cursor: pointer;
  background: none;
  border: 1px solid var(--mut);
  border-radius: 3px;
  color: var(--mut);
}
.losses-toggle:hover { color: var(--fg); border-color: var(--fg); }
.losses-guide {
  font-size: 10px;
  color: var(--mut);
  padding: 2px 4px 4px 4px;
  line-height: 1.5;
}
.losses-note { font-style: italic; }
</style>
