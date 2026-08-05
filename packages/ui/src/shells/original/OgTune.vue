<script setup lang="ts">
/**
 * Original-skin Tune panel — the mock's docked `.tune-panel`. This is a WHAT-IF editor:
 * changes preview LIVE on the charts (via the shared driver ADT's enterDriverField, the
 * same path the graph's reactive chain reads). Per STATE_MODEL.md the accept button is
 * "Keep"; Cancel reverts to how the driver was when Tune opened.
 *
 * A per-skin presentation under shells/original/ — NOT an edit of the shared
 * DriverWhatIfPanel, so Modern is untouched (Invariant 1) and the what-if logic stays
 * single-sourced in the store/ADT.
 */
import { computed, reactive, watch } from 'vue';
import { state, driver, driverCell, enterDriverField, clearDriverField,
         startDriverWhatIf, keepDriverWhatIf, cancelDriverWhatIf, setWhatIfFromBaseline } from '../../store.js';
import { ebp } from '@openisd/engine';
import { precision as fieldDp, limits } from '../../fields/fieldRegistry.js';
import { cellClassOf, useQGroupIncomplete, Q_GROUP } from '../../composables/useDriverCells.js';
import NumInput from '../../components/NumInput.vue';

type NumKey = 'Fs' | 'Qts' | 'Qes' | 'Qms' | 'Vas' | 'Sd' | 'Re' | 'Le' | 'Xmax' | 'Pe' | 'Bl' | 'Mms';
// scale = display/SI factor (raw driver values are SI: Vas m³, Sd m², Le H, Xmax m, Mms kg).
// Decimal places come from the field registry (fieldDp) — the single source of truth — so
// these units' dp match every other skin. The units here MUST match the registry's unit.
const MAIN: { key: NumKey; label: string; scale: number; unit: string }[] = [
  { key: 'Fs',  label: 'Fs',  scale: 1,    unit: 'Hz' },
  { key: 'Qts', label: 'Qts', scale: 1,    unit: '' },
  { key: 'Qes', label: 'Qes', scale: 1,    unit: '' },
  { key: 'Qms', label: 'Qms', scale: 1,    unit: '' },
  { key: 'Vas', label: 'Vas', scale: 1000, unit: 'l' },
  { key: 'Sd',  label: 'Sd',  scale: 1e4,  unit: 'cm²' },
  { key: 'Re',  label: 'Re',  scale: 1,    unit: 'Ω' },
];
const OPTIONAL: { key: NumKey; label: string; scale: number; unit: string }[] = [
  { key: 'Le',   label: 'Le',   scale: 1000, unit: 'mH' },
  { key: 'Xmax', label: 'Xmax', scale: 1000, unit: 'mm' },
  { key: 'Pe',   label: 'Pe',   scale: 1,    unit: 'W' },
];
// Bl and Mms are ordinary driver fields, not outputs: the ADT derives them when they are not
// entered and honours them when they are (Driver.enter → state E → fixed-E override), exactly
// as the driver editor already treats them. So they are edited here like any other field, and
// the E/C colour says which of the two is happening.
const DERIVED: { key: NumKey; label: string; scale: number; unit: string }[] = [
  { key: 'Bl',  label: 'Bl',  scale: 1,    unit: 'T·m' },
  { key: 'Mms', label: 'Mms', scale: 1000, unit: 'g' },
];

// While a field is focused, echo the RAW typed string (so mid-typing values like
// "4" → "42" aren't reformatted out from under the caret); reformat on blur. Same
// buffer pattern the shared DriverWhatIfPanel uses.
const rawVals = reactive<Record<string, string>>({});
// The CELL, not the entered bag: raw() holds entered fields only, so a Q the app solved from
// the other two read as blank here. cell() carries the solved value with its C mark, which is
// what makes the third Q fill itself in as the other two change.
function disp(key: NumKey, scale: number): string {
  const v = driverCell(key).value;
  return typeof v === 'number' && isFinite(v) ? (v * scale).toFixed(fieldDp(key)) : '';
}
function fieldVal(key: NumKey, scale: number): string {
  return key in rawVals ? rawVals[key] : disp(key, scale);
}
function onField(key: NumKey, scale: number, e: Event) {
  const raw = (e.target as HTMLInputElement).value;
  rawVals[key] = raw;
  const v = parseFloat(raw);
  // Emptying a field RELEASES it back to Calculated — the override is withdrawn, not set to
  // nothing. Without this a cleared field would keep its last entered value invisibly.
  if (raw.trim() === '') clearDriverField(key);
  else if (isFinite(v)) enterDriverField(key, v / scale);
}
function onBlur(key: NumKey) { delete rawVals[key]; }

