<script setup>
import { computed } from 'vue';
import { state, driver, syncedP } from '../store.js';
import { sealedFromQtc, ventedAlignment, ventLength, tuningFromLength, prTuning, prMassForFp } from '../core/alignments.js';

const P = computed(() => state.P);
const drv = driver;

const fb = computed(() => {
  const sp = Math.PI * (P.value.ventD / 2) ** 2;
  return tuningFromLength(P.value.Vb, P.value.ventL, sp);
});

const fp = computed(() => prTuning(P.value));

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
  state.P.prMmp = prMassForFp(state.P, target);
}

function num(key, scale) {
  return (state.P[key] * scale);
}

function setNum(key, scale, val) {
  const v = parseFloat(val);
  if (!isNaN(v)) state.P[key] = v / scale;
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
      <input type="number" step="any" :value="(P.Vb*1000).toPrecision(4)" @input="e => setNum('Vb',1000,e.target.value)">
      <span class="u">L</span>
    </div>
    <template v-if="state.box === 'bandpass4'">
      <div class="row">
        <label>Front chamber Vf</label>
        <input type="number" step="any" :value="(P.Vf*1000).toPrecision(3)" @input="e => setNum('Vf',1000,e.target.value)">
        <span class="u">L</span>
      </div>
    </template>
    <template v-if="state.box === 'vented' || state.box === 'bandpass4'">
      <div class="row">
        <label>Vent diameter</label>
        <input type="number" step="any" :value="(P.ventD*100).toPrecision(3)" @input="e => setNum('ventD',100,e.target.value)">
        <span class="u">cm</span>
      </div>
      <div class="row">
        <label>Vent length</label>
        <input type="number" step="any" :value="(P.ventL*100).toPrecision(4)" @input="e => setNum('ventL',100,e.target.value)">
        <span class="u">cm</span>
      </div>
      <div class="row">
        <label></label>
        <span style="font-size:11px;color:var(--acc2)">Fb ≈ <b>{{ fb.toFixed(1) }} Hz</b></span>
      </div>
    </template>
    <template v-if="state.box === 'pr'">
      <div class="row">
        <label>PR area Sd</label>
        <input type="number" step="any" :value="(P.prSd*1e4).toPrecision(4)" @input="e => setNum('prSd',1e4,e.target.value)">
        <span class="u">cm²</span>
      </div>
      <div class="row">
        <label>PR mass Mmp</label>
        <input type="number" step="any" :value="(P.prMmp*1000).toPrecision(4)" @input="e => setNum('prMmp',1000,e.target.value)">
        <span class="u">g</span>
      </div>
      <div class="row">
        <label>PR compliance</label>
        <input type="number" step="any" :value="(P.prCms*1000).toPrecision(3)" @input="e => setNum('prCms',1000,e.target.value)">
        <span class="u">mm/N</span>
      </div>
      <div class="row">
        <label>PR Rms</label>
        <input type="number" step="any" :value="P.prRms" @input="e => setNum('prRms',1,e.target.value)">
        <span class="u">Ns/m</span>
      </div>
      <div class="row">
        <label>PR Xmax</label>
        <input type="number" step="any" :value="(P.prXmax*1000).toPrecision(3)" @input="e => setNum('prXmax',1000,e.target.value)">
        <span class="u">mm</span>
      </div>
      <div class="row">
        <label></label>
        <span style="font-size:11px;color:var(--acc2)">Fp ≈ <b>{{ fp.toFixed(1) }} Hz</b></span>
      </div>
    </template>
    <div class="row">
      <label>Leakage Ql</label>
      <input type="number" step="any" :value="P.Ql" @input="e => setNum('Ql',1,e.target.value)">
      <span class="u"></span>
    </div>
    <div class="btns">
      <button v-if="state.box === 'sealed'" @click="setVbForQtc">Set Vb for Qtc=0.707</button>
      <button v-if="state.box === 'vented'" @click="autoVentAlign">Auto QB3/B4 align</button>
      <button v-if="state.box === 'pr'" @click="autoPRMass">Tune PR mass to B4 Fb</button>
    </div>
  </fieldset>
</template>
