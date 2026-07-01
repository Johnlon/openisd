<script setup>
import { computed } from 'vue';
import { state, driver, syncedP, curvesData } from '../store.js';
import { ebp, tuningFromLength, prTuning } from '@resonate/engine';

const drv = driver;
const P = syncedP;
const sw = curvesData;

function findRolloff(fs, spl, drop) {
  const ref = Math.max(...spl);
  for (let i = 0; i < fs.length; i++) if (spl[i] >= ref - drop) return fs[i];
  return null;
}

const stats = computed(() => {
  const d = drv.value, p = P.value, s = sw.value;
  const box = state.box;
  // No derivable driver (core T/S invalid) → no sweep to summarise.
  if (!d || !s) return { box, invalid: true };
  const f3  = findRolloff(s.fs, s.spl, 3);
  const f6  = findRolloff(s.fs, s.spl, 6);
  const f10 = findRolloff(s.fs, s.spl, 10);
  const peakZ = Math.max(...s.zmag);
  const fb = (box === 'vented') ? tuningFromLength(p.Vb, p.ventL, p.Sp || Math.PI*(p.ventD/2)**2) : null;
  const fp = (box === 'pr') ? prTuning(p) : null;
  const Qtc = (box === 'sealed') ? d.Qts * Math.sqrt(1 + d.Vas / p.Vb) : null;
  const fc  = (box === 'sealed') ? d.Fs * Math.sqrt(1 + d.Vas / p.Vb) : null;
  const maxPV = (box === 'vented' || box === 'bandpass4') ? Math.max(...s.pv) : null;
  const maxPRx = (box === 'pr') ? Math.max(...s.excPR) : null;
  return { box, Vb: p.Vb, fc, Qtc, fb, fp, f3, f6, f10, peakZ, maxPV, maxPRx, ebpVal: ebp(d), prXmax: p.prXmax };
});
</script>

<template>
  <div id="stat" class="stat">
    <span>Box: <b>{{ stats.box }}</b></span>
    <template v-if="stats.invalid">
      <span class="stat-invalid">Driver incomplete — fix the highlighted parameters to run the simulation</span>
    </template>
    <template v-else>
    <span>Vb: <b>{{ (stats.Vb*1000).toFixed(1) }} L</b></span>
    <span v-if="stats.fc">fc: <b>{{ stats.fc.toFixed(1) }} Hz</b></span>
    <span v-if="stats.Qtc">Qtc: <b>{{ stats.Qtc.toFixed(3) }}</b></span>
    <span v-if="stats.fb">Fb: <b>{{ stats.fb.toFixed(1) }} Hz</b></span>
    <span v-if="stats.fp">Fp: <b>{{ stats.fp.toFixed(1) }} Hz</b></span>
    <span>F3: <b>{{ stats.f3 ? stats.f3.toFixed(1) + ' Hz' : '—' }}</b></span>
    <span>F6: <b>{{ stats.f6 ? stats.f6.toFixed(1) + ' Hz' : '—' }}</b></span>
    <span>F10: <b>{{ stats.f10 ? stats.f10.toFixed(1) + ' Hz' : '—' }}</b></span>
    <span>Z peak: <b>{{ stats.peakZ.toFixed(1) }} Ω</b></span>
    <span v-if="stats.maxPV != null">peak port: <b>{{ stats.maxPV.toFixed(1) }} m/s</b></span>
    <span v-if="stats.maxPRx != null">
      peak PR: <b>{{ stats.maxPRx.toFixed(1) }} mm</b>
      (Xmax {{ ((stats.prXmax||0)*1000).toFixed(1) }})
    </span>
    <span>EBP: <b>{{ stats.ebpVal.toFixed(0) }}</b></span>
    </template>
  </div>
</template>
