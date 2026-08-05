<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { state, driver, driverRaw, driverCell, driverJSON, driverBaseline, driverBaselineName,
         driverConsistencyIssues, enterDriverField, clearDriverField, resetDriverToBaseline,
         revertDriverTo } from '../store.js';
import { ebp } from '@openisd/engine';
import { upsertMyDriver } from '../utils/myDrivers.js';
import { cellClassOf, useQGroupIncomplete, consistencyNote, Q_GROUP } from '../composables/useDriverCells.js';
import NumInput from './NumInput.vue';

// Inline What-If editor — NOT a modal. It replaces the Driver-tab summary in place
// (mounted by the caller only while state.editDriver is true) so the graph stays
// fully visible and keeps redrawing live as fields change, via the same reactive
// driverRaw/enterDriverField path the graph's own computed chain already reads.
//
// Four distinct actions, all scoped to what they touch:
// - Reset            → back to the common/library model (the driver baseline). Stays open.
// - Cancel            → back to how the driver was when THIS edit session opened
//                        (sessionSnapshot). Closes.
// - Save to My Drivers → asks for a name, writes ONLY to the My Drivers list.
//                        Never renames/touches the current project driver. Stays open.
// - Done              → the live in-memory edits already ARE the project's driver
//                        (nothing else to commit). Closes. Never touches My Drivers.

type NumKey = 'Fs' | 'Qts' | 'Qes' | 'Qms' | 'Vas' | 'Sd' | 'Re' | 'Le' | 'Xmax' | 'Pe' | 'Bl' | 'Mms';

/** One editable driver field on this panel: its display scale, unit, dp and tooltip. */
interface Fld { key: NumKey; label: string; scale: number; dp: number; unit: string; title: string }

const MAIN: Fld[] = [
  { key: 'Fs',  label: 'Fs',  scale: 1,    dp: 1, unit: 'Hz',
    title: 'Free-air resonance frequency — from datasheet. WinISD: Fs. Must be 1–5000 Hz' },
  { key: 'Qts', label: 'Qts', scale: 1,    dp: 3, unit: '',
    title: 'Total Q factor = Qes·Qms/(Qes+Qms) — from datasheet. WinISD: Qts. Must be 0.01–20' },
  { key: 'Qes', label: 'Qes', scale: 1,    dp: 3, unit: '',
    title: 'Electrical Q factor — motor damping. From datasheet. WinISD: Qes. Must be 0.01–20' },
  { key: 'Qms', label: 'Qms', scale: 1,    dp: 3, unit: '',
    title: 'Mechanical Q factor — suspension damping. From datasheet. WinISD: Qms. Must be 0.05–200' },
  { key: 'Vas', label: 'Vas', scale: 1000, dp: 3, unit: 'L',
    title: 'Equivalent compliance volume — from datasheet. WinISD: Vas. Must be 0.001–10000 L' },
  { key: 'Sd',  label: 'Sd',  scale: 1e4,  dp: 1, unit: 'cm²',
    title: 'Effective piston area — from datasheet. WinISD: Sd. Must be 0.5–6000 cm²' },
  { key: 'Re',  label: 'Re',  scale: 1,    dp: 2, unit: 'Ω',
    title: 'DC voice coil resistance — from datasheet. WinISD: Re. Must be 0.1–300 Ω' },
];
const OPTIONAL: Fld[] = [
  { key: 'Le',   label: 'Le',   scale: 1000, dp: 3, unit: 'mH',
    title: 'Voice coil inductance. 0 = resistive-only model. WinISD: Le. 0–100 mH' },
  { key: 'Xmax', label: 'Xmax', scale: 1000, dp: 2, unit: 'mm',
    title: 'Peak one-way linear excursion. WinISD: Xmax. 0.1–500 mm' },
  { key: 'Pe',   label: 'Pe',   scale: 1,    dp: 1, unit: 'W',
    title: 'Rated continuous power handling. WinISD: Pe. 0.1–50000 W' },
];
// Bl and Mms are ordinary driver fields: the ADT derives them while they are not entered and
// honours them when they are (Driver.enter → E → fixed-E override), exactly as the driver
// editor treats them. The E/C colour says which of the two is happening.
const DERIVED: Fld[] = [
  { key: 'Bl',  label: 'Bl',  scale: 1,    dp: 2, unit: 'T·m',
    title: 'Motor force factor. Calculated as √(2π·Fs·Mms·Re / Qes) until you type one — then it overrides. Clear to hand it back.' },
  { key: 'Mms', label: 'Mms', scale: 1000, dp: 1, unit: 'g',
    title: 'Total moving mass. Calculated as 1 / ((2π·Fs)²·Cms) until you type one — then it overrides. Clear to hand it back.' },
];

