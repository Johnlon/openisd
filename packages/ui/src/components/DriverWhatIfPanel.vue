<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { state, driver, driverRaw, enterDriverField, setDriverFromRaw } from '../store.js';
import type { DriverRaw } from '@openisd/engine';
import { ebp } from '@openisd/engine';

// Inline What-If editor — NOT a modal. It replaces the Driver-tab summary in place
// (mounted by the caller only while state.editDriver is true) so the graph stays
// fully visible and keeps redrawing live as fields change, via the same reactive
// driverRaw/enterDriverField path the graph's own computed chain already reads.
//
// Four distinct actions, all scoped to what they touch:
// - Reset            → back to the common/library model (state.driverSource). Stays open.
// - Cancel            → back to how the driver was when THIS edit session opened
//                        (sessionSnapshot). Closes.
// - Save to My Drivers → asks for a name, writes ONLY to the My Drivers list.
//                        Never renames/touches the current project driver. Stays open.
// - Done              → the live in-memory edits already ARE the project's driver
//                        (nothing else to commit). Closes. Never touches My Drivers.

type NumKey = 'Fs' | 'Qts' | 'Qes' | 'Qms' | 'Vas' | 'Sd' | 'Re' | 'Le' | 'Xmax' | 'Pe';
const MY_DRIVERS_KEY = 'openisd_my_drivers';
type MyDriver = DriverRaw & { _savedAt?: number };

function loadMyDrivers(): MyDriver[] {
  try { return JSON.parse(localStorage.getItem(MY_DRIVERS_KEY) ?? '[]'); } catch { return []; }
}
function saveMyDrivers(list: MyDriver[]) {
  try { localStorage.setItem(MY_DRIVERS_KEY, JSON.stringify(list)); } catch { /* storage disabled/full — non-fatal */ }
}

// Snapshot taken the moment this editing session opens — Cancel reverts to exactly
// this, independent of state.driverSource (which is the original library model, not
// "how things were 30 seconds ago in this session").
let sessionSnapshot: DriverRaw = { ...driverRaw.value };
watch(() => state.editDriver, (open) => { if (open) sessionSnapshot = { ...driverRaw.value }; }, { immediate: true });

const savingMode = ref(false);
const saveName   = ref('');

function startSave() {
  saveName.value = driverRaw.value.name || 'Custom Driver';
  savingMode.value = true;
}
function confirmSave() {
  const name = saveName.value.trim() || driverRaw.value.name || 'Custom Driver';
  const list = loadMyDrivers();
  const entry: MyDriver = { ...driverRaw.value, name, _savedAt: Date.now() };
  const idx = list.findIndex(d => d.name === name);
  if (idx >= 0) list[idx] = entry; else list.push(entry);
  saveMyDrivers(list);
  // Deliberately does NOT rename/update the live project driver — only the My
  // Drivers list gets the new name.
  savingMode.value = false;
}

function resetToCommon() {
  if (state.driverSource) setDriverFromRaw(state.driverSource);
}
function cancelEdit() {
  setDriverFromRaw(sessionSnapshot);
  savingMode.value = false;
  state.editDriver = false;
}
function done() {
  savingMode.value = false;
  state.editDriver = false;
}

const d = computed(() => driverRaw.value as DriverRaw & Record<NumKey, number>);
const drv = driver;
const ebpVal = computed(() => { const dv = drv.value; return dv ? ebp(dv) : null; });
const sug = computed(() => {
  const e = ebpVal.value;
  if (e == null) return '—';
  return e < 50 ? 'sealed' : e > 100 ? 'vented' : 'sealed or vented';
});

const RANGES: Record<string, { min: number; max: number }> = {
  Fs:   { min: 1,      max: 5000 },
  Qts:  { min: 0.01,   max: 20   },
  Qes:  { min: 0.01,   max: 20   },
  Qms:  { min: 0.05,   max: 200  },
  Vas:  { min: 0.001,  max: 10000 },
  Sd:   { min: 0.5,    max: 6000  },
  Re:   { min: 0.1,    max: 300   },
  Le:   { min: 0,      max: 100   },
  Xmax: { min: 0.1,    max: 500   },
  Pe:   { min: 0.1,    max: 50000 },
};

function isValid(key: string, displayVal: string): boolean {
  const r = RANGES[key];
  if (!r) return true;
  const v = parseFloat(displayVal);
  return isFinite(v) && v >= r.min && v <= r.max;
}

