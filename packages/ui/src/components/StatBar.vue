<script setup lang="ts">
import { computed } from 'vue';
import { state, driver, syncedP, curvesData, formatInUnit as fmtU, unitLabelOf } from '../store.js';
import { ebp, tuningFromLength, prTuning } from '@openisd/engine';

const drv = driver;
const P = syncedP;
const sw = curvesData;

function findRolloff(fs: number[], spl: number[], drop: number): number | null {
  const ref = Math.max(...spl);
  for (let i = 0; i < fs.length; i++) if (spl[i] >= ref - drop) return fs[i];
  return null;
}

type StatsInvalid = { box: string; invalid: true };
type StatsValid = {
  box: string; invalid?: false;
  Vb: number; fc: number | null; Qtc: number | null;
  fb: number | null; fp: number | null;
  f3: number | null; f6: number | null; f10: number | null;
  peakZ: number; maxPV: number | null; maxPRx: number | null;
  ebpVal: number; prXmax: number;
};

const stats = computed<StatsInvalid | StatsValid>(() => {
  const d = drv.value, p = P.value, s = sw.value;
  const box = state.box;
  // No derivable driver (core T/S invalid) → no sweep to summarise.
  if (!d || !s) return { box, invalid: true };
  const f3  = findRolloff(s.fs, s.spl, 3);
  const f6  = findRolloff(s.fs, s.spl, 6);
  const f10 = findRolloff(s.fs, s.spl, 10);
  const peakZ = Math.max(...s.zmag);
  const fb = (box === 'vented') ? tuningFromLength(p.Vb, p.ventL, p.Sp || Math.PI*(p.ventD/2)**2, p.endCorrection) : null;
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
    <span>Vb: <b>{{ fmtU(stats.Vb, 'Vb', 'volume', 'L', 1) }} {{ unitLabelOf('Vb', 'volume', 'L') }}</b></span>
    <span v-if="stats.fc">fc: <b>{{ fmtU(stats.fc, 'rearResonance', 'freq', 'Hz', 1) }} {{ unitLabelOf('rearResonance', 'freq', 'Hz') }}</b></span>
    <span v-if="stats.Qtc">Qtc: <b>{{ stats.Qtc.toFixed(3) }}</b></span>
    <span v-if="stats.fb">Fb: <b>{{ fmtU(stats.fb, 'ventFb', 'freq', 'Hz', 1) }} {{ unitLabelOf('ventFb', 'freq', 'Hz') }}</b></span>
    <span v-if="stats.fp">Fp: <b>{{ fmtU(stats.fp, 'prFp', 'freq', 'Hz', 1) }} {{ unitLabelOf('prFp', 'freq', 'Hz') }}</b></span>
    <span>F3: <b>{{ stats.f3 != null ? `${fmtU(stats.f3, 'f3', 'freq', 'Hz', 1)} ${unitLabelOf('f3', 'freq', 'Hz')}` : '—' }}</b></span>
    <span>F6: <b>{{ stats.f6 != null ? `${fmtU(stats.f6, 'f6', 'freq', 'Hz', 1)} ${unitLabelOf('f6', 'freq', 'Hz')}` : '—' }}</b></span>
    <span>F10: <b>{{ stats.f10 != null ? `${fmtU(stats.f10, 'f10', 'freq', 'Hz', 1)} ${unitLabelOf('f10', 'freq', 'Hz')}` : '—' }}</b></span>
    <span>Z peak: <b>{{ stats.peakZ.toFixed(1) }} Ω</b></span>
    <span v-if="stats.maxPV != null">peak port: <b>{{ stats.maxPV.toFixed(1) }} m/s</b></span>
    <span v-if="stats.maxPRx != null">
      peak PR: <b>{{ fmtU(stats.maxPRx / 1000, 'prXmax', 'length', 'mm', 1) }} {{ unitLabelOf('prXmax', 'length', 'mm') }}</b>
      (Xmax {{ fmtU(stats.prXmax, 'prXmax', 'length', 'mm', 1) }})
    </span>
    <span>EBP: <b>{{ stats.ebpVal.toFixed(0) }}</b></span>
    </template>
  </div>
</template>
