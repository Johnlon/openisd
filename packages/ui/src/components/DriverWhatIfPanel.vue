<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { state, driver, driverRaw, enterDriverField, setDriverFromRaw } from '../store.js';
import type { DriverRaw } from '@openisd/engine';
import { ebp } from '@openisd/engine';

// Driver "What-If" — a floating OVERLAY, not a modal and not an inline swap: it
// anchors over the Driver-tab pane (its parent, .cl-driver, is position:relative)
// so the graph in the row above stays fully visible and keeps redrawing live as
// fields change, via the same reactive driverRaw/enterDriverField path the graph's
// own computed chain already reads. Field groups are horizontal (label above box,
// unit beside), matching WinISD's own Parameters-tab layout
// (docs/winisd/edit_driver_pg2_parameters.png) — but keep OUR field order
// (Fs/Qts/Qes/Qms/Vas/Sd/Re) for in-app familiarity rather than WinISD's own order.
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
  <div class="dwi">
    <div class="whatif-hint">
      What-If: changes apply live to the current project only — the graph updates as you
      type. The shared driver library is never modified.
    </div>

    <div class="dwi-row">
      <div class="dwi-fld"><label>Fs</label>
        <div class="dwi-unit">
          <input type="number" step="any" min="1" max="5000"
                 :value="rawOrFmt('Fs',(+d.Fs).toFixed(2))"
                 :class="{ 'inp-bad': badInput('Fs',(+d.Fs).toFixed(2)) }"
                 @input="e => numInput('Fs',1,(e.target as HTMLInputElement).value)" @blur="numBlur('Fs')"
                 title="Free-air resonance frequency — from datasheet. WinISD: Fs. Must be 1–5000 Hz">
          <span>Hz</span>
        </div>
      </div>
      <div class="dwi-fld"><label>Qts</label>
        <div class="dwi-unit">
          <input type="number" step="any" min="0.01" max="20"
                 :value="rawOrFmt('Qts',(+d.Qts).toFixed(3))"
                 :class="{ 'inp-bad': badInput('Qts',(+d.Qts).toFixed(3)) }"
                 @input="e => numInput('Qts',1,(e.target as HTMLInputElement).value)" @blur="numBlur('Qts')"
                 title="Total Q factor = Qes·Qms/(Qes+Qms) — from datasheet. WinISD: Qts. Must be 0.01–20">
          <span></span>
        </div>
      </div>
      <div class="dwi-fld"><label>Qes</label>
        <div class="dwi-unit">
          <input type="number" step="any" min="0.01" max="20"
                 :value="rawOrFmt('Qes',(+d.Qes).toFixed(3))"
                 :class="{ 'inp-bad': badInput('Qes',(+d.Qes).toFixed(3)) }"
                 @input="e => numInput('Qes',1,(e.target as HTMLInputElement).value)" @blur="numBlur('Qes')"
                 title="Electrical Q factor — motor damping. From datasheet. WinISD: Qes. Must be 0.01–20">
          <span></span>
        </div>
      </div>
      <div class="dwi-fld"><label>Qms</label>
        <div class="dwi-unit">
          <input type="number" step="any" min="0.05" max="200"
                 :value="rawOrFmt('Qms',(+d.Qms).toFixed(3))"
                 :class="{ 'inp-bad': badInput('Qms',(+d.Qms).toFixed(3)) }"
                 @input="e => numInput('Qms',1,(e.target as HTMLInputElement).value)" @blur="numBlur('Qms')"
                 title="Mechanical Q factor — suspension damping. From datasheet. WinISD: Qms. Must be 0.05–200">
          <span></span>
        </div>
      </div>
    </div>

    <div class="dwi-row">
      <div class="dwi-fld"><label>Vas</label>
        <div class="dwi-unit">
          <input type="number" step="any" min="0.001" max="10000"
                 :value="rawOrFmt('Vas',(d.Vas*1000).toFixed(2))"
                 :class="{ 'inp-bad': badInput('Vas',(d.Vas*1000).toFixed(2)) }"
                 @input="e => numInput('Vas',1000,(e.target as HTMLInputElement).value)" @blur="numBlur('Vas')"
                 title="Equivalent compliance volume — from datasheet. WinISD: Vas. Must be 0.001–10000 L">
          <span>L</span>
        </div>
      </div>
      <div class="dwi-fld"><label>Sd</label>
        <div class="dwi-unit">
          <input type="number" step="any" min="0.5" max="6000"
                 :value="rawOrFmt('Sd',(d.Sd*1e4).toFixed(1))"
                 :class="{ 'inp-bad': badInput('Sd',(d.Sd*1e4).toFixed(1)) }"
                 @input="e => numInput('Sd',1e4,(e.target as HTMLInputElement).value)" @blur="numBlur('Sd')"
                 title="Effective piston area — from datasheet. WinISD: Sd. Must be 0.5–6000 cm²">
          <span>cm²</span>
        </div>
      </div>
      <div class="dwi-fld"><label>Re</label>
        <div class="dwi-unit">
          <input type="number" step="any" min="0.1" max="300"
                 :value="rawOrFmt('Re',(+d.Re).toFixed(2))"
                 :class="{ 'inp-bad': badInput('Re',(+d.Re).toFixed(2)) }"
                 @input="e => numInput('Re',1,(e.target as HTMLInputElement).value)" @blur="numBlur('Re')"
                 title="DC voice coil resistance — from datasheet. WinISD: Re. Must be 0.1–300 Ω">
          <span>Ω</span>
        </div>
      </div>
    </div>

    <div class="subsect">Optional</div>
    <div class="dwi-row">
      <div class="dwi-fld"><label>Le <span class="opt-lbl">opt</span></label>
        <div class="dwi-unit">
          <input type="number" step="any" min="0" max="100"
                 :value="rawOrFmt('Le',(d.Le*1000).toFixed(2))"
                 :class="{ 'inp-bad': badInput('Le',(d.Le*1000).toFixed(2)) }"
                 @input="e => numInput('Le',1000,(e.target as HTMLInputElement).value)" @blur="numBlur('Le')"
                 title="Voice coil inductance. 0 = resistive-only model. WinISD: Le. 0–100 mH">
          <span>mH</span>
        </div>
      </div>
      <div class="dwi-fld"><label>Xmax <span class="opt-lbl">opt</span></label>
        <div class="dwi-unit">
          <input type="number" step="any" min="0.1" max="500"
                 :value="rawOrFmt('Xmax',(d.Xmax*1000).toFixed(1))"
                 :class="{ 'inp-bad': badInput('Xmax',(d.Xmax*1000).toFixed(1)) }"
                 @input="e => numInput('Xmax',1000,(e.target as HTMLInputElement).value)" @blur="numBlur('Xmax')"
                 title="Peak one-way linear excursion. WinISD: Xmax. 0.1–500 mm">
          <span>mm</span>
        </div>
      </div>
      <div class="dwi-fld"><label>Pe <span class="opt-lbl">opt</span></label>
        <div class="dwi-unit">
          <input type="number" step="any" min="0.1" max="50000"
                 :value="rawOrFmt('Pe',String(+d.Pe||0))"
                 :class="{ 'inp-bad': badInput('Pe',String(+d.Pe||0)) }"
                 @input="e => numInput('Pe',1,(e.target as HTMLInputElement).value)" @blur="numBlur('Pe')"
                 title="Rated continuous power handling. WinISD: Pe. 0.1–50000 W">
          <span>W</span>
        </div>
      </div>
    </div>

    <div class="subsect">Derived</div>
    <div class="dwi-row">
      <div class="dwi-fld dwi-ro" title="Derived: Bl = √(2π·Fs·Mms·Re / Qes)"><label>Bl</label>
        <div class="dwi-unit"><span class="dwi-roval">{{ drv?.Bl != null ? drv.Bl.toFixed(2) : '—' }}</span><span>T·m</span></div>
      </div>
      <div class="dwi-fld dwi-ro" title="Derived: Mms = 1 / ((2π·Fs)²·Cms)"><label>Mms</label>
        <div class="dwi-unit"><span class="dwi-roval">{{ drv?.Mms != null ? (drv.Mms*1000).toFixed(1) : '—' }}</span><span>g</span></div>
      </div>
      <div class="dwi-fld dwi-ro" title="EBP = Fs / Qes"><label>EBP</label>
        <div class="dwi-unit"><span class="dwi-roval">{{ ebpVal != null ? ebpVal.toFixed(0) : '—' }}</span><span style="white-space:nowrap">→ {{ sug }}</span></div>
      </div>
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
/* position:fixed (not absolute) — the Driver tab's content pane has its own small
   fixed-height budget (.cl-br), too short to contain all these fields; fixed
   positioning escapes that ancestor clipping and anchors to the viewport instead,
   so the overlay always has room regardless of the tab's own height budget. */
