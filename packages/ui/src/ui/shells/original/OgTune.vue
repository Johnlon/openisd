<script setup lang="ts">
/**
 * Tune panel — the docked `.tune-panel`. This is a WHAT-IF editor:
 * changes preview LIVE on the charts (via the shared driver ADT's enterDriverField, the
 * same path the graph's reactive chain reads). A what-if is exploration-only and can never
 * become real driver data (docs/design/STATE_MODEL.md rule 4) — there is no commit/"Keep" control.
 * Cancel is the only way the panel closes, and it always reverts to how the driver was
 * when Tune opened.
 *
 * Presentation only: the what-if logic is single-sourced in the store/ADT.
 */
import { computed, reactive, watch, ref, onMounted, onUnmounted } from 'vue';
import { enterDriverField, clearDriverField, driverFieldCell } from '../../../logic/appState.js';
import { presentationState } from '../../../logic/presentationState.js';
import { useFocusedProject } from '../../../logic/focusedProjectContext.js';
import { ebpOf } from '../../../logic/environment.js';
import { toDisplay, fromDisplay, type UnitGroup } from '../../../logic/fields/units.js';
import { precision as fieldDp, limits } from '../../../logic/fields/fieldRegistry.js';
import { cellClassFor, consistencyNote, fieldIsMandatoryAndUnsatisfied } from '../../../logic/useDriverCells.js';
import NumInput from '../../components/NumInput.vue';
import UnitToggle from '../../components/UnitToggle.vue';
import type { Cell, SpecField } from '@openisd/model';

const project = useFocusedProject();

// WinISD's own field names — these index OpenISDDriver directly, and the field registry now
// keys by the same names, so there is nothing to cross between.
type NumKey = 'Fs' | 'Qts' | 'Qes' | 'Qms' | 'Vas' | 'Sd' | 'Re' | 'Le' | 'Xmax' | 'Pe' | 'BL' | 'Mms';
// Raw driver values are SI (Vas m³, Sd m², Le H, Xmax m, Mms kg); a field with a `group`/
// `token` displays and accepts input via the one units.ts conversion (`display = SI × factor`);
// a field with neither is already shown in its SI unit (Hz, Ω, W, T·m, dimensionless Q).
// Decimal places come from the field registry (fieldDp) — the single source of truth — so
// the units here MUST match the registry's unit.
interface TuneField { key: NumKey; label: string; group?: UnitGroup; token?: string; unit: string }
const MAIN: TuneField[] = [
  { key: 'Fs',  label: 'Fs',  unit: 'Hz' },
  { key: 'Qts', label: 'Qts', unit: '' },
  { key: 'Qes', label: 'Qes', unit: '' },
  { key: 'Qms', label: 'Qms', unit: '' },
  { key: 'Vas', label: 'Vas', group: 'volume', token: 'L',   unit: 'l' },
  { key: 'Sd',  label: 'Sd',  group: 'area',   token: 'cm2', unit: 'cm²' },
  { key: 'Re',  label: 'Re',  unit: 'Ω' },
];
const OPTIONAL: TuneField[] = [
  { key: 'Le',   label: 'Le',   group: 'inductance', token: 'mH', unit: 'mH' },
  { key: 'Xmax', label: 'Xmax', group: 'length',      token: 'mm', unit: 'mm' },
  { key: 'Pe',   label: 'Pe',   unit: 'W' },
];
// Bl and Mms are ordinary driver fields, not outputs: the ADT derives them when they are not
// entered and honours them when they are (Driver.enter → state E → fixed-E override), exactly
// as the driver editor already treats them. So they are edited here like any other field, and
// the E/C colour says which of the two is happening.
const DERIVED: TuneField[] = [
  { key: 'BL',  label: 'Bl',  unit: 'T·m' },
  { key: 'Mms', label: 'Mms', group: 'mass', token: 'g', unit: 'g' },
];

// While a field is focused, echo the RAW typed string (so mid-typing values like
// "4" → "42" aren't reformatted out from under the caret); reformat on blur.
const rawVals = reactive<Record<string, string>>({});
// The CELL, not the entered bag: raw() holds entered fields only, so a Q the app solved from
// the other two read as blank here. cell() carries the solved value with its C mark, which is
// what makes the third Q fill itself in as the other two change.

