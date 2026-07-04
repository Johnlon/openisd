<script setup lang="ts">
import { computed, ref, reactive, watch, nextTick } from 'vue';
import { state, driver, allIssues, driverShort } from '../store.js';
import type { DriverRaw } from '@openisd/engine';
import DriverDefineModal from './DriverDefineModal.vue';

type NumKey = 'Fs' | 'Qts' | 'Qes' | 'Qms' | 'Vas' | 'Sd' | 'Re' | 'Le' | 'Xmax' | 'Pe';
type MyDriver = DriverRaw & { _savedAt?: number };

const MY_DRIVERS_KEY = 'openisd_my_drivers';

function loadMyDrivers(): MyDriver[] {
  try { return JSON.parse(localStorage.getItem(MY_DRIVERS_KEY) ?? '[]'); } catch { return []; }
}
function saveMyDrivers(list: MyDriver[]) {
  try { localStorage.setItem(MY_DRIVERS_KEY, JSON.stringify(list)); } catch { /* storage disabled/full — non-fatal */ }
}

const savingMode = ref(false);
const saveName   = ref('');

function startSave() {
  saveName.value = state.driverRaw.name || 'Custom Driver';
  savingMode.value = true;
  nextTick(() => document.querySelector<HTMLInputElement>('.save-name-input')?.select());
}

function confirmSave() {
  const name = saveName.value.trim() || state.driverRaw.name || 'Custom Driver';
  const list = loadMyDrivers();
  const entry: MyDriver = { ...state.driverRaw, name, _savedAt: Date.now() };
  const idx = list.findIndex(d => d.name === name);
  if (idx >= 0) list[idx] = entry; else list.push(entry);
  saveMyDrivers(list);
  state.driverRaw.name = name;
  state.driverSource = { ...state.driverRaw };
  state.editDriver = false;
  savingMode.value = false;
}

let _skipNextRename = false;

function resetToSource() {
  _skipNextRename = true;
  state.driverRaw = { ...state.driverSource };
  nextTick(() => { _skipNextRename = false; });
}

const TS_KEYS: NumKey[] = ['Fs', 'Qts', 'Qes', 'Qms', 'Vas', 'Sd', 'Re', 'Le', 'Xmax', 'Pe'];
watch(
  () => TS_KEYS.map(k => state.driverRaw[k]),
  () => {
    if (_skipNextRename || !state.editDriver || !state.driverSource) return;
    if (!state.driverRaw.name?.startsWith('Custom - ')) {
      state.driverRaw.name = 'Custom - ' + (state.driverSource.name || 'Driver');
    }
  }
);
import { ebp } from '@openisd/engine';

// Display view of the raw driver. The T/S numeric fields are treated as present
// for display formatting (the editor binds to them directly); if one is genuinely
// absent the arithmetic yields NaN exactly as before — the cast is compile-time only.
const d = computed(() => state.driverRaw as DriverRaw & Record<NumKey, number>);
const drv = driver;

const ebpVal = computed(() => { const dv = drv.value; return dv ? ebp(dv) : null; });
const sug = computed(() => {
  const e = ebpVal.value;
  if (e == null) return '—';
  return e < 50 ? 'sealed' : e > 100 ? 'vented' : 'sealed or vented';
});

const dismissed = ref(false);
watch(driver, () => { dismissed.value = false; });
// Any error-level issue means the driver cannot be simulated at all (charts blocked).
// Warn-level issues (Pe/Xmax) only drop a reference line — the sim still runs.
const hasError = computed(() => allIssues.value.some(e => e.level === 'error'));

function startEdit() {
  if (!state.driverSource) state.driverSource = { ...state.driverRaw };
  state.editDriver = true;
}