// Snapshot taken the moment this editing session opens — Cancel reverts to exactly
// this, independent of the library baseline (the original library model, not
// "how things were 30 seconds ago in this session").
let sessionSnapshot = driverJSON.value;
watch(() => state.editDriver, (open) => { if (open) sessionSnapshot = driverJSON.value; }, { immediate: true });

const savingMode = ref(false);
const saveName   = ref('');

function startSave() {
  saveName.value = driverRaw.value.name || 'Custom Driver';
  savingMode.value = true;
}
// Keyed on the `<brand>/<model>` identity, exactly as DriverPanel's Save is: the entry
// holding that identity is overwritten, and one is added when no entry holds it.
function confirmSave() {
  const name = saveName.value.trim() || driverRaw.value.name || 'Custom Driver';
  upsertMyDriver({ ...driverRaw.value, name });
  // Deliberately does NOT rename/update the live project driver — only the My
  // Drivers list gets the new name.
  savingMode.value = false;
}

function resetToCommon() {
  resetDriverToBaseline();
}
function cancelEdit() {
  revertDriverTo(sessionSnapshot);
  savingMode.value = false;
  state.editDriver = false;
}
function done() {
  savingMode.value = false;
  state.editDriver = false;
}

const drv = driver;
const ebpVal = computed(() => { const dv = drv.value; return dv ? ebp(dv) : null; });
const sug = computed(() => {
  const e = ebpVal.value;
  if (e == null) return '—';
  return e < 50 ? 'sealed' : e > 100 ? 'vented' : 'sealed or vented';
});

// Entry bounds in DISPLAY space (the unit each field is shown in), matching the tooltips.
const RANGES: Record<NumKey, { min: number; max: number }> = {
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
  Bl:   { min: 0.01,   max: 1000  },
  Mms:  { min: 0.01,   max: 10000 },
};

function isValid(key: NumKey, displayVal: string): boolean {
  const r = RANGES[key];
  const v = parseFloat(displayVal);
  return isFinite(v) && v >= r.min && v <= r.max;
}

// While a field is focused, echo the RAW typed string so a mid-typing value is not reformatted
// out from under the caret; the buffer is dropped on blur and the model's value returns.
const rawVals = reactive<Record<string, string>>({});
// The CELL, not the entered bag: raw() holds entered fields only, so a Q the app solved from
// the other two read as NaN here. cell() carries the solved value with its C mark, which is
// what makes the third Q fill itself in as the other two change.
function disp(f: Fld): string {
  const v = driverCell(f.key).value;
  return typeof v === 'number' && isFinite(v) ? (v * f.scale).toFixed(f.dp) : '';
}
function fieldVal(f: Fld): string {
  return f.key in rawVals ? rawVals[f.key] : disp(f);
}
function numInput(f: Fld, val: string) {
  rawVals[f.key] = val;
  // Emptying a field RELEASES it back to Calculated — the override is withdrawn, not set to
  // nothing. Without this a cleared field keeps its last entered value invisibly.
  if (val.trim() === '') { clearDriverField(f.key); return; }
  const parsed = parseFloat(val);
  if (isFinite(parsed)) enterDriverField(f.key, parsed / f.scale);
}
function numBlur(key: string) { delete rawVals[key]; }

function handleInput(f: Fld, event: Event) {
  const target = event.target as HTMLInputElement;
  if (target) {
    numInput(f, target.value);
  }
}

// Any two of the Q trio solve the third, so all three are flagged together while fewer than
// two are usable. The rule itself lives in useDriverCells — the driver editor reads the same
// one, against its own draft model.
const qIncomplete = useQGroupIncomplete(driverCell);
/** Provenance mark, out-of-range flag, and the required-but-missing alert — the editor's own
 *  class vocabulary, so this panel and the dialog cannot look different for one driver. */
function fieldClasses(f: Fld): Record<string, boolean> {
  const shown = fieldVal(f);
  const mandatory = Q_GROUP.includes(f.key) && qIncomplete.value;
  return {
    [cellClassOf(driverCell(f.key).state)]: true,
    'inp-bad': shown !== '' && !isValid(f.key, shown),
    'de-input-mandatory': mandatory,
    'de-input-empty': mandatory && shown === '',
  };
}

