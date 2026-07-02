<script setup lang="ts">
import { computed, ref } from 'vue';
import { state, driver } from '../store.js';
import { sealedFromQtc, ventedAlignment, ventLength, tuningFromLength } from '@resonate/engine';
import NumInput from './NumInput.vue';
import PRPanel from './PRPanel.vue';

const P = computed(() => state.P);
const drv = driver;

const fb = computed(() => {
  const sp = Math.PI * (P.value.ventD / 2) ** 2;
  return tuningFromLength(P.value.Vb, P.value.ventL, sp);
});

const showLosses = ref(false);

function setVbForQtc() {
  if (!drv.value) return;
  const vb = sealedFromQtc(drv.value, 0.707);
  if (vb) state.P.Vb = vb;
}

function autoVentAlign() {
  if (!drv.value) return;
  const a = ventedAlignment(drv.value);
  state.P.Vb = a.Vb;
  state.P.ventL = ventLength(a.Vb, a.Fb, Math.PI * (state.P.ventD / 2) ** 2);
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
    <div class="row" title="Net acoustic internal volume — excludes driver displacement, port tube volume, and bracing. WinISD also uses net volume. Add ~0.5–1 L per 6.5&quot; driver when sizing the physical box.">
      <label>Box volume Vb</label>
      <NumInput v-model="state.P.Vb" :scale="1000" :precision="4" />
      <span class="u">L</span>
    </div>
    <div class="btns" style="margin-bottom:2px">
      <button class="losses-toggle" @click="showLosses = !showLosses"
        title="Expand box loss parameters: Ql (leakage) and Qa (absorption). Applies to all box types. WinISD defaults: Ql=10, Qa=100 — found in Box tab → Advanced→ popup.">
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
      <div class="row" v-if="state.box === 'vented' || state.box === 'bandpass4'"
        title="Port loss Q — air friction and turbulence in the vent tube. WinISD default: 100 (low-loss port). Lower values increase vent damping and broaden the bass-reflex peak.">
        <label>Port loss Qp</label>
        <NumInput v-model="state.P.Qp" :scale="1" :precision="3" />
        <span class="u"></span>
      </div>
      <div class="losses-guide">
        100 = no stuffing &nbsp;·&nbsp; 20–50 = light &nbsp;·&nbsp; 5–10 = heavy<br>
        <span class="losses-note">Real stuffing also increases apparent Vb — this model captures resistive loss only.</span>
      </div>
    </template>
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
      <PRPanel />
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
    </div>
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