function disp(key: NumKey, group: UnitGroup | undefined, token: string | undefined): string {
  void project.value;
  const v = driverFieldCell(key).value;
  if (typeof v !== 'number' || !isFinite(v)) return '';
  const d = group && token ? toDisplay(v, group, token) : v;
  return d.toFixed(fieldDp(key));
}
function fieldVal(key: NumKey, group: UnitGroup | undefined, token: string | undefined): string {
  return key in rawVals ? rawVals[key] : disp(key, group, token);
}
function onField(key: NumKey, group: UnitGroup | undefined, token: string | undefined, e: Event) {
  const raw = (e.target as HTMLInputElement).value;
  rawVals[key] = raw;
  const v = parseFloat(raw);
  // Emptying a field RELEASES it back to Calculated — the override is withdrawn, not set to
  // nothing. Without this a cleared field would keep its last entered value invisibly.
  if (raw.trim() === '') clearDriverField(key);
  else if (isFinite(v)) enterDriverField(key, group && token ? fromDisplay(v, group, token) : v);
}
function onBlur(key: NumKey) { delete rawVals[key]; }

// Registry bounds are SI-space; the input shows the display unit, so the v-limits clamp needs
// the same conversion (e.g. Vas max 100 m³ → 100000 L).
function scaledLimits(key: NumKey, group: UnitGroup | undefined, token: string | undefined): { min?: number; max?: number } {
  const lim = limits(key);
  if (!group || !token) return lim;
  return { min: lim.min === undefined ? undefined : toDisplay(lim.min, group, token),
           max: lim.max === undefined ? undefined : toDisplay(lim.max, group, token) };
}

// Any two of the Q trio solve the third, so all three are flagged together while fewer than
// two are usable. The rule itself lives in useDriverCells — the driver editor reads the same
// one, against its own draft model.
/** Provenance mark + the required-but-missing alert, in the editor's own class vocabulary. */
function fieldClasses(key: NumKey, group: UnitGroup | undefined, token: string | undefined): Record<string, boolean> {
  void project.value;
  const cellOf = (f: SpecField): Cell => driverFieldCell(f);
  const mandatory = fieldIsMandatoryAndUnsatisfied(cellOf, key);
  return {
    [cellClassFor(cellOf, key)]: true,
    'de-input-mandatory': mandatory,
    'de-input-empty': mandatory && fieldVal(key, group, token) === '',
  };
}

const hoveredTooltip = ref<string | null>(null);
const pinnedTooltip = ref<string | null>(null);
const tooltipStyles = reactive<Record<string, { position: 'absolute'; top: string; left: string; bottom: string; right: string; transform: string }>>({});

function updateTooltipPos(key: string, event: Event) {
  const target = event.currentTarget as HTMLElement;
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const top = rect.top + window.scrollY - 6;
  tooltipStyles[key] = {
    position: 'absolute',
    top: `${top}px`,
    left: `${rect.right + window.scrollX - 240}px`,
    bottom: 'auto',
    right: 'auto',
    transform: 'translateY(-100%)'
  };
}

function showTooltip(key: string, event: Event) {
  updateTooltipPos(key, event);
  hoveredTooltip.value = key;
}
function hideTooltip(key: string) {
  if (hoveredTooltip.value === key) {
    hoveredTooltip.value = null;
  }
}
function togglePin(key: string, event: Event) {
  if (pinnedTooltip.value === key) {
    pinnedTooltip.value = null;
  } else {
    updateTooltipPos(key, event);
    pinnedTooltip.value = key;
  }
}
function closeAllPins() {
  pinnedTooltip.value = null;
}
onMounted(() => {
  window.addEventListener('click', closeAllPins);
});
onUnmounted(() => {
  window.removeEventListener('click', closeAllPins);
});

function isBadValue(key: NumKey): boolean {
  void project.value;
  const v = driverFieldCell(key).value;
  return typeof v === 'number' && !(v > 0);
}

const BAD_VALUE_NOTE = 'Bad data: zero or less is not a physical value here. It is kept and saved exactly as entered — clear the field to let it be calculated instead.';

const dqNote = (key: NumKey): string => {
  if (isBadValue(key)) return BAD_VALUE_NOTE;
  void project.value;
  return consistencyNote(project.value.consistencyIssues(), key);
};

const ebpVal = computed(() => { void project.value; const d = project.value.toEngineDriver(); return d ? ebpOf(d) : null; });
function fmt(v: number | null, dp: number): string { return v != null && isFinite(v) ? v.toFixed(dp) : '—'; }

