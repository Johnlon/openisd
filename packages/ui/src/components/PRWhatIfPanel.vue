<script setup lang="ts">
import { computed } from 'vue';
import { state, driver } from '../store.js';
import { precision as fieldDp } from '../fields/fieldRegistry.js';
import { prTuning, prMassForFp, ventedAlignment } from '@openisd/engine';
import NumInput from './NumInput.vue';

// PR "What-If" — an overlay, not a modal: added mass is the one PR parameter meant
// to be tuned live while watching the graph (WinISD ref view_3_passive_radiator.png
// "User options" box), so this floats without a backdrop and never covers the chart.

const emit = defineEmits<{ close: [] }>();
const P = computed(() => state.P);
const drv = driver;
const fp = computed(() => prTuning(P.value));
const prFsLoaded = computed(() => {
  const { prMmd, prMadd, prCms } = P.value;
  const m = prMmd + prMadd;
  return m > 0 && prCms > 0 ? 1 / (2 * Math.PI * Math.sqrt(m * prCms)) : 0;
});
function autoPRMass() {
  if (!drv.value) return;
  const target = ventedAlignment(drv.value).Fb;
  const totalMass = prMassForFp(state.P, target);
  state.P.prMadd = Math.max(0, totalMass - state.P.prMmd);
}
function close() { emit('close'); }
</script>

<template>
  <div class="prwi">
    <div class="whatif-hint">What-If: added mass updates the graph live.</div>
    <div class="row" title="Extra mass bolted to the PR cone. Shifts Fp down. WinISD: 'Added mass'.">
      <label>Added mass</label>
      <NumInput v-model="state.P.prMadd" :scale="1000" :precision="fieldDp('prMadd')" />
      <span class="u">g</span>
    </div>
    <div class="row" title="Total moving mass = Mms + added mass.">
      <label>Total Mms</label>
      <span class="pr-roval">{{ ((P.prMmd + P.prMadd)*1000).toPrecision(4) }} g</span>
      <span class="u"></span>
    </div>
    <div class="row">
      <label></label>
      <span style="font-size:11px;color:var(--acc2)" title="PR in-box tuning frequency. WinISD: Fp.">Fp ≈ <b>{{ fp.toFixed(1) }} Hz</b></span>
    </div>
    <div class="row" title="Free-air PR resonance with added mass, no box. WinISD: 'Fs with added mass'.">
      <label></label>
      <span style="font-size:11px;color:var(--mut)">Fs+mass ≈ {{ prFsLoaded.toFixed(1) }} Hz</span>
    </div>
    <div class="btns" style="margin-top:6px">
      <button @click="autoPRMass" title="Sets added mass so Fp matches the B4 alignment for this driver">Tune added mass to B4 Fp</button>
      <button class="pri" @click="close" title="Close">Done</button>
    </div>
  </div>
</template>

<style scoped>
/* position:fixed (not absolute) — escapes the tab's own small height-budget
   ancestor so the overlay always has room, matching DriverWhatIfPanel. */
.prwi { position: fixed; right: 24px; bottom: 24px; z-index: 20; width: 280px;
  max-height: 80vh; overflow-y: auto;
  background: var(--panel); border: 1px solid var(--line); border-radius: 8px;
  box-shadow: 0 6px 24px rgba(0,0,0,.35); padding: 10px 12px; }
.prwi .pri { background: var(--acc); color: #fff; border-color: var(--acc); }
</style>