const drvLinks = computed(() => {
  const r = state.driverRaw;
  const links = [];
  if (r.datasheetUrl)  links.push({ href: r.datasheetUrl,  label: 'Datasheet ↗',   title: 'Open manufacturer datasheet PDF' });
  if (r.manuPageUrl)   links.push({ href: r.manuPageUrl,   label: 'Manufacturer ↗', title: 'Open manufacturer product page' });
  if (r.vendorpageUrl && r.vendorpageUrl !== r.manuPageUrl)
    links.push({ href: r.vendorpageUrl, label: 'Vendor ↗', title: 'Open vendor/retailer product listing' });
  if (r.sourceUrl && r.sourceUrl !== r.vendorpageUrl && r.sourceUrl !== r.manuPageUrl)
    links.push({ href: r.sourceUrl, label: 'Source ↗', title: 'Source where T/S data was obtained' });
  if (r.frdUrl)        links.push({ href: r.frdUrl,        label: 'FRD/ZMA ↗',     title: 'Download frequency response & impedance measurement data' });
  if (r.impedanceUrl && r.impedanceUrl !== r.frdUrl)
    links.push({ href: r.impedanceUrl, label: 'Impedance ↗', title: 'Download impedance curve data' });
  return links;
});

// Reasonable physical ranges for edit inputs (in display units)
const RANGES: Record<string, { min: number; max: number }> = {
  Fs:   { min: 1,      max: 5000 },
  Qts:  { min: 0.01,   max: 20   },
  Qes:  { min: 0.01,   max: 20   },
  Qms:  { min: 0.05,   max: 200  },
  Vas:  { min: 0.001,  max: 10000 },  // litres
  Sd:   { min: 0.5,    max: 6000  },  // cm²
  Re:   { min: 0.1,    max: 300   },  // Ω
  Le:   { min: 0,      max: 100   },  // mH (0 = resistive, allowed)
  Xmax: { min: 0.1,    max: 500   },  // mm
  Pe:   { min: 0.1,    max: 50000 },  // W
};

function isValid(key: string, displayVal: string): boolean {
  const r = RANGES[key];
  if (!r) return true;
  const v = parseFloat(displayVal);
  return isFinite(v) && v >= r.min && v <= r.max;
}

// Track raw typed strings so :value doesn't fight the user mid-keystroke.
// Cleared on blur so the input normalises to the stored value.
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
  if (isFinite(parsed)) state.driverRaw[key] = parsed / scale;
}
function numBlur(key: string) { delete rawVals[key]; }

function applyDefine(raw: DriverRaw) {
  state.driverRaw = raw;
  state.driverSource = { ...raw };
  state.defineOpen = false;
}
</script>