// Open the what-if overlay as Tune opens: edits go to a live COPY, so the charts preview
// live but the committed project stays clean — a what-if can never dirty it, by any path
// (STATE_MODEL what-if ≠ committed, and never becomes committed). The watch (immediate)
// survives a future switch from v-if to v-show.
// On EVERY close path (✕ or Cancel — there is no other), discard the overlay so a stray
// close can never strand the charts on an abandoned what-if.
// Box volume is BOX state, not driver state, so the driver what-if overlay does not cover it —
// a Vb scrubbed here writes straight through to project.value.boxVolume_m3() (the SAME
// binding the Box panel uses; there is no second copy). Cancel must therefore put Vb back
// itself, or a panel whose Cancel reverts the driver would silently keep a box change made in
// the same session.
let vbSnapshot = project.value.boxVolume_m3();
watch(() => presentationState.editDriver, (open) => {
  if (open) { vbSnapshot = project.value.boxVolume_m3(); project.value.beginWhatIf(); }
  else project.value.cancelWhatIf();
}, { immediate: true });

function cancel() { project.value.cancelWhatIf(); project.value.setBoxVolume_m3(vbSnapshot); presentationState.editDriver = false; }
// Reset the overlay to the driver as loaded: end this session and start a fresh one from
// ground. ManagedProject owns both halves; the panel does not reach past it. Vb is a box value,
// not a driver value, so it is untouched here.
function reset()  { project.value.resetOverlayToGround(); }
</script>

<template>
  <div class="tune-panel">
    <div class="tune-titlebar">
      <span>Tune — What-if</span>
      <span class="close-btn" role="button" tabindex="0" title="Cancel — discard these what-if changes" @click="cancel" @keydown.enter="cancel">✕</span>
    </div>
    <p class="tune-hint">Live what-if: the charts update as you scrub, but nothing here is ever saved — <b>Cancel</b> reverts. To make a value real, use <b>Edit</b> instead.</p>

    <div class="tune-grid">
      <div v-for="f in MAIN" :key="f.key" class="tune-fld">
        <label>{{ f.label }}</label>
        <div class="tune-unit">
          <input v-expo-step type="number" v-limits="scaledLimits(f.key, f.group, f.token)" :class="fieldClasses(f.key, f.group, f.token)" :value="fieldVal(f.key, f.group, f.token)" @input="onField(f.key, f.group, f.token, $event)" @blur="onBlur(f.key)">
          <div v-if="dqNote(f.key)" class="dq-tooltip-container">
            <span class="de-dq" role="button" tabindex="0" @mouseenter="showTooltip(f.key, $event)" @mouseleave="hideTooltip(f.key)" @click.stop="togglePin(f.key, $event)" @keydown.enter.stop="togglePin(f.key, $event)">&#9888;</span>
            <Teleport to="body">
              <div v-show="hoveredTooltip === f.key || pinnedTooltip === f.key" :class="['dq-tooltip-box', 'dq-tooltip-box-' + f.key]" :style="tooltipStyles[f.key]">
                {{ dqNote(f.key) }}
              </div>
            </Teleport>
          </div>
          <span v-if="f.unit">{{ f.unit }}</span>
        </div>
      </div>
    </div>

    <div class="tune-subsect">Box</div>
    <div class="tune-grid">
      <div class="tune-fld" title="Net acoustic internal volume — excludes driver displacement, port tube volume and bracing. The same box volume the Box tab edits; Cancel puts it back. WinISD: Vb.">
        <label>Vb</label>
        <div class="tune-unit">
          <NumInput :model-value="project.boxVolume_m3()" @update:model-value="v => project.setBoxVolume_m3(v ?? 0)" field="Vb" group="volume" base="L" :precision="4" />
          <UnitToggle field="Vb" group="volume" base="L" />
        </div>
      </div>
    </div>

    <div class="tune-subsect">Optional</div>
    <div class="tune-grid">
      <div v-for="f in OPTIONAL" :key="f.key" class="tune-fld">
        <label class="opt-lbl">{{ f.label }}</label>
        <div class="tune-unit">
          <input v-expo-step type="number" v-limits="scaledLimits(f.key, f.group, f.token)" :class="fieldClasses(f.key, f.group, f.token)" :value="fieldVal(f.key, f.group, f.token)" @input="onField(f.key, f.group, f.token, $event)" @blur="onBlur(f.key)">
          <div v-if="dqNote(f.key)" class="dq-tooltip-container">
            <span class="de-dq" role="button" tabindex="0" @mouseenter="showTooltip(f.key, $event)" @mouseleave="hideTooltip(f.key)" @click.stop="togglePin(f.key, $event)" @keydown.enter.stop="togglePin(f.key, $event)">&#9888;</span>
            <Teleport to="body">
              <div v-show="hoveredTooltip === f.key || pinnedTooltip === f.key" :class="['dq-tooltip-box', 'dq-tooltip-box-' + f.key]" :style="tooltipStyles[f.key]">
                {{ dqNote(f.key) }}
              </div>
            </Teleport>
          </div>
          <span v-if="f.unit">{{ f.unit }}</span>
        </div>
      </div>
    </div>

    <div class="tune-subsect">Derived</div>
    <div class="tune-grid">
      <div v-for="f in DERIVED" :key="f.key" class="tune-fld" :title="`${f.label} is calculated from the parameters above until you type one — then it overrides them. Clear the field to hand it back to the calculation.`">
        <label>{{ f.label }}</label>
        <div class="tune-unit">
          <input v-expo-step type="number" v-limits="scaledLimits(f.key, f.group, f.token)" :class="fieldClasses(f.key, f.group, f.token)" :value="fieldVal(f.key, f.group, f.token)" @input="onField(f.key, f.group, f.token, $event)" @blur="onBlur(f.key)">
          <div v-if="dqNote(f.key)" class="dq-tooltip-container">
            <span class="de-dq" role="button" tabindex="0" @mouseenter="showTooltip(f.key, $event)" @mouseleave="hideTooltip(f.key)" @click.stop="togglePin(f.key, $event)" @keydown.enter.stop="togglePin(f.key, $event)">&#9888;</span>
            <Teleport to="body">
              <div v-show="hoveredTooltip === f.key || pinnedTooltip === f.key" :class="['dq-tooltip-box', 'dq-tooltip-box-' + f.key]" :style="tooltipStyles[f.key]">
                {{ dqNote(f.key) }}
              </div>
            </Teleport>
          </div>
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
      <button class="cancel footer-buttons-pri" title="Cancel — discard these what-if changes; the charts revert to how they were before Tune" @click="cancel">Cancel</button>
    </div>
  </div>
