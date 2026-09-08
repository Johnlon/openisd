<script setup lang="ts">
/**
 * Tune panel — the docked `.tune-panel`. A live editor: every field writes straight onto the
 * focused project's driver, the same slot the Driver/Box panels write, so the charts update as
 * you scrub. Cancel/Reset discard everything typed since the last save (`OpenISDProject.cancel()`).
 */
import { computed, reactive, ref, onMounted, onUnmounted } from 'vue';
import type { SpecField } from '../../../logic/appState.js';
import { presentationState } from '../../../logic/presentationState.js';
import { useFocusedProject } from '../../../logic/focusedProjectContext.js';
import { ebpOf } from '../../../logic/environment.js';
import { toDisplay, fromDisplay, type UnitGroup } from '../../../logic/fields/units.js';
import { precision as fieldDp, limits } from '../../../logic/fields/fieldRegistry.js';
import { cellClassFor, consistencyNote, fieldIsMandatoryAndUnsatisfied } from '../../../logic/useDriverCells.js';
import NumInput from '../../components/NumInput.vue';
import UnitToggle from '../../components/UnitToggle.vue';
import type { Cell, FieldHandle } from '@openisd/design';
import { inputValue, listeningElement } from '../../../logic/domEvents.js';

const project = useFocusedProject();

// WinISD's own field names — the registry keys by these; the driver's spec section carries the
// SI-suffixed name (`Fs_hz`, `Vas_m3`), so `SPEC` maps the twelve this panel edits to their
// `Field` on the focused project's driver.
type NumKey = 'Fs' | 'Qts' | 'Qes' | 'Qms' | 'Vas' | 'Sd' | 'Re' | 'Le' | 'Xmax' | 'Pe' | 'BL' | 'Mms';

/** The field handle for one of this panel's keys, on the FOCUSED project's driver — the write
 *  goes straight onto the project, the same slot the Box/Driver panels write. */
function specField(key: NumKey): FieldHandle<number> {
  const s = project.value.driver.spec[project.value.driver.section];
  switch (key) {
    case 'Fs':   return s.Fs_hz;
    case 'Qts':  return s.Qts;
    case 'Qes':  return s.Qes;
    case 'Qms':  return s.Qms;
    case 'Vas':  return s.Vas_m3;
    case 'Sd':   return s.Sd_m2;
    case 'Re':   return s.Re_ohm;
    case 'Le':   return s.Le_H;
    case 'Xmax': return s.Xmax_m;
    case 'Pe':   return s.Pe_W;
    case 'BL':   return s.BL_Tm;
    case 'Mms':  return s.Mms_kg;
  }
}
function fieldCell(key: NumKey): Cell<number> { return specField(key).get(); }
function enterField(key: NumKey, v: number): void { specField(key).set(v); }
function clearField(key: NumKey): void { specField(key).clear(); }
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
  const v = fieldCell(key).value;
  if (typeof v !== 'number' || !isFinite(v)) return '';
  const d = group && token ? toDisplay(v, group, token) : v;
  return d.toFixed(fieldDp(key));
}
function fieldVal(key: NumKey, group: UnitGroup | undefined, token: string | undefined): string {
  return key in rawVals ? rawVals[key] : disp(key, group, token);
}
function onField(key: NumKey, group: UnitGroup | undefined, token: string | undefined, e: Event) {
  const raw = inputValue(e);
  rawVals[key] = raw;
  const v = parseFloat(raw);
  // Emptying a field RELEASES it back to Calculated — the override is withdrawn, not set to
  // nothing. Without this a cleared field would keep its last entered value invisibly.
  if (raw.trim() === '') clearField(key);
  else if (isFinite(v)) enterField(key, group && token ? fromDisplay(v, group, token) : v);
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
  const cellOf = (f: SpecField): Cell<number> => fieldCell(f as NumKey);
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
  const target = listeningElement(event);
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
  const v = fieldCell(key).value;
  return typeof v === 'number' && !(v > 0);
}

const BAD_VALUE_NOTE = 'Bad data: zero or less is not a physical value here. It is kept and saved exactly as entered — clear the field to let it be calculated instead.';

const dqNote = (key: NumKey): string => {
  if (isBadValue(key)) return BAD_VALUE_NOTE;
  void project.value;
  return consistencyNote(project.value.driver.checkConsistency(), key);
};

const ebpVal = computed(() => {
  void project.value;
  const { Fs_hz, Qes } = project.value.driver.solveConsistencyGroup();
  return Fs_hz != null && Qes != null && Qes !== 0 ? ebpOf(Fs_hz, Qes) : null;
});

// WinISD "Vb" — the rear/primary chamber volume. Each box type keeps its own volume slot under
// its own `box.<type>` slice (there is no flat cross-type accessor), so this dispatches on the
// active type, the same way the Box tab's own Volume field does in OriginalShell.
const vb_m3 = computed<number | null>(() => {
  void project.value;
  const box = project.value.box;
  switch (box.boxType.get()) {
    case 'sealed': return box.sealed.volume_m3.get();
    case 'vented': return box.vented.volume_m3.get().value;
    case 'bandpass4': return box.bandpass4.chambers.rear.volume_m3.get().value;
    case 'bandpass6': return box.bandpass6.chambers.rear.volume_m3.get().value;
    case 'abc': return box.abc.chambers.rear.volume_m3.get().value;
    case 'box-passive-radiator': return box.passiveRadiator.volume_m3.get();
    default: return null;
  }
});
function setVb_m3(v: number): void {
  const box = project.value.box;
  switch (box.boxType.get()) {
    case 'sealed': box.sealed.volume_m3.set(v); break;
    case 'vented': box.vented.volume_m3.set(v); break;
    case 'bandpass4': box.bandpass4.chambers.rear.volume_m3.set(v); break;
    case 'bandpass6': box.bandpass6.chambers.rear.volume_m3.set(v); break;
    case 'abc': box.abc.chambers.rear.volume_m3.set(v); break;
    case 'box-passive-radiator': box.passiveRadiator.volume_m3.set(v); break;
  }
}
function fmt(v: number | null, dp: number): string { return v != null && isFinite(v) ? v.toFixed(dp) : '—'; }

// Tune edits the project directly — a write here is the same write the Box/driver panels make,
// through the same OpenISDProject. Cancel/Reset both discard everything edited since the last
// save (OpenISDProject.cancel()); Tune asks no confirmation of its own, since nothing it holds
// is ever a decision the user has not already made by typing it.
const discardWithoutAsking = async () => true;

function cancel() { void project.value.cancel(discardWithoutAsking); presentationState.editDriver = false; }
function reset()  { void project.value.cancel(discardWithoutAsking); }
</script>

<template>
  <div class="tune-panel">
    <div class="tune-titlebar">
      <span>Tune</span>
      <span class="close-btn" role="button" tabindex="0" title="Cancel — discard changes since the last save" @click="cancel" @keydown.enter="cancel">✕</span>
    </div>
    <p class="tune-hint">The charts update as you scrub. <b>Cancel</b> discards everything since the last save.</p>

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
          <NumInput :model-value="vb_m3" @update:model-value="v => setVb_m3(v ?? 0)" field="Vb" group="volume" base="L" :precision="4" />
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
      <button title="Reset — discard changes since the last save" @click="reset">Reset</button>
      <button class="cancel footer-buttons-pri" title="Cancel — discard changes since the last save; the charts revert" @click="cancel">Cancel</button>
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
