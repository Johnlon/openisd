<script setup lang="ts">
/**
 * What-if? panel — the docked `.what-if-panel`. Every field writes into the focused project's
 * What-if layer, so the charts update as you scrub but the project never changes. Close (✕,
 * Escape) ends the What-if; Reset puts the project's values back. Behaviour in
 * `OriginalWhatIf-hooks.ts`.
 */
import {useApp} from '../../../logic/app.js';
import type {NumericDriverSpecFieldName} from '@openisd/design';
import {NumberField} from '@openisd/design/fields';
import ProvenanceLegend from '../../components/ProvenanceLegend.vue';
import UIField from '../../components/UIField.vue';
import UIFixedField from '../../components/UIFixedField.vue';
import {provideCellScope} from '../../components/cellScope.js';
import {useEscToClose} from '../../../logic/useEscToClose.js';
import {useOriginalWhatIf} from '../../../hooks/OriginalWhatIf-hooks.js';
const {appState, presentation: presentationState} = useApp();
const {projectChanged} = appState;

provideCellScope({ revision: projectChanged, written: () => {} });

const whatIf = useOriginalWhatIf();

// WinISD's own field names — the registry keys by these; the driver's spec section carries the
// SI-suffixed name (`Fs_hz`, `Vas_m3`). Each row's unit, group and display come from the field's
// own registry entry through `UIField`, never a second string stated here.
type NumKey = NumericDriverSpecFieldName;
interface PanelField { key: NumKey; def: NumberField; label: string }
const MAIN: PanelField[] = [
  ...whatIf.sheetRows,
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

const ebpVal = whatIf.ebp;
const vbCell = whatIf.vbCell;

// Every way out ends the What-if: its values are discarded and the project is as it was.
function close() { whatIf.close(); presentationState.editDriver = false; }
async function reset(): Promise<void> {
  await whatIf.reset();
}
useEscToClose(() => presentationState.editDriver, close);
</script>

<template>
  <div class="what-if-panel">
    <div class="what-if-titlebar">
      <span>What-if</span>
      <span class="close-btn" role="button" tabindex="0" title="Close. The design is not changed." @click="close" @keydown.enter="close">✕</span>
    </div>
    <p class="what-if-hint">Try values and watch the charts. The design is not changed.</p>

    <div class="what-if-grid">
      <UIField v-for="f in MAIN" :key="f.key" class="what-if-fld" :field="f.def" :label="f.label" :cell="whatIf.specCell(f.key)" />
    </div>

    <div class="what-if-subsect">Box</div>
    <div class="what-if-grid">
      <UIField class="what-if-fld" title="Net acoustic internal volume — excludes driver displacement, port tube volume and bracing. Tried here only: the project's box volume is not changed. WinISD: Vb." :field="NumberField.BOX_VB_L" label="Vb" :cell="vbCell" />
    </div>

    <div class="what-if-subsect">Optional</div>
    <div class="what-if-grid">
      <UIField v-for="f in OPTIONAL" :key="f.key" class="what-if-fld" :field="f.def" :label="f.label" :cell="whatIf.specCell(f.key)" />
    </div>

    <div class="what-if-subsect">Derived</div>
    <div class="what-if-grid">
      <UIField v-for="f in DERIVED" :key="f.key" class="what-if-fld" :title="`${f.label} is calculated from the parameters above until you type one — then it overrides them. Clear the field to hand it back to the calculation.`" :field="f.def" :label="f.label" :cell="whatIf.specCell(f.key)" />
      <!-- EBP is NOT a driver field: the ADT does not derive it and has no slot to override
           (it is ebp() = Fs/Qes, computed in the engine). Making it editable means choosing
           which of Fs or Qes an entered EBP solves backwards — a decision for the human, not
           an inert box that accepts a number nothing reads. Tracked as an open question. -->
      <UIFixedField class="what-if-fld what-if-ro" title="EBP = Fs / Qes — a read-out of the two fields above, not a field of its own." :field="NumberField.EBP_HZ" label="EBP" :value="ebpVal" readonly />
    </div>

    <div class="what-if-btns">
      <button title="Back to the design's values" @click="reset">Reset</button>
      <button class="footer-buttons-pri" title="Close. The design is not changed." @click="close">Close</button>
    </div>
    <ProvenanceLegend class="what-if-legend" />
  </div>
</template>

<style scoped>
/* Width follows its content (two columns of label, input, stepper, dq mark and unit), so no unit runs past the edge. */
.what-if-panel {
  position: fixed; right: 24px; bottom: 24px; z-index: 60;
  width: max-content; max-width: calc(100vw - 32px); max-height: 80vh; overflow-y: auto;
  background: #f7f7f7; border: 1px solid #888; border-radius: 8px;
  box-shadow: 0 6px 24px rgba(0,0,0,.35); padding: 10px 14px 14px; font-size: 13px;
}
.what-if-titlebar { display: flex; align-items: center; justify-content: space-between; font-weight: 600; margin-bottom: 6px; }
.what-if-titlebar .close-btn { cursor: pointer; padding: 0 4px; }
.what-if-titlebar .close-btn:hover { background: #e64545; color: #fff; }
.what-if-legend { margin-top: 10px; border: 1px solid var(--line); border-radius: 4px; }
.what-if-hint { color: #777; font-style: italic; font-size: 11.5px; margin-bottom: 8px; }
.what-if-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 12px; }
/* Right-aligned so each label ends against its own input. 34px holds the widest ("Xmax"). */
/* Each row is a UIField; its label column is 34px, right-aligned so each label ends against its own box ("Xmax" is the widest). */
.what-if-panel { --label-w: 34px; }
.what-if-fld { min-width: 0; }
.what-if-fld :deep(.ui-field-label) { font-size: 11px; color: #555; text-align: right; }
.what-if-subsect { color: #7d9fc9; font-weight: 600; font-size: 12px; margin: 10px 0 2px; }
.what-if-btns { display: flex; gap: 8px; justify-content: flex-end; padding-top: 8px; border-top: 1px solid #ddd; margin-top: 10px; }
.what-if-btns button { border: 1px solid #999; background: #f0f0f0; border-radius: 3px; padding: 6px 12px; cursor: pointer; }
.what-if-btns button:hover { background: #dbeaff; border-color: #7fb3ff; }
.what-if-btns button.footer-buttons-pri { background: #1868d1; color: #fff; border-color: #1868d1; }
</style>