const rawVals = reactive<Record<string, string>>({});
function rawOrFmt(key: string, formattedVal: string): string {
  return key in rawVals ? rawVals[key] : formattedVal;
}
function badInput(key: string, formattedVal: string): boolean {
  return !isValid(key, rawOrFmt(key, formattedVal));
}
function numInput(key: NumKey, scale: number, val: string) {
  rawVals[key] = val;
  const parsed = parseFloat(val);
  if (isFinite(parsed)) enterDriverField(key, parsed / scale);
}
function numBlur(key: string) { delete rawVals[key]; }
</script>

<template>
  <div class="dep">
    <div class="whatif-hint">
      What-If: changes apply live to the current project only — the graph updates as you
      type. The shared driver library is never modified.
    </div>
    <div class="row"><label>Fs</label>
      <input type="number" step="any" min="1" max="5000"
             :value="rawOrFmt('Fs',(+d.Fs).toFixed(1))"
             :class="{ 'inp-bad': badInput('Fs',(+d.Fs).toFixed(1)) }"
             @input="e => numInput('Fs',1,(e.target as HTMLInputElement).value)" @blur="numBlur('Fs')"
             title="Free-air resonance frequency — from datasheet. WinISD: Fs. Must be 1–5000 Hz">
      <span class="u">Hz</span></div>
    <div class="row"><label>Qts</label>
      <input type="number" step="any" min="0.01" max="20"
             :value="rawOrFmt('Qts',(+d.Qts).toPrecision(3))"
             :class="{ 'inp-bad': badInput('Qts',(+d.Qts).toPrecision(3)) }"
             @input="e => numInput('Qts',1,(e.target as HTMLInputElement).value)" @blur="numBlur('Qts')"
             title="Total Q factor = Qes·Qms/(Qes+Qms) — from datasheet. WinISD: Qts. Must be 0.01–20">
      <span class="u"></span></div>
    <div class="row"><label>Qes</label>
      <input type="number" step="any" min="0.01" max="20"
             :value="rawOrFmt('Qes',(+d.Qes).toPrecision(3))"
             :class="{ 'inp-bad': badInput('Qes',(+d.Qes).toPrecision(3)) }"
             @input="e => numInput('Qes',1,(e.target as HTMLInputElement).value)" @blur="numBlur('Qes')"
             title="Electrical Q factor — motor damping. From datasheet. WinISD: Qes. Must be 0.01–20">
      <span class="u"></span></div>
    <div class="row"><label>Qms</label>
      <input type="number" step="any" min="0.05" max="200"
             :value="rawOrFmt('Qms',(+d.Qms).toPrecision(3))"
             :class="{ 'inp-bad': badInput('Qms',(+d.Qms).toPrecision(3)) }"
             @input="e => numInput('Qms',1,(e.target as HTMLInputElement).value)" @blur="numBlur('Qms')"
             title="Mechanical Q factor — suspension damping. From datasheet. WinISD: Qms. Must be 0.05–200">
      <span class="u"></span></div>
    <div class="row"><label>Vas</label>
      <input type="number" step="any" min="0.001" max="10000"
             :value="rawOrFmt('Vas',(d.Vas*1000).toPrecision(4))"
             :class="{ 'inp-bad': badInput('Vas',(d.Vas*1000).toPrecision(4)) }"
             @input="e => numInput('Vas',1000,(e.target as HTMLInputElement).value)" @blur="numBlur('Vas')"
             title="Equivalent compliance volume — from datasheet. WinISD: Vas. Must be 0.001–10000 L">
      <span class="u">L</span></div>
    <div class="row"><label>Sd</label>
      <input type="number" step="any" min="0.5" max="6000"
             :value="rawOrFmt('Sd',(d.Sd*1e4).toPrecision(4))"
             :class="{ 'inp-bad': badInput('Sd',(d.Sd*1e4).toPrecision(4)) }"
             @input="e => numInput('Sd',1e4,(e.target as HTMLInputElement).value)" @blur="numBlur('Sd')"
             title="Effective piston area — from datasheet. WinISD: Sd. Must be 0.5–6000 cm²">
      <span class="u">cm²</span></div>
    <div class="row"><label>Re</label>
      <input type="number" step="any" min="0.1" max="300"
             :value="rawOrFmt('Re',(+d.Re).toPrecision(3))"
             :class="{ 'inp-bad': badInput('Re',(+d.Re).toPrecision(3)) }"
             @input="e => numInput('Re',1,(e.target as HTMLInputElement).value)" @blur="numBlur('Re')"
             title="DC voice coil resistance — from datasheet. WinISD: Re. Must be 0.1–300 Ω">
      <span class="u">Ω</span></div>

    <div class="subsect">Optional</div>
    <div class="row" title="Voice coil inductance. 0 = resistive-only model. WinISD: Le. 0–100 mH">
      <label>Le <span class="opt-lbl">opt</span></label>
      <input type="number" step="any" min="0" max="100"
             :value="rawOrFmt('Le',(d.Le*1000).toPrecision(3))"
             :class="{ 'inp-bad': badInput('Le',(d.Le*1000).toPrecision(3)) }"
             @input="e => numInput('Le',1000,(e.target as HTMLInputElement).value)" @blur="numBlur('Le')">
      <span class="u">mH</span></div>
    <div class="row" title="Peak one-way linear excursion. WinISD: Xmax. 0.1–500 mm">
      <label>Xmax <span class="opt-lbl">opt</span></label>
      <input type="number" step="any" min="0.1" max="500"
             :value="rawOrFmt('Xmax',(d.Xmax*1000).toPrecision(3))"
             :class="{ 'inp-bad': badInput('Xmax',(d.Xmax*1000).toPrecision(3)) }"
             @input="e => numInput('Xmax',1000,(e.target as HTMLInputElement).value)" @blur="numBlur('Xmax')">
      <span class="u">mm</span></div>
    <div class="row" title="Rated continuous power handling. WinISD: Pe. 0.1–50000 W">
      <label>Pe <span class="opt-lbl">opt</span></label>
      <input type="number" step="any" min="0.1" max="50000"
             :value="rawOrFmt('Pe',String(+d.Pe||0))"
             :class="{ 'inp-bad': badInput('Pe',String(+d.Pe||0)) }"
             @input="e => numInput('Pe',1,(e.target as HTMLInputElement).value)" @blur="numBlur('Pe')">
      <span class="u">W</span></div>

    <div class="subsect">Derived</div>
    <div class="row pr-derived" title="Derived: Bl = √(2π·Fs·Mms·Re / Qes)">
      <label>Bl</label><span class="pr-roval">{{ drv?.Bl != null ? drv.Bl.toFixed(2) : '—' }}</span><span class="u">T·m</span>
    </div>
    <div class="row pr-derived" title="Derived: Mms = 1 / ((2π·Fs)²·Cms)">
      <label>Mms</label><span class="pr-roval">{{ drv?.Mms != null ? (drv.Mms*1000).toFixed(1) : '—' }}</span><span class="u">g</span>
    </div>
    <div class="row pr-derived" title="EBP = Fs / Qes">
      <label>EBP</label><span class="pr-roval">{{ ebpVal != null ? ebpVal.toFixed(0) : '—' }}</span>
      <span class="u" style="width:auto;white-space:nowrap">→ {{ sug }}</span>
    </div>

    <div v-if="savingMode" class="save-dlg">
      <label class="save-lbl">Save as</label>
      <input class="save-name-input" v-model="saveName"
             @keydown.enter="confirmSave" @keydown.escape="savingMode = false">
      <div class="save-btns">
        <button class="pri" @click="confirmSave" title="Save with this name to My Drivers — does not change the current project">Save</button>
        <button @click="savingMode = false" title="Cancel">Cancel</button>
      </div>
    </div>
    <div v-else class="btns">
      <button :disabled="!state.driverSource" @click="resetToCommon"
              :title="state.driverSource ? 'Reset all parameters back to the common library model: ' + state.driverSource.name : 'No library model to reset to'">Reset</button>
      <button @click="startSave" title="Save these specs as a named entry in My Drivers — does not change the current project">Save to My Drivers</button>
      <button @click="cancelEdit" title="Discard edits made in this session and close — reverts to how the driver was before you opened the editor">Cancel</button>
      <button class="pri" @click="done" title="Keep these edits in the current project and close">Done</button>
    </div>
  </div>
</template>

<style scoped>
.dep { display: flex; flex-direction: column; height: 100%; overflow-y: auto; padding-right: 4px; }
.dep .btns { margin-top: 8px; }
.dep .btns .pri { background: var(--acc); color: #fff; border-color: var(--acc); }
</style>
