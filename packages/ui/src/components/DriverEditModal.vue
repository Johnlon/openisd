<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { state, driver, driverRaw, enterDriverField, setDriverFromRaw } from '../store.js';
import type { DriverRaw } from '@openisd/engine';
import { ebp } from '@openisd/engine';
import { useEscToClose } from '../composables/useEscToClose.js';

// Editing here writes only into the live session driver (driverRaw, via
// enterDriverField) — the same object that gets embedded verbatim into an
// exported .wdr/project file. It NEVER touches the bundled driver library on
// disk. The only path that persists a name is "Save to My Drivers" below,
// which writes a new/updated entry to its own localStorage list — the
// standard catalogue driver this session started from is never overwritten.
// (Mirrors DriverPanel.vue's inline What-If editor — see that file if the two
// drift; a shared extraction may be worth doing later.)

type NumKey = 'Fs' | 'Qts' | 'Qes' | 'Qms' | 'Vas' | 'Sd' | 'Re' | 'Le' | 'Xmax' | 'Pe';
const MY_DRIVERS_KEY = 'openisd_my_drivers';
type MyDriver = DriverRaw & { _savedAt?: number };

function loadMyDrivers(): MyDriver[] {
  try { return JSON.parse(localStorage.getItem(MY_DRIVERS_KEY) ?? '[]'); } catch { return []; }
}
function saveMyDrivers(list: MyDriver[]) {
  try { localStorage.setItem(MY_DRIVERS_KEY, JSON.stringify(list)); } catch { /* storage disabled/full — non-fatal */ }
}

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
  enterDriverField('name', name);
  state.driverSource = { ...driverRaw.value };
  savingMode.value = false;
}

function resetToSource() {
  if (state.driverSource) setDriverFromRaw(state.driverSource);
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

function close() { state.editDriver = false; savingMode.value = false; }
function onBackdrop(e: MouseEvent) { if (e.target === e.currentTarget) close(); }
useEscToClose(() => state.editDriver, close);
</script>

<template>
  <div class="overlay" :class="{ on: state.editDriver }" @click="onBackdrop">
    <div class="modal" v-if="state.editDriver">
      <h2>Edit driver — {{ driverRaw.name || 'current driver' }}<button class="x" @click="close" title="Close">✕</button></h2>
      <div class="body">
        <div class="whatif-hint">
          Changes here apply only to the current project — the shared driver library is
          never modified. Hit <b>Save to My Drivers</b> to keep this as a named custom
          model, or <b>Done</b> to close without saving a copy.
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
        <div class="row"
             title="Voice coil inductance. Leave as 0 for a resistive-only model — affects only high-frequency impedance shape, not SPL or excursion. WinISD: Le. 0–100 mH">
          <label>Le <span class="opt-lbl">opt</span></label>
          <input type="number" step="any" min="0" max="100"
                 :value="rawOrFmt('Le',(d.Le*1000).toPrecision(3))"
                 :class="{ 'inp-bad': badInput('Le',(d.Le*1000).toPrecision(3)) }"
                 @input="e => numInput('Le',1000,(e.target as HTMLInputElement).value)" @blur="numBlur('Le')">
          <span class="u">mH</span></div>
        <div class="row"
             title="Peak one-way linear excursion. Required to show the Excursion and Max-SPL curves — omit if not on the datasheet. WinISD: Xmax. 0.1–500 mm">
          <label>Xmax <span class="opt-lbl">opt</span></label>
          <input type="number" step="any" min="0.1" max="500"
                 :value="rawOrFmt('Xmax',(d.Xmax*1000).toPrecision(3))"
                 :class="{ 'inp-bad': badInput('Xmax',(d.Xmax*1000).toPrecision(3)) }"
                 @input="e => numInput('Xmax',1000,(e.target as HTMLInputElement).value)" @blur="numBlur('Xmax')">
          <span class="u">mm</span></div>
        <div class="row"
             title="Rated continuous power handling. Required to show the Max-Power curve — omit if not on the datasheet. WinISD: Pe. 0.1–50000 W">
          <label>Pe <span class="opt-lbl">opt</span></label>
          <input type="number" step="any" min="0.1" max="50000"
                 :value="rawOrFmt('Pe',String(+d.Pe||0))"
                 :class="{ 'inp-bad': badInput('Pe',String(+d.Pe||0)) }"
                 @input="e => numInput('Pe',1,(e.target as HTMLInputElement).value)" @blur="numBlur('Pe')">
          <span class="u">W</span></div>

        <div class="subsect">Derived</div>
        <div class="row pr-derived" title="Derived: Bl = √(2π·Fs·Mms·Re / Qes) — motor force factor. WinISD: Bl">
          <label>Bl</label>
          <span class="pr-roval">{{ drv?.Bl != null ? drv.Bl.toFixed(2) : '—' }}</span>
          <span class="u">T·m</span>
        </div>
        <div class="row pr-derived" title="Derived: Mms = 1 / ((2π·Fs)²·Cms) — total moving mass including air load. WinISD: Mms">
          <label>Mms</label>
          <span class="pr-roval">{{ drv?.Mms != null ? (drv.Mms*1000).toFixed(1) : '—' }}</span>
          <span class="u">g</span>
        </div>
        <div class="row pr-derived" title="Derived: Cms = Vas / (ρc²·Sd²) — mechanical compliance of suspension. WinISD: Cms">
          <label>Cms</label>
          <span class="pr-roval">{{ drv?.Cms != null ? (drv.Cms*1000).toFixed(3) : '—' }}</span>
          <span class="u">mm/N</span>
        </div>
        <div class="row pr-derived" title="EBP = Fs / Qes — Efficiency Bandwidth Product. Below 50: sealed preferred. Above 100: vented preferred. 50–100: either works">
          <label>EBP</label>
          <span class="pr-roval">{{ ebpVal != null ? ebpVal.toFixed(0) : '—' }}</span>
          <span class="u" style="width:auto;white-space:nowrap">→ {{ sug }}</span>
        </div>

        <div v-if="savingMode" class="save-dlg">
          <label class="save-lbl">Save as</label>
          <input class="save-name-input" v-model="saveName"
                 @keydown.enter="confirmSave" @keydown.escape="savingMode = false">
          <div class="save-btns">
            <button class="pri" @click="confirmSave" title="Save with this name to My Drivers">Save</button>
            <button @click="savingMode = false" title="Cancel">Cancel</button>
          </div>
        </div>
        <div v-else class="btns">
          <button :disabled="!state.driverSource"
                  @click="resetToSource"
                  :title="state.driverSource ? 'Reset all parameters back to ' + state.driverSource.name : 'No original to reset to'">Reset</button>
          <button @click="startSave"
                  title="Save this driver (with tweaked specs) to My Drivers in the browser library">Save to My Drivers</button>
          <button @click="close" title="Close without saving a named copy">Done</button>
        </div>
      </div>
    </div>
  </div>
</template>
