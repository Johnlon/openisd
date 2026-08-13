<script setup lang="ts">
import { computed, ref } from 'vue';
import { state, driver, enterVentField } from '../../logic/store.js';
import { sealedFromQtc, ventedAlignment, LossMode } from '@openisd/engine';
import NumInput from './NumInput.vue';
import PRPanel from './PRPanel.vue';

// variant lets classic split this panel across two rail tabs: 'common' = Type/Vb/
// losses (shared by every box type, always on the "Box" tab); 'type' = the
// type-specific fields only (vented/bandpass4 — classic renders these on its
// dynamic 3rd rail tab instead). Default (unset) renders everything in one place,
// unchanged for modern.
const props = defineProps<{ variant?: 'common' | 'type' }>();
const showCommon = computed(() => props.variant !== 'type');
const showType = computed(() => props.variant !== 'common');

const P = computed(() => state.P);
const drv = driver;

// The store owns the vent group's provenance (composables/useVentGroup.ts): whichever of
// Fb / ventL is entered is held, the other is solved. Read Fb from there rather than
// recomputing it locally — the local version ignored both the entered set and the chosen end
// correction, silently always using 0.732.
const fb = computed(() => P.value.Fb);

// Typing a vent length MARKS IT ENTERED, which releases Fb to become the solved member.
// A direct write to state.P.ventL would be undone by the solver on the next change.
const ventLEntered = computed<number>({
  get: () => P.value.ventL,
  set: (v: number) => enterVentField('ventL', v),
});

// Rear-chamber-only resonance for the PR box type (WinISD: "Fh") — the sealed
// alignment Fc formula (Fc = Fs·√(1+Vas/Vb)) applied to the rear chamber alone,
// before the passive radiator's own tuning is layered on top. Standard closed-form,
// not a placeholder.
const fh = computed(() => {
  const d = drv.value;
  if (!d || !(P.value.Vb > 0)) return null;
  return d.Fs * Math.sqrt(1 + d.Vas / P.value.Vb);
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
  // The alignment's output IS a target tuning, so enter it as one and let the vent length
  // solve — rather than converting it to a length here and losing which fact was chosen.
  enterVentField('Fb', a.Fb);
}
</script>

<template>
  <fieldset>
    <legend v-if="variant !== 'type'">Enclosure</legend>
    <template v-if="showCommon">
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
      <div class="row" v-if="state.box === 'sealed'"
        title="Sealed resonance (Fsc) loss model. Lossless = fs·√(1+Vas/Vb). Conventional Lossy folds Ql/Qa into Qtc only, leaving the frequency fixed (Small/Thiele). WinISD Lossy reports the pole of the lossy 3rd-order model, so Fsc rises as Ql falls — this matches WinISD's own readout. Default: WinISD Lossy.">
        <label>Fsc model</label>
        <select id="lossmode" v-model="state.lossMode" style="flex:1">
          <option v-for="m in LossMode.ALL" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>
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
      <!-- Rear-chamber-only resonance — cheap, honest extra context for the PR type
           right where Vb is set. Full PR unit editing is under "showType" below
           (modern: same panel; classic: its own dedicated rail tab). -->
      <div class="row" v-if="state.box === 'pr'" title="Rear-chamber-only resonance if this were a plain sealed box (no PR yet). WinISD: Fh.">
        <label>Fh</label>
        <span class="pr-roval">{{ fh != null ? fh.toFixed(1) : '—' }}</span>
        <span class="u">Hz</span>
      </div>
    </template>
    <template v-if="showType">
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
          <NumInput v-model="ventLEntered" :scale="100" :precision="4" />
          <span class="u">cm</span>
        </div>
        <div class="row">
          <label></label>
          <span style="font-size:11px;color:var(--acc2)">Fb ≈ <b>{{ fb.toFixed(1) }} Hz</b></span>
        </div>
        <div class="btns">
          <button v-if="state.box === 'vented'" @click="autoVentAlign"
            title="Applies the QB3 or B4 vented alignment for this driver. Sets Vb and vent length for optimal bass-reflex tuning.">
            Auto QB3/B4 align
          </button>
        </div>
      </template>
      <template v-if="state.box === 'pr'">
        <!-- The PR unit's own specs — full editor. Classic bypasses this branch
             entirely (its dedicated Passive Radiator rail tab has its own
             summary/edit-popup/what-if-overlay); this is modern's only path. -->
        <PRPanel />
      </template>
    </template>
    <div class="btns" v-if="showCommon">
      <button v-if="state.box === 'sealed'" @click="setVbForQtc"
        title="Sets the box volume so the system Q (Qtc) equals 0.707 — the Butterworth (B2) alignment. Maximally flat frequency response.">
        Set Vb for Qtc=0.707
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
.row { margin: 1px 0; }
.btns { margin: 2px 0; }
</style>
