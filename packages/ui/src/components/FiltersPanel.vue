<script setup lang="ts">
import { state } from '../store.js';
import type { FilterType } from '@openisd/engine';

const defaults: Record<FilterType, Record<string, number>> = {
  highpass: { fc: 80,  Q: 0.7071 },
  lowpass:  { fc: 200, Q: 0.7071 },
  linkwitz: { f0: 50,  Q0: 0.7, fp: 20, Qp: 0.5 },
  peaking:  { fc: 300, Q: 1.0, gain: -6 },
};

function addFilter(type: FilterType) {
  state.P.filters.push({ id: crypto.randomUUID(), type, enabled: true, ...defaults[type] });
}

function removeFilter(i: number) {
  state.P.filters.splice(i, 1);
}

function num(v: number | undefined, dec: number): number | undefined { return (v != null && isFinite(v)) ? +v.toFixed(dec) : v; }
</script>

<template>
  <fieldset>
    <legend>Filters / EQ</legend>

    <div v-for="(flt, i) in state.P.filters" :key="flt.id" class="flt-item">

      <!-- High-pass -->
      <template v-if="flt.type === 'highpass'">
        <div class="flt-row">
          <input type="checkbox" v-model="flt.enabled" title="Toggle this high-pass filter on/off — bypassed when unchecked, frequencies below cutoff roll through">
          <span class="flt-tag">HP</span>
          <span class="fp">fc</span>
          <input type="number" step="1" min="1" :value="num(flt.fc,1)" @input="e=>flt.fc=+(e.target as HTMLInputElement).value" class="fi">
          <span class="fu">Hz</span>
          <span class="fp">Q</span>
          <input type="number" step="0.01" min="0.1" :value="num(flt.Q,4)" @input="e=>flt.Q=+(e.target as HTMLInputElement).value" class="fi">
          <button class="fdel" @click="removeFilter(i)" title="Remove this high-pass filter from the chain — low-frequency rolloff will no longer be applied">×</button>
        </div>
      </template>

      <!-- Low-pass -->
      <template v-else-if="flt.type === 'lowpass'">
        <div class="flt-row">
          <input type="checkbox" v-model="flt.enabled" title="Toggle this low-pass filter on/off — bypassed when unchecked, frequencies above cutoff roll through">
          <span class="flt-tag">LP</span>
          <span class="fp">fc</span>
          <input type="number" step="1" min="1" :value="num(flt.fc,1)" @input="e=>flt.fc=+(e.target as HTMLInputElement).value" class="fi">
          <span class="fu">Hz</span>
          <span class="fp">Q</span>
          <input type="number" step="0.01" min="0.1" :value="num(flt.Q,4)" @input="e=>flt.Q=+(e.target as HTMLInputElement).value" class="fi">
          <button class="fdel" @click="removeFilter(i)" title="Remove this low-pass filter from the chain — high-frequency rolloff will no longer be applied">×</button>
        </div>
      </template>

      <!-- Linkwitz transform: two rows -->
      <template v-else-if="flt.type === 'linkwitz'">
        <div class="flt-row">
          <input type="checkbox" v-model="flt.enabled" title="Toggle this Linkwitz transform on/off — bypassed when unchecked, bass extension will not be applied">
          <span class="flt-tag">LT</span>
          <span class="fp">f₀</span>
          <input type="number" step="1" min="1" :value="num(flt.f0,1)" @input="e=>flt.f0=+(e.target as HTMLInputElement).value" class="fi">
          <span class="fu">Hz</span>
          <span class="fp">Q₀</span>
          <input type="number" step="0.01" min="0.1" :value="num(flt.Q0,3)" @input="e=>flt.Q0=+(e.target as HTMLInputElement).value" class="fi">
          <button class="fdel" @click="removeFilter(i)" title="Remove this Linkwitz transform from the chain — active bass extension will no longer be applied">×</button>
        </div>
        <div class="flt-row flt-sub">
          <span style="width:20px"></span>
          <span class="flt-tag" style="color:var(--mut)">→</span>
          <span class="fp">fp</span>
          <input type="number" step="1" min="1" :value="num(flt.fp,1)" @input="e=>flt.fp=+(e.target as HTMLInputElement).value" class="fi">
          <span class="fu">Hz</span>
          <span class="fp">Qp</span>
          <input type="number" step="0.01" min="0.1" :value="num(flt.Qp,3)" @input="e=>flt.Qp=+(e.target as HTMLInputElement).value" class="fi">
        </div>
      </template>

      <!-- Peaking EQ -->
      <template v-else-if="flt.type === 'peaking'">
        <div class="flt-row">
          <input type="checkbox" v-model="flt.enabled" title="Toggle this parametric EQ band on/off — bypassed when unchecked, boost/cut will not be applied">
          <span class="flt-tag">PEQ</span>
          <span class="fp">fc</span>
          <input type="number" step="1" min="1" :value="num(flt.fc,1)" @input="e=>flt.fc=+(e.target as HTMLInputElement).value" class="fi">
          <span class="fu">Hz</span>
          <span class="fp">Q</span>
          <input type="number" step="0.01" min="0.1" :value="num(flt.Q,3)" @input="e=>flt.Q=+(e.target as HTMLInputElement).value" class="fi2">
          <span class="fp">G</span>
          <input type="number" step="0.5" :value="num(flt.gain,1)" @input="e=>flt.gain=+(e.target as HTMLInputElement).value" class="fi2">
          <span class="fu">dB</span>
          <button class="fdel" @click="removeFilter(i)" title="Remove this parametric EQ band from the chain — the boost/cut at this frequency will no longer be applied">×</button>
        </div>
      </template>

    </div>

    <div v-if="!state.P.filters.length" class="hint" style="margin:4px 0 2px">
      No filters active.
    </div>

    <div class="btns" style="margin-top:6px">
      <button @click="addFilter('highpass')" title="Add a high-pass filter — rolls off frequencies below the cutoff at 12 dB/oct (2nd order Butterworth)">+ HP</button>
      <button @click="addFilter('lowpass')" title="Add a low-pass filter — rolls off frequencies above the cutoff at 12 dB/oct (2nd order Butterworth)">+ LP</button>
      <button @click="addFilter('linkwitz')" title="Add a Linkwitz transform — shifts the sealed box resonance from Fc/Qtc to a new Fp/Qp for active bass extension">+ Linkwitz</button>
      <button @click="addFilter('peaking')" title="Add a parametric EQ band — boost or cut a specific frequency range with adjustable centre frequency, Q, and gain">+ Peaking EQ</button>
    </div>
  </fieldset>
</template>

<style scoped>
.flt-item { margin: 3px 0; }
.flt-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 2px 0;
}
.flt-sub { margin-left: 0; }
.flt-tag {
  font-size: 10px;
  font-weight: 700;
  color: var(--acc);
  letter-spacing: .3px;
  min-width: 28px;
  text-align: center;
}
.fp {
  font-size: 11px;
  color: var(--mut);
  white-space: nowrap;
}
.fi {
  width: 58px;
  background: var(--panel2);
  border: 1px solid var(--line);
  color: var(--fg);
  border-radius: 4px;
  padding: 2px 4px;
  font: inherit;
  text-align: right;
}
.fi2 {
  width: 46px;
  background: var(--panel2);
  border: 1px solid var(--line);
  color: var(--fg);
  border-radius: 4px;
  padding: 2px 4px;
  font: inherit;
  text-align: right;
}
.fu {
  font-size: 11px;
  color: var(--mut);
  min-width: 18px;
}
.fdel {
  margin-left: auto;
  padding: 1px 6px;
  font-size: 13px;
  line-height: 1;
  color: var(--mut);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 3px;
  cursor: pointer;
}
.fdel:hover {
  color: var(--bad);
  border-color: var(--bad);
  background: transparent;
}
</style>
