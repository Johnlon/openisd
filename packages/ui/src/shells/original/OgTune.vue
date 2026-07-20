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
import { state, driver, driverRaw, enterDriverField,
         startDriverWhatIf, keepDriverWhatIf, cancelDriverWhatIf, setWhatIfFromRaw } from '../../store.js';
import { ebp } from '@openisd/engine';
import { precision as fieldDp } from '../../fields/fieldRegistry.js';

type NumKey = 'Fs' | 'Qts' | 'Qes' | 'Qms' | 'Vas' | 'Sd' | 'Re' | 'Le' | 'Xmax' | 'Pe';
// scale = display/SI factor (raw driver values are SI: Vas m³, Sd m², Le H, Xmax m).
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

// While a field is focused, echo the RAW typed string (so mid-typing values like
// "4" → "42" aren't reformatted out from under the caret); reformat on blur. Same
// buffer pattern the shared DriverWhatIfPanel uses.
const rawVals = reactive<Record<string, string>>({});
function disp(key: NumKey, scale: number): string {
  const v = driverRaw.value[key];
  return typeof v === 'number' && isFinite(v) ? (v * scale).toFixed(fieldDp(key)) : '';
}
function fieldVal(key: NumKey, scale: number): string {
  return key in rawVals ? rawVals[key] : disp(key, scale);
}
function onField(key: NumKey, scale: number, e: Event) {
  const raw = (e.target as HTMLInputElement).value;
  rawVals[key] = raw;
  const v = parseFloat(raw);
  if (isFinite(v)) enterDriverField(key, v / scale);
}
function onBlur(key: NumKey) { delete rawVals[key]; }

const bl = computed(() => driver.value?.Bl ?? null);
const mms = computed(() => driver.value?.Mms ?? null);
const ebpVal = computed(() => (driver.value ? ebp(driver.value) : null));
function fmt(v: number | null, dp: number): string { return v != null && isFinite(v) ? v.toFixed(dp) : '—'; }

// Open the what-if overlay as Tune opens: edits go to a live COPY, so the charts preview
// live but the committed project stays clean until Keep (STATE_MODEL what-if ≠ modified).
// The watch (immediate) survives a future switch from v-if to v-show.
// On close by any path other than Keep (which commits+clears first), discard the overlay so
// a stray close can never strand the charts on an abandoned what-if.
watch(() => state.editDriver, (open) => { if (open) startDriverWhatIf(); else cancelDriverWhatIf(); }, { immediate: true });

function keep()   { keepDriverWhatIf();   state.editDriver = false; } // commit what-if → modified
function cancel() { cancelDriverWhatIf(); state.editDriver = false; } // discard what-if overlay
function reset()  { if (state.driverSource) setWhatIfFromRaw(state.driverSource); } // overlay ← library values
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
          <input v-expo-step type="number" :value="fieldVal(f.key, f.scale)" @input="onField(f.key, f.scale, $event)" @blur="onBlur(f.key)">
          <span v-if="f.unit">{{ f.unit }}</span>
        </div>
      </div>
    </div>

    <div class="tune-subsect">Optional</div>
    <div class="tune-grid">
      <div v-for="f in OPTIONAL" :key="f.key" class="tune-fld">
        <label class="opt-lbl">{{ f.label }}</label>
        <div class="tune-unit">
          <input v-expo-step type="number" :value="fieldVal(f.key, f.scale)" @input="onField(f.key, f.scale, $event)" @blur="onBlur(f.key)">
          <span v-if="f.unit">{{ f.unit }}</span>
        </div>
      </div>
    </div>

    <div class="tune-subsect">Derived</div>
    <div class="tune-grid tune-ro">
      <div class="tune-fld"><label>Bl</label><span class="tune-roval">{{ fmt(bl, 2) }}</span></div>
      <div class="tune-fld"><label>Mms</label><span class="tune-roval">{{ fmt(mms != null ? mms * 1000 : null, 2) }} g</span></div>
      <div class="tune-fld"><label>EBP</label><span class="tune-roval">{{ fmt(ebpVal, 1) }}</span></div>
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
.tune-unit input, .tune-roval { width: 100%; padding: 3px 5px; border: 1px solid #999; border-radius: 3px; background: #fff; font: inherit; }
.tune-roval { text-align: right; color: #1868d1; font-style: italic; display: inline-block; }
.tune-unit span { font-size: 11px; color: #666; white-space: nowrap; }
.tune-ro label { opacity: .8; }
.tune-subsect { color: #7d9fc9; font-weight: 600; font-size: 12px; margin: 10px 0 2px; }
.tune-btns { display: flex; gap: 8px; justify-content: flex-end; padding-top: 8px; border-top: 1px solid #ddd; margin-top: 10px; }
.tune-btns button { border: 1px solid #999; background: #f0f0f0; border-radius: 3px; padding: 6px 12px; cursor: pointer; }
.tune-btns button:hover { background: #dbeaff; border-color: #7fb3ff; }
.tune-btns button.cancel { color: #b02a2a; }
.tune-btns button.footer-buttons-pri { background: #1868d1; color: #fff; border-color: #1868d1; }
</style>