// Registry bounds are SI-space; these inputs display SI × scale, so scale the bounds the
// same way for the v-limits clamp (e.g. Vas max 100 m³ → 100000 L).
function scaledLimits(key: NumKey, scale: number): { min?: number; max?: number } {
  const lim = limits(key);
  return { min: lim.min === undefined ? undefined : lim.min * scale,
           max: lim.max === undefined ? undefined : lim.max * scale };
}

// Any two of the Q trio solve the third, so all three are flagged together while fewer than
// two are usable. The rule itself lives in useDriverCells — the driver editor reads the same
// one, against its own draft model.
const qIncomplete = useQGroupIncomplete(driverCell);
const isQ = (key: NumKey) => Q_GROUP.includes(key);
/** Provenance mark + the required-but-missing alert, in the editor's own class vocabulary. */
function fieldClasses(key: NumKey, scale: number): Record<string, boolean> {
  const mandatory = isQ(key) && qIncomplete.value;
  return {
    [cellClassOf(driverCell(key).state)]: true,
    'de-input-mandatory': mandatory,
    'de-input-empty': mandatory && fieldVal(key, scale) === '',
  };
}

const ebpVal = computed(() => (driver.value ? ebp(driver.value) : null));
function fmt(v: number | null, dp: number): string { return v != null && isFinite(v) ? v.toFixed(dp) : '—'; }

// Open the what-if overlay as Tune opens: edits go to a live COPY, so the charts preview
// live but the committed project stays clean until Keep (STATE_MODEL what-if ≠ modified).
// The watch (immediate) survives a future switch from v-if to v-show.
// On close by any path other than Keep (which commits+clears first), discard the overlay so
// a stray close can never strand the charts on an abandoned what-if.
// Box volume is BOX state, not driver state, so the driver what-if overlay does not cover it —
// a Vb scrubbed here writes straight through to state.P.Vb (the SAME binding the Box panel
// uses; there is no second copy). Cancel must therefore put Vb back itself, or a panel whose
// Cancel reverts the driver would silently keep a box change made in the same session.
let vbSnapshot = state.P.Vb;
watch(() => state.editDriver, (open) => {
  if (open) { vbSnapshot = state.P.Vb; startDriverWhatIf(); }
  else cancelDriverWhatIf();
}, { immediate: true });

function keep()   { keepDriverWhatIf();   state.editDriver = false; } // commit what-if → modified
function cancel() { cancelDriverWhatIf(); state.P.Vb = vbSnapshot; state.editDriver = false; }
function reset()  { setWhatIfFromBaseline(); } // overlay ← library values (Vb is not a driver value)
</script>