<template>
  <fieldset>
    <legend>Driver</legend>
    <div v-if="allIssues.length && !dismissed" class="drv-issues" :class="{ 'is-error': hasError }">
      <div class="drv-issues-head">
        <span>{{ hasError ? '⛔ Cannot simulate — fix these:' : '⚠ Some reference lines are missing:' }}</span>
        <button class="drv-warn-x" @click="dismissed = true" title="Dismiss this list of issues">✕</button>
      </div>
      <ul class="drv-issues-list">
        <li v-for="e in allIssues" :key="e.level + e.field" :class="e.level">{{ e.message }}</li>
      </ul>
    </div>
    <div class="row" style="margin-bottom:6px">
      <button style="flex:1" @click="state.browseOpen = true" title="Browse the driver library — click any driver to see its specs, then load it into the current design">Browse / Select…</button>
      <button style="flex:1" @click="state.defineOpen = true" title="Enter T/S parameters from a datasheet to create a new custom driver model">Define new…</button>
    </div>
    <DriverDefineModal :open="state.defineOpen" @close="state.defineOpen = false" @apply="applyDefine" />
    <template v-if="!state.editDriver">
      <div class="drvsum" @click="startEdit" title="Click to open What-If editor — tweak T/S parameters to explore box designs without changing the library entry">
        <span class="nm">{{ driverShort(d) }}</span>
        <span class="drvlinks">
          <a v-if="d.datasheetUrl" :href="d.datasheetUrl" target="_blank" rel="noopener"
             :title="d.datasheetUrl.match(/\.pdf(\?|$)/i) ? 'Open datasheet PDF' : 'Open product page'"
             @click.stop>{{ d.datasheetUrl.match(/\.pdf(\?|$)/i) ? 'PDF' : '↗' }}</a>
        </span>
        <span class="ed">What-If? ✎</span>
      </div>
      <div class="drvspecs">
        <span class="ds">Fs <b>{{ (+d.Fs||0).toFixed(0) }} Hz</b></span> ·
        <span class="ds">Qts <b>{{ (drv?.Qts||0).toFixed(3) }}</b></span> ·
        <span class="ds">Vas <b>{{ (d.Vas*1000).toFixed(1) }} L</b></span> ·
        <span class="ds">Sd <b>{{ (d.Sd*1e4).toFixed(0) }} cm²</b></span> ·
        <span class="ds">Re <b>{{ (+d.Re||0).toFixed(1) }} Ω</b></span> ·
        <span class="ds">Xmax <b>{{ (d.Xmax*1000).toFixed(1) }} mm</b></span> ·
        <span class="ds"
              title="EBP = Fs / Qes — Efficiency Bandwidth Product. Below 50: sealed enclosure preferred. Above 100: vented preferred. 50–100: either works well.">EBP <b>{{ ebpVal != null ? ebpVal.toFixed(0) : '—' }}</b> → {{ sug }}</span> ·
        <span class="ds">Bl <b>{{ drv?.Bl != null ? drv.Bl.toFixed(2) : '—' }} T·m</b></span> ·
        <span class="ds">Mms <b>{{ drv?.Mms != null ? (drv.Mms*1000).toFixed(1) : '—' }} g</b></span>
      </div>
      <div v-if="d.providedBy || d.comment || drvLinks.length" class="drvsource">
        <span v-if="d.providedBy || d.comment">{{ [d.providedBy, d.comment].filter(Boolean).join(' · ') }}</span>
        <template v-for="(lnk, i) in drvLinks" :key="lnk.href">
          <span v-if="i === 0 && (d.providedBy || d.comment)"> · </span>
          <span v-else-if="i > 0"> · </span>
          <a :href="lnk.href" target="_blank" rel="noopener" :title="lnk.title">{{ lnk.label }}</a>
        </template>
      </div>
    </template>
    <template v-else>
      <div class="whatif-hint">
        Tweak specs for what-if analysis. Hit <b>Save to My Drivers</b> to keep this as a custom model, or <b>Done</b> to close without saving.
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
      <div class="ts-refs">
        <a href="https://en.wikipedia.org/wiki/Thiele/Small_parameters"
           target="_blank" rel="noopener" title="Wikipedia: Thiele/Small parameters — definitions, equations, and units">
          Wikipedia: T/S Parameters
        </a>
        ·
        <a href="https://www.youtube.com/watch?v=JdQ3mLU5zBE"
           target="_blank" rel="noopener" title="T/S Parameters Explained — YouTube video guide">
          T/S Parameters Explained ▶
        </a>
      </div>
      <div v-if="drvLinks.length" class="drvsource" style="margin-top:4px">
        <template v-for="(lnk, i) in drvLinks" :key="lnk.href">
          <span v-if="i > 0"> · </span>
          <a :href="lnk.href" target="_blank" rel="noopener" :title="lnk.title">{{ lnk.label }}</a>
        </template>
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
                :title="state.driverSource ? 'Reset all parameters back to ' + state.driverSource.name : 'No original to reset to — load a driver from the library first'">Reset</button>
        <button @click="startSave"
                title="Save this driver (with tweaked specs) to My Drivers in the browser library">Save to My Drivers</button>
        <button @click="state.editDriver = false; savingMode = false"
                title="Collapse the driver parameter editor and return to the summary view">Done</button>
      </div>
    </template>
  </fieldset>
</template>
