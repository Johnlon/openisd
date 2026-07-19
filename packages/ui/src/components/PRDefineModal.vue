<script setup lang="ts">
import { ref, computed } from 'vue';
import { state } from '../store.js';
import { RHO, C } from '@openisd/engine';
import { useEscToClose } from '../composables/useEscToClose.js';

// Define a brand-new passive radiator — a BLANK, buffered form (mirrors
// DriverDefineModal: empty string inputs, writes to the live design ONLY on Create,
// so an unfinished entry never corrupts state.P). WinISD-style inputs (Sd, Fs, Qms,
// Vas) — the same fields PREditModal exposes — converted to the canonical Sd/Mmd/
// Cms/Rms on Create using the identical formulas PRPanel.setWinIsd* use.

const emit = defineEmits<{ close: [] }>();
useEscToClose(() => true, () => emit('close'));

// Empty string buffers — the form comes up blank.
const nName = ref('');
const nNum  = ref('');
const nSd   = ref('');   // cm²
const nXmax = ref('');   // mm
const nFs   = ref('');   // Hz
const nQms  = ref('');
const nVas  = ref('');   // L

function num(s: string): number { const v = parseFloat(s); return isFinite(v) ? v : NaN; }
// Required to define a resonant PR: Sd, Fs, Qms, Vas (Xmax/count/name optional).
const canCreate = computed(() =>
  num(nSd.value) > 0 && num(nFs.value) > 0 && num(nQms.value) > 0 && num(nVas.value) > 0);

function create() {
  if (!canCreate.value) return;
  const sd  = num(nSd.value) / 1e4;          // cm² → m²
  const fs  = num(nFs.value);
  const qms = num(nQms.value);
  const vas = num(nVas.value) / 1000;        // L → m³
  const cms = vas / (sd * sd * RHO * C * C);
  const mmd = 1 / ((2 * Math.PI * fs) ** 2 * cms);
  const rms = Math.sqrt(mmd / cms) / qms;
  const xmaxMm = num(nXmax.value);
  const count = num(nNum.value);

  state.P.prName = nName.value.trim() || 'New PR';
  state.P.prNum  = count > 0 ? count : 1;
  state.P.prSd   = sd;
  state.P.prXmax = isFinite(xmaxMm) && xmaxMm >= 0 ? xmaxMm / 1000 : 0;
  state.P.prCms  = cms;
  state.P.prMmd  = mmd;
  state.P.prRms  = rms;
  state.P.prMadd = 0;
  state.P.prMode = 'winisd';
  emit('close');
}

function close() { emit('close'); }
function onBackdrop(e: MouseEvent) { if (e.target === e.currentTarget) close(); }
</script>

<template>
  <div class="overlay on" @click="onBackdrop">
    <div class="modal">
      <h2>Define new passive radiator<button class="x" @click="close" title="Close">✕</button></h2>
      <div class="body">
        <div class="row" title="Name for this passive radiator">
          <label>PR name</label>
          <input style="flex:1" type="text" v-model="nName" placeholder="e.g. Dayton SD270A-88">
        </div>
        <div class="row" title="Number of passive radiators in parallel (blank = 1)">
          <label>PR count</label>
          <input style="flex:1" type="number" step="1" min="1" v-model="nNum" placeholder="1">
          <span class="u"></span>
        </div>
        <div class="row" title="Effective piston area (from datasheet). WinISD: Sd. Required.">
          <label>Sd</label>
          <input style="flex:1" type="number" step="any" v-model="nSd" placeholder="—">
          <span class="u">cm²</span>
        </div>
        <div class="row" title="Maximum linear one-way excursion (from datasheet). WinISD: Xmax. Optional.">
          <label>Xmax</label>
          <input style="flex:1" type="number" step="any" v-model="nXmax" placeholder="—">
          <span class="u">mm</span>
        </div>
        <div class="row" title="PR free-air resonance (no added mass, no box). WinISD: Fs. Required.">
          <label>Fs</label>
          <input style="flex:1" type="number" step="any" v-model="nFs" placeholder="—">
          <span class="u">Hz</span>
        </div>
        <div class="row" title="Mechanical Q of the PR suspension. WinISD: Qms. Required.">
          <label>Qms</label>
          <input style="flex:1" type="number" step="any" v-model="nQms" placeholder="—">
          <span class="u"></span>
        </div>
        <div class="row" title="Compliance volume. WinISD: Vas. Required.">
          <label>Vas</label>
          <input style="flex:1" type="number" step="any" v-model="nVas" placeholder="—">
          <span class="u">L</span>
        </div>

        <div class="btns" style="margin-top:8px">
          <button class="pri" :disabled="!canCreate" @click="create"
            title="Create this passive radiator and load it into the current design">Create</button>
          <button @click="close" title="Discard">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Narrow — these are short numeric fields, not a full-width form. */
.modal { width: min(320px, 92vw); }
.pri { background: var(--acc); color:#fff; border-color: var(--acc); }
.pri:disabled { opacity:.5; cursor:not-allowed; }
</style>