.dwi { position: fixed; right: 24px; bottom: 24px; z-index: 20; width: 460px; max-width: calc(100vw - 32px);
  max-height: 80vh; overflow-y: auto;
  background: var(--panel); border: 1px solid var(--line); border-radius: 8px;
  box-shadow: 0 6px 24px rgba(0,0,0,.35); padding: 10px 12px; font-size: 13px; }
.dwi-row { display: flex; gap: 16px; margin: 4px 0; }
.dwi-fld { flex: 1; min-width: 0; }
.dwi-fld label { display: block; font-size: 11px; color: var(--mut); margin-bottom: 2px; }
.dwi-unit { display: flex; align-items: center; gap: 5px; }
.dwi-unit input, .dwi-roval { width: 100%; padding: 3px 6px; border: 1px solid var(--line); border-radius: 3px;
  background: var(--panel2); color: var(--fg); font: inherit; }
.dwi-roval { text-align: right; color: var(--acc2); font-style: italic; display: inline-block; }
.dwi-unit span { font-size: 11px; color: var(--mut); white-space: nowrap; }
.dwi-ro label { opacity: .8; }
.dwi .subsect { margin: 8px 0 2px; }
.dwi .btns { margin-top: 8px; }
.dwi .btns .pri { background: var(--acc); color: #fff; border-color: var(--acc); }
</style>