// Consistency-group DQ mark. Typing a value that contradicts the rest of its group — an Mms
// the entered Fs and Cms cannot produce — marks EVERY member of that group, here and in the
// driver editor alike. It is a mark only: nothing on this panel is disabled by it.
const dqNote = (key: NumKey) => consistencyNote(driverConsistencyIssues.value, key);
</script>

<template>
  <div class="dep">
    <div class="whatif-hint">
      What-If: changes apply live to the current project only — the graph updates as you
      type. The shared driver library is never modified.
    </div>
    <div class="row" v-for="f in MAIN" :key="f.key" :title="f.title">
      <label>{{ f.label }}</label>
      <input type="number" step="any" :min="RANGES[f.key].min" :max="RANGES[f.key].max"
             :value="fieldVal(f)" :class="fieldClasses(f)"
             @input="handleInput(f, $event)" @blur="numBlur(f.key)">
      <span v-if="dqNote(f.key)" class="de-dq" :title="dqNote(f.key)">&#9888;</span>
      <span class="u">{{ f.unit }}</span>
    </div>

    <div class="subsect">Box</div>
    <div class="row" title="Net acoustic internal volume — excludes driver displacement, port tube volume and bracing. The same box volume the Enclosure panel edits; Cancel puts it back. WinISD: Vb.">
      <label>Box volume Vb</label>
      <NumInput v-model="state.P.Vb" :scale="1000" :precision="4" />
      <span class="u">L</span>
    </div>

    <div class="subsect">Optional</div>
    <div class="row" v-for="f in OPTIONAL" :key="f.key" :title="f.title">
      <label>{{ f.label }} <span class="opt-lbl">opt</span></label>
      <input type="number" step="any" :min="RANGES[f.key].min" :max="RANGES[f.key].max"
             :value="fieldVal(f)" :class="fieldClasses(f)"
             @input="handleInput(f, $event)" @blur="numBlur(f.key)">
      <span v-if="dqNote(f.key)" class="de-dq" :title="dqNote(f.key)">&#9888;</span>
      <span class="u">{{ f.unit }}</span>
    </div>

    <div class="subsect">Derived</div>
    <div class="row" v-for="f in DERIVED" :key="f.key" :title="f.title">
      <label>{{ f.label }}</label>
      <input type="number" step="any" :min="RANGES[f.key].min" :max="RANGES[f.key].max"
             :value="fieldVal(f)" :class="fieldClasses(f)"
             @input="handleInput(f, $event)" @blur="numBlur(f.key)">
      <span v-if="dqNote(f.key)" class="de-dq" :title="dqNote(f.key)">&#9888;</span>
      <span class="u">{{ f.unit }}</span>
    </div>
    <!-- EBP is NOT a driver field: the ADT does not derive it and has no slot to override
         (it is ebp() = Fs/Qes, computed in the engine). Making it editable means choosing
         which of Fs or Qes an entered EBP solves backwards — a decision for the human, not
         an inert box that accepts a number nothing reads. Tracked as an open question. -->
    <div class="row pr-derived" title="EBP = Fs / Qes — a read-out of the two fields above, not a field of its own.">
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
      <button :disabled="!driverBaseline" @click="resetToCommon"
              :title="driverBaseline ? 'Reset all parameters back to the common library model: ' + driverBaselineName : 'No library model to reset to'">Reset</button>
      <button @click="startSave" title="Save these specs as a named entry in My Drivers — does not change the current project">Save to My Drivers</button>
      <button @click="cancelEdit" title="Discard edits made in this session and close — reverts to how the driver was before you opened the editor">Cancel</button>
      <button class="pri" @click="done" title="Keep these edits in the current project and close">Done</button>
    </div>
  </div>
</template>

<style scoped>
.dep { display: flex; flex-direction: column; height: 100%; overflow-y: auto; padding-right: 4px; }
/* Sized to its own content, not to the rail. The shared `.row input` 96px is right in a wide
   container but leaves a numeric field half-empty in this narrow what-if panel, so it is
   overridden HERE (the consuming skin) rather than in the shared rule. 78px holds the widest
   value any of these fields shows ("6000.0" for Sd) with room to spare. */
.dep :deep(.row input) { width: 78px; flex: 0 0 78px; }
.dep .btns { margin-top: 8px; }
.dep .btns .pri { background: var(--acc); color: #fff; border-color: var(--acc); }
</style>