</template>

<style scoped>
/* Width follows its content: two columns of label(34) + gap(6) + input(78) + gap(4) + unit(~26). */
.tune-panel {
  position: fixed; right: 24px; bottom: 24px; z-index: 60;
  width: 340px; max-width: calc(100vw - 32px); max-height: 80vh; overflow-y: auto;
  background: #f7f7f7; border: 1px solid #888; border-radius: 8px;
  box-shadow: 0 6px 24px rgba(0,0,0,.35); padding: 10px 14px 14px; font-size: 13px;
}
.tune-titlebar { display: flex; align-items: center; justify-content: space-between; font-weight: 600; margin-bottom: 6px; }
.tune-titlebar .close-btn { cursor: pointer; padding: 0 4px; }
.tune-titlebar .close-btn:hover { background: #e64545; color: #fff; }
.tune-hint { color: #777; font-style: italic; font-size: 11.5px; margin-bottom: 8px; }
.tune-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 12px; }
/* Right-aligned so each label ends against its own input. 34px holds the widest ("Xmax"). */
.tune-fld { min-width: 0; display: grid; grid-template-columns: 34px 1fr; align-items: center; gap: 6px; }
.tune-fld label { font-size: 11px; color: #555; text-align: right; white-space: nowrap; }
.tune-fld .opt-lbl { color: #999; font-style: italic; }
.tune-unit { display: flex; align-items: center; gap: 4px; }
/* Sized to its own content, not to the column. 78px holds the widest value any of these
   fields shows ("30.0000" at the registry's 4 dp) with room to spare; stretching to 100% of
   a 190px grid column made every field three times wider than the number in it, which is
   what WinISD's own narrow, natural-width fields (docs/winisd_screenshots/*.png) never do. */
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

.dq-tooltip-container { position: relative; display: inline-flex; align-items: center; }
.dq-tooltip-box {
  position: absolute; z-index: 100;
  width: 240px; background: #2b2b2b; color: #fff; border-radius: 4px;
  padding: 8px 12px; font-size: 11px; line-height: 1.4;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15); pointer-events: none; white-space: normal;
  font-family: sans-serif; text-align: left;
}
.dq-tooltip-box::after {
  content: ""; position: absolute; top: 100%; right: 8px;
  border-width: 5px; border-style: solid; border-color: #2b2b2b transparent transparent transparent;
}
</style>
