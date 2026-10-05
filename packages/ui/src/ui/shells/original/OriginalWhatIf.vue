<script setup lang="ts">
/**
 * What-if? panel — the docked `.what-if-panel`. Every field writes into the focused project's
 * What-if layer, so the charts update as you scrub but the project never changes. Close (✕,
 * Escape) ends the What-if; Reset puts the project's values back. Behaviour in
 * `OriginalWhatIf-hooks.ts`.
 */
import {onMounted, onUnmounted, reactive, ref} from 'vue';
import {presentationState} from '../../../logic/presentationState.js';
import {useFocusedProject} from '../../../logic/focusedProjectContext.js';
import {formatFixedOrDash, NumberField} from '@openisd/design/fields';
import {cellClassOf} from '../../../logic/driverCells.js';
import NumInput from '../../components/NumInput.vue';
import UnitToggle from '../../components/UnitToggle.vue';
import {inputValue, listeningElement} from '../../../logic/domEvents.js';
import {useEscToClose} from '../../../logic/useEscToClose.js';
import {useOriginalWhatIf} from '../../../hooks/OriginalWhatIf-hooks.js';

const project = useFocusedProject();
const whatIf = useOriginalWhatIf();

// WinISD's own field names — the registry keys by these; the driver's spec section carries the
// SI-suffixed name (`Fs_hz`, `Vas_m3`), so `SPEC` maps the twelve this panel edits to their
// `Field` on the focused project's driver.
type NumKey = 'Fs_hz' | 'Qts' | 'Qes' | 'Qms' | 'Vas_m3' | 'Sd_m2' | 'Re_ohm' | 'Le_H' | 'Xmax_m' | 'Pe_W' | 'BL_Tm' | 'Mms_kg';

function enterField(key: NumKey, v: number, precision?: number): void { whatIf.enterField(key, v, precision); }
function clearField(key: NumKey): void { whatIf.clearField(key); }
// Raw driver values are SI (Vas m³, Sd m², Le H, Xmax m, Mms kg). Whether a field displays and
// accepts input via the units.ts conversion, and which group/token it uses, comes from the
// field's OWN `def.display` (`swDisplay` below) — never a second group/token/unit stated here,
// which could silently disagree with the registry (BUG_20260928, "NumInput's group/base props
// are a fourth table"). A `fixed` field is already shown in its SI unit (Hz, Ω, W, T·m,
// dimensionless Q).
interface PanelField { key: NumKey; def: NumberField; label: string }
const MAIN: PanelField[] = [
  { key: 'Fs_hz', def: NumberField.FS_HZ,  label: 'Fs' },
  { key: 'Qts', def: NumberField.QTS, label: 'Qts' },
  { key: 'Qes', def: NumberField.QES, label: 'Qes' },
  { key: 'Qms', def: NumberField.QMS, label: 'Qms' },
  { key: 'Vas_m3', def: NumberField.VAS_M3, label: 'Vas' },
  { key: 'Sd_m2', def: NumberField.SD_M2,  label: 'Sd' },
  { key: 'Re_ohm', def: NumberField.RE_OHM,  label: 'Re' },
];
const OPTIONAL: PanelField[] = [
  { key: 'Le_H', def: NumberField.LE_H,   label: 'Le' },
  { key: 'Xmax_m', def: NumberField.XMAX_M, label: 'Xmax' },
  { key: 'Pe_W', def: NumberField.PE_W,   label: 'Pe' },
];
// Bl and Mms are ordinary driver fields, not outputs: the ADT derives them when they are not
// entered and honours them when they are (Driver.enter → state E → fixed-E override), exactly
// as the driver editor already treats them. So they are edited here like any other field, and
// the E/C colour says which of the two is happening.
const DERIVED: PanelField[] = [
  { key: 'BL_Tm', def: NumberField.BL_TM,  label: 'Bl' },
  { key: 'Mms_kg', def: NumberField.MMS_KG, label: 'Mms' },
];