<template>
  <div class="tune-panel">
    <div class="tune-titlebar">
      <span>Tune — What-if</span>
      <span class="close-btn" role="button" tabindex="0" title="Cancel — discard these what-if changes" @click="cancel" @keydown.enter="cancel">✕</span>
    </div>
    <p class="tune-hint">Live what-if: the charts update as you scrub. <b>Keep</b> applies the changes; <b>Cancel</b> reverts.</p>

    <div class="tune-grid">
      <div v-for="f in MAIN" :key="f.key" class="tune-fld">
        <label>{{ f.label }}</label>
        <div class="tune-unit">
          <input v-expo-step type="number" v-limits="scaledLimits(f.key, f.scale)" :class="fieldClasses(f.key, f.scale)" :value="fieldVal(f.key, f.scale)" @input="onField(f.key, f.scale, $event)" @blur="onBlur(f.key)">
          <span v-if="f.unit">{{ f.unit }}</span>
        </div>
      </div>
    </div>

    <div class="tune-subsect">Box</div>
    <div class="tune-grid">
      <div class="tune-fld" title="Net acoustic internal volume — excludes driver displacement, port tube volume and bracing. The same box volume the Box tab edits; Cancel puts it back. WinISD: Vb.">
        <label>Vb</label>
        <div class="tune-unit">
          <NumInput v-model="state.P.Vb" :scale="1000" :precision="4" />
          <span>l</span>
        </div>
      </div>
    </div>

    <div class="tune-subsect">Optional</div>
    <div class="tune-grid">
      <div v-for="f in OPTIONAL" :key="f.key" class="tune-fld">
        <label class="opt-lbl">{{ f.label }}</label>
        <div class="tune-unit">
          <input v-expo-step type="number" v-limits="scaledLimits(f.key, f.scale)" :class="fieldClasses(f.key, f.scale)" :value="fieldVal(f.key, f.scale)" @input="onField(f.key, f.scale, $event)" @blur="onBlur(f.key)">
          <span v-if="f.unit">{{ f.unit }}</span>
        </div>
      </div>
    </div>

    <div class="tune-subsect">Derived</div>
    <div class="tune-grid">
      <div v-for="f in DERIVED" :key="f.key" class="tune-fld" :title="`${f.label} is calculated from the parameters above until you type one — then it overrides them. Clear the field to hand it back to the calculation.`">
        <label>{{ f.label }}</label>
        <div class="tune-unit">
          <input v-expo-step type="number" v-limits="scaledLimits(f.key, f.scale)" :class="fieldClasses(f.key, f.scale)" :value="fieldVal(f.key, f.scale)" @input="onField(f.key, f.scale, $event)" @blur="onBlur(f.key)">
          <span v-if="f.unit">{{ f.unit }}</span>
        </div>
      </div>
      <!-- EBP is NOT a driver field: the ADT does not derive it and has no slot to override
           (it is ebp() = Fs/Qes, computed in the engine). Making it editable means choosing
           which of Fs or Qes an entered EBP solves backwards — a decision for the human, not
           an inert box that accepts a number nothing reads. Tracked as an open question. -->
      <div class="tune-fld tune-ro" title="EBP = Fs / Qes — a read-out of the two fields above, not a field of its own."><label>EBP</label><span class="tune-roval">{{ fmt(ebpVal, 1) }}</span></div>
    </div>

    <div class="tune-btns">
      <button title="Reset — back to the library driver's values" @click="reset">Reset</button>
      <button class="cancel" title="Cancel — discard these what-if changes; the charts revert to how they were before Tune" @click="cancel">Cancel</button>
      <button class="footer-buttons-pri" title="Keep — apply these what-if changes to the project" @click="keep">Keep</button>
    </div>
  </div>
</template>

<style scoped>
/* Ported from mock/style.css .tune-panel (docked, non-modal what-if editor). */
.tune-panel {
  position: fixed; right: 24px; bottom: 24px; z-index: 60;
  width: 420px; max-width: calc(100vw - 32px); max-height: 80vh; overflow-y: auto;
  background: #f7f7f7; border: 1px solid #888; border-radius: 8px;
  box-shadow: 0 6px 24px rgba(0,0,0,.35); padding: 10px 14px 14px; font-size: 13px;
}
.tune-titlebar { display: flex; align-items: center; justify-content: space-between; font-weight: 600; margin-bottom: 6px; }
.tune-titlebar .close-btn { cursor: pointer; padding: 0 4px; }
.tune-titlebar .close-btn:hover { background: #e64545; color: #fff; }
.tune-hint { color: #777; font-style: italic; font-size: 11.5px; margin-bottom: 8px; }
.tune-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 12px; }
.tune-fld { min-width: 0; }
.tune-fld label { display: block; font-size: 11px; color: #555; margin-bottom: 2px; }
.tune-fld .opt-lbl { color: #999; font-style: italic; }
.tune-unit { display: flex; align-items: center; gap: 4px; }
/* Sized to its own content, not to the column. 78px holds the widest value any of these
   fields shows ("30.0000" at the registry's 4 dp) with room to spare; stretching to 100% of
   a 190px grid column made every field three times wider than the number in it, which is
   what WinISD's own narrow, natural-width fields (docs/winisd/*.png) never do. */
.tune-unit input, .tune-roval { width: 78px; padding: 3px 5px; border: 1px solid #999; border-radius: 3px; background: #fff; font: inherit; }
.tune-roval { text-align: right; color: var(--acc); font-style: italic; display: inline-block; }
.tune-unit span { font-size: 11px; color: #666; white-space: nowrap; }
.tune-ro label { opacity: .8; }
.tune-subsect { color: #7d9fc9; font-weight: 600; font-size: 12px; margin: 10px 0 2px; }
.tune-btns { display: flex; gap: 8px; justify-content: flex-end; padding-top: 8px; border-top: 1px solid #ddd; margin-top: 10px; }
.tune-btns button { border: 1px solid #999; background: #f0f0f0; border-radius: 3px; padding: 6px 12px; cursor: pointer; }
.tune-btns button:hover { background: #dbeaff; border-color: #7fb3ff; }
.tune-btns button.cancel { color: #b02a2a; }
.tune-btns button.footer-buttons-pri { background: #1868d1; color: #fff; border-color: #1868d1; }
</style>