/** The unit text shown beside the field: the registry's own symbol (fixed), or the base token's
 *  label out of `UNIT_GROUPS` (switchable) — never a second string. */
function unitLabel(f: PanelField): string {
  return f.def.unitLabel();
}

// While a field is focused, echo the RAW typed string (so mid-typing values like
// "4" → "42" aren't reformatted out from under the caret); reformat on blur.
const rawVals = reactive<Record<string, string>>({});
const resetRevision = ref(0);
// The CELL, not the entered bag: raw() holds entered fields only, so a Q the app solved from
// the other two read as blank here. cell() carries the solved value with its C mark, which is
// what makes the third Q fill itself in as the other two change.

function disp(f: PanelField): string {
  void project.value;
  const v = whatIf.specField(f.key).value;
  if (typeof v !== 'number' || !isFinite(v)) return '';
  return f.def.format(v);
}
function fieldVal(f: PanelField): string {
  void resetRevision.value;
  return f.key in rawVals ? rawVals[f.key] : disp(f);
}
function onField(f: PanelField, e: Event) {
  const raw = inputValue(e);
  rawVals[f.key] = raw;
  // Emptying a field RELEASES it back to Calculated — the override is withdrawn, not set to
  // nothing. Without this a cleared field would keep its last entered value invisibly.
  if (raw.trim() === '') {
    clearField(f.key);
  } else {
    const res = f.def.parseEntry(raw);
    if (res.kind === 'quantity') {
      enterField(f.key, res.valueSI, res.halfWidthSI);
    }
  }
}
function onBlur(f: PanelField) { delete rawVals[f.key]; }

// Registry bounds are SI-space; the input shows the display unit, so the v-limits clamp needs
// the same conversion (e.g. Vas max 100 m³ → 100000 L).
function scaledLimits(f: PanelField): { min?: number; max?: number } {
  const lim = f.def.limits;
  return {
    min: lim.min != null ? f.def.toDisplay(lim.min) : undefined,
    max: lim.max != null ? f.def.toDisplay(lim.max) : undefined,
  };
}

// Any two of the Q trio solve the third, so all three are flagged together while fewer than
// two are usable. The rule itself lives on the field's own `mandatoryAndUnsatisfied` — the
// driver editor reads the same one, against its own draft model.
/** Provenance mark + the required-but-missing alert, in the editor's own class vocabulary. */
function fieldClasses(f: PanelField): Record<string, boolean> {
  void project.value;
  const mandatory = whatIf.specField(f.key).mandatoryAndUnsatisfied;
  return {
    [cellClassOf(whatIf.specField(f.key))]: true,
    'de-input-mandatory': mandatory,
    'de-input-empty': mandatory && fieldVal(f) === '',
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

const dqNote = (key: NumKey): string | null => whatIf.dqNote(key);
const ebpVal = whatIf.ebp;
const vb_m3 = whatIf.vb_m3;
function setVb_m3(v: number): void { whatIf.setVb_m3(v); }
function fmt(v: number | null, dp: number): string { return formatFixedOrDash(v, dp); }

// Every way out ends the What-if: its values are discarded and the project is as it was.
function close() { whatIf.close(); presentationState.editDriver = false; }
async function reset(): Promise<void> {
  await whatIf.reset();
  for (const key of Object.keys(rawVals)) delete rawVals[key];
  resetRevision.value++;
}
useEscToClose(() => presentationState.editDriver, close);
</script>

<template>
  <div class="what-if-panel">
    <div class="what-if-titlebar">
      <span>What-if?</span>
      <span class="close-btn" role="button" tabindex="0" title="Close. The project is not changed." @click="close" @keydown.enter="close">✕</span>
    </div>
    <p class="what-if-hint">Try values and watch the charts. The project is not changed.</p>

    <div class="what-if-grid">
      <div v-for="f in MAIN" :key="f.key" class="what-if-fld">
        <label>{{ f.label }}</label>
        <div class="what-if-unit">
          <input v-expo-step="f.def" type="number" v-limits="scaledLimits(f)" :class="fieldClasses(f)" :value="fieldVal(f)" @input="onField(f, $event)" @blur="onBlur(f)">
          <div v-if="dqNote(f.key)" class="dq-tooltip-container">
            <span class="de-dq" role="button" tabindex="0" @mouseenter="showTooltip(f.key, $event)" @mouseleave="hideTooltip(f.key)" @click.stop="togglePin(f.key, $event)" @keydown.enter.stop="togglePin(f.key, $event)">&#9888;</span>
            <Teleport to="body">
              <div v-show="hoveredTooltip === f.key || pinnedTooltip === f.key" :class="['dq-tooltip-box', 'dq-tooltip-box-' + f.key]" :style="tooltipStyles[f.key]">
                {{ dqNote(f.key) }}
              </div>
            </Teleport>
          </div>
          <span v-if="unitLabel(f)">{{ unitLabel(f) }}</span>
        </div>
      </div>
    </div>

    <div class="what-if-subsect">Box</div>
    <div class="what-if-grid">
      <div class="what-if-fld" title="Net acoustic internal volume — excludes driver displacement, port tube volume and bracing. Tried here only: the project's box volume is not changed. WinISD: Vb.">
        <label>Vb</label>
        <div class="what-if-unit">
          <NumInput :model-value="vb_m3" @update:model-value="v => setVb_m3(v ?? 0)" :field="NumberField.BOX_VB_L" :precision="4" />
          <UnitToggle :field="NumberField.BOX_VB_L" />
        </div>
      </div>
    </div>

    <div class="what-if-subsect">Optional</div>
    <div class="what-if-grid">
      <div v-for="f in OPTIONAL" :key="f.key" class="what-if-fld">
        <label class="opt-lbl">{{ f.label }}</label>
        <div class="what-if-unit">
          <input v-expo-step="f.def" type="number" v-limits="scaledLimits(f)" :class="fieldClasses(f)" :value="fieldVal(f)" @input="onField(f, $event)" @blur="onBlur(f)">
          <div v-if="dqNote(f.key)" class="dq-tooltip-container">
            <span class="de-dq" role="button" tabindex="0" @mouseenter="showTooltip(f.key, $event)" @mouseleave="hideTooltip(f.key)" @click.stop="togglePin(f.key, $event)" @keydown.enter.stop="togglePin(f.key, $event)">&#9888;</span>
            <Teleport to="body">
              <div v-show="hoveredTooltip === f.key || pinnedTooltip === f.key" :class="['dq-tooltip-box', 'dq-tooltip-box-' + f.key]" :style="tooltipStyles[f.key]">
                {{ dqNote(f.key) }}
              </div>
            </Teleport>
          </div>
          <span v-if="unitLabel(f)">{{ unitLabel(f) }}</span>
        </div>
      </div>
    </div>

    <div class="what-if-subsect">Derived</div>
    <div class="what-if-grid">
      <div v-for="f in DERIVED" :key="f.key" class="what-if-fld" :title="`${f.label} is calculated from the parameters above until you type one — then it overrides them. Clear the field to hand it back to the calculation.`">
        <label>{{ f.label }}</label>
        <div class="what-if-unit">
          <input v-expo-step="f.def" type="number" v-limits="scaledLimits(f)" :class="fieldClasses(f)" :value="fieldVal(f)" @input="onField(f, $event)" @blur="onBlur(f)">
          <div v-if="dqNote(f.key)" class="dq-tooltip-container">
            <span class="de-dq" role="button" tabindex="0" @mouseenter="showTooltip(f.key, $event)" @mouseleave="hideTooltip(f.key)" @click.stop="togglePin(f.key, $event)" @keydown.enter.stop="togglePin(f.key, $event)">&#9888;</span>
            <Teleport to="body">
              <div v-show="hoveredTooltip === f.key || pinnedTooltip === f.key" :class="['dq-tooltip-box', 'dq-tooltip-box-' + f.key]" :style="tooltipStyles[f.key]">
                {{ dqNote(f.key) }}
              </div>
            </Teleport>
          </div>
          <span v-if="unitLabel(f)">{{ unitLabel(f) }}</span>
        </div>
      </div>
      <!-- EBP is NOT a driver field: the ADT does not derive it and has no slot to override
           (it is ebp() = Fs/Qes, computed in the engine). Making it editable means choosing
           which of Fs or Qes an entered EBP solves backwards — a decision for the human, not
           an inert box that accepts a number nothing reads. Tracked as an open question. -->
      <div class="what-if-fld what-if-ro" title="EBP = Fs / Qes — a read-out of the two fields above, not a field of its own."><label>EBP</label><span class="what-if-roval">{{ fmt(ebpVal, 1) }}</span></div>
    </div>

    <div class="what-if-btns">
      <button title="Back to the project's values" @click="reset">Reset</button>
      <button class="footer-buttons-pri" title="Close. The project is not changed." @click="close">Close</button>
    </div>
  </div>
</template>

<style scoped>
/* Width follows its content: two columns of label(34) + gap(6) + input(78) + gap(4) + unit(~26). */
.what-if-panel {
  position: fixed; right: 24px; bottom: 24px; z-index: 60;
  width: 340px; max-width: calc(100vw - 32px); max-height: 80vh; overflow-y: auto;
  background: #f7f7f7; border: 1px solid #888; border-radius: 8px;
  box-shadow: 0 6px 24px rgba(0,0,0,.35); padding: 10px 14px 14px; font-size: 13px;
}
.what-if-titlebar { display: flex; align-items: center; justify-content: space-between; font-weight: 600; margin-bottom: 6px; }
.what-if-titlebar .close-btn { cursor: pointer; padding: 0 4px; }
.what-if-titlebar .close-btn:hover { background: #e64545; color: #fff; }
.what-if-hint { color: #777; font-style: italic; font-size: 11.5px; margin-bottom: 8px; }
.what-if-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 12px; }
/* Right-aligned so each label ends against its own input. 34px holds the widest ("Xmax"). */
.what-if-fld { min-width: 0; display: grid; grid-template-columns: 34px 1fr; align-items: center; gap: 6px; }
.what-if-fld label { font-size: 11px; color: #555; text-align: right; white-space: nowrap; }
.what-if-fld .opt-lbl { color: #999; font-style: italic; }
.what-if-unit { display: flex; align-items: center; gap: 4px; }
/* Sized to its own content, not to the column. 78px holds the widest value any of these
   fields shows ("30.0000" at the registry's 4 dp) with room to spare; stretching to 100% of
   a 190px grid column made every field three times wider than the number in it, which is
   what WinISD's own narrow, natural-width fields (docs/winisd_screenshots/*.png) never do. */
.what-if-unit :deep(input), .what-if-roval { width: 78px; padding: 3px 5px; border: 1px solid #999; border-radius: 3px; background: #fff; font: inherit; }
.what-if-roval { text-align: right; color: var(--acc); font-style: italic; display: inline-block; }
.what-if-unit span { font-size: 11px; color: #666; white-space: nowrap; }
.what-if-ro label { opacity: .8; }
.what-if-subsect { color: #7d9fc9; font-weight: 600; font-size: 12px; margin: 10px 0 2px; }
.what-if-btns { display: flex; gap: 8px; justify-content: flex-end; padding-top: 8px; border-top: 1px solid #ddd; margin-top: 10px; }
.what-if-btns button { border: 1px solid #999; background: #f0f0f0; border-radius: 3px; padding: 6px 12px; cursor: pointer; }
.what-if-btns button:hover { background: #dbeaff; border-color: #7fb3ff; }
.what-if-btns button.footer-buttons-pri { background: #1868d1; color: #fff; border-color: #1868d1; }

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
