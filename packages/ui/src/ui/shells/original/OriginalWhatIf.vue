<script setup lang="ts">
/**
 * What-if? panel — the docked `.what-if-panel`. Every field writes into the focused project's
 * What-if layer, so the charts update as you scrub but the project never changes. Close (✕,
 * Escape) ends the What-if; Reset puts the project's values back. Behaviour in
 * `OriginalWhatIf-hooks.ts`.
 */
import {computed, ref} from 'vue';
import {useApp} from '../../../logic/app.js';
import type {NumericDriverSpecFieldName} from '@openisd/design';
import {NumberField} from '@openisd/design/fields';
import ProvenanceLegend from '../../components/ProvenanceLegend.vue';
import UIField from '../../components/UIField.vue';
import UIFixedField from '../../components/UIFixedField.vue';
import WhatIfBoxField from '../../components/WhatIfBoxField.vue';
import {provideCellScope} from '../../components/cellScope.js';
import {useEscToClose} from '../../../logic/useEscToClose.js';
import {useOriginalWhatIf} from '../../../hooks/OriginalWhatIf-hooks.js';
const {appState, presentation: presentationState} = useApp();
const {projectChanged} = appState;

provideCellScope({ revision: projectChanged, written: () => {} });

const whatIf = useOriginalWhatIf();
const collapsed = ref(false);
const boxRows = whatIf.boxRows;
type SheetBoxRow = typeof whatIf.boxRows.value[number];
type PortLengthRow = typeof whatIf.portLengthRows.value[number];
type BoxRow = { readonly kind: 'field'; readonly row: SheetBoxRow } | { readonly kind: 'portLength'; readonly row: PortLengthRow };
interface BoxLine { readonly cells: readonly (BoxRow | null)[]; readonly full: boolean }
const sheetCell = (row: SheetBoxRow): BoxRow => ({kind: 'field', row});
const lengthCell = (row: PortLengthRow): BoxRow => ({kind: 'portLength', row});
const boxLines = computed<readonly BoxLine[]>(() => {
  const rows = boxRows.value;
  const bySlot = new Map(rows.map(row => [row.field.slot, sheetCell(row)]));
  const lengths = new Map(whatIf.portLengthRows.value.map(row => [row.portName, lengthCell(row)]));
  const front = bySlot.has('frontVolume');
  if (!front) {
    const lines: BoxLine[] = [];
    for (const row of rows) {
      lines.push({cells: [sheetCell(row)], full: true});
      if (row.field.slot === 'ventTuning' && lengths.has('Vent')) lines.push({cells: [lengths.get('Vent')!], full: true});
    }
    return lines;
  }
  const pair = (rear: string, fore: string): readonly (BoxRow | null)[] => [
    bySlot.get(rear as SheetBoxRow['field']['slot']) ?? null,
    bySlot.get(fore as SheetBoxRow['field']['slot']) ?? null,
  ];
  const lines: BoxLine[] = [
    {cells: pair('volume', 'frontVolume'), full: false},
    {cells: pair('rearTuning', 'ventTuning'), full: false},
    {cells: [lengths.get('Rear') ?? null, lengths.get('Front') ?? null], full: false},
    {cells: pair('rearVentArea', bySlot.has('frontVentArea') ? 'frontVentArea' : 'ventArea'), full: false},
  ];
  const intra = bySlot.get('intraVentArea');
  if (intra) lines.push({cells: [intra], full: true});
  return lines.filter(line => line.cells.some(Boolean));
});
function setBoxValue(row: SheetBoxRow, value: number): void { whatIf.setBoxField(row.field, value); }

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
// Every way out ends the What-if: its values are discarded and the project is as it was.
function close() { whatIf.close(); presentationState.editDriver = false; }
async function reset(): Promise<void> {
  await whatIf.reset();
}
useEscToClose(() => presentationState.editDriver, close);
</script>

<template>
  <div class="what-if-panel" :class="{'what-if-panel-collapsed': collapsed}">
    <div class="what-if-titlebar">
      <span>What-if</span>
      <div class="what-if-title-actions">
        <button type="button" class="collapse-btn" :aria-expanded="!collapsed" :aria-label="collapsed ? 'Expand What-if panel' : 'Collapse What-if panel to reveal the chart'" :title="collapsed ? 'Expand the What-if controls' : 'Collapse the controls; What-if stays active'" @click="collapsed = !collapsed">{{ collapsed ? 'Expand' : 'Collapse' }}</button>
        <button type="button" class="close-btn" aria-label="Close What-if" title="Close. The design is not changed." @click="close">✕</button>
      </div>
    </div>
    <div class="what-if-content" v-show="!collapsed">
      <p class="what-if-hint">Try values and watch the charts. The design is not changed.</p>

      <div class="what-if-subsect">Driver</div>
      <div class="what-if-grid">
        <UIField v-for="f in MAIN" :key="f.key" class="what-if-fld" :field="f.def" :label="f.label" :cell="whatIf.specCell(f.key)" />
      </div>

    <div class="what-if-subsect">Box</div>
    <div class="what-if-box-grid">
      <div v-for="(line, index) in boxLines" :key="index" class="what-if-box-line" :class="{'what-if-box-line-full': line.full}">
        <template v-for="(row, cellIndex) in line.cells" :key="row ? (row.kind === 'field' ? row.row.field.label : row.row.key) : `empty-${cellIndex}`">
          <WhatIfBoxField v-if="row?.kind === 'field'" :row="row.row" :set-value="setBoxValue" />
          <UIField v-else-if="row" class="what-if-fld" :title="`Edit ${row.row.label} to recalculate its tuning frequency, or edit Fb to recalculate the required port length. Volume stays fixed.`" :field="NumberField.VENT_L_CM" :label="row.row.label" :cell="row.row.cell" />
          <span v-else class="what-if-box-placeholder" aria-hidden="true"></span>
        </template>
      </div>
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
.what-if-title-actions { display:flex; align-items:center; gap:8px; }
.what-if-title-actions button { border:0; background:transparent; color:inherit; font:inherit; cursor:pointer; padding:2px 5px; }
.what-if-title-actions .collapse-btn { color:#555; font-size:12px; font-weight:500; }
.what-if-title-actions .close-btn { font-size:16px; line-height:1; }
.what-if-titlebar .close-btn:hover { background: #e64545; color: #fff; }
.what-if-panel-collapsed { max-height:none; overflow:visible; padding-bottom:8px; }
.what-if-panel-collapsed .what-if-titlebar { margin-bottom:0; }
.what-if-legend { margin-top: 10px; border: 1px solid var(--line); border-radius: 4px; }
.what-if-hint { color: #777; font-style: italic; font-size: 11.5px; margin-bottom: 8px; }
.what-if-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 12px; }
.what-if-box-grid { display:flex; flex-direction:column; gap:6px; }
.what-if-box-line { display:grid; grid-template-columns:minmax(0, 1fr) minmax(0, 1fr); gap:12px; align-items:start; }
.what-if-box-line-full { grid-template-columns:minmax(0, 1fr); }
.what-if-box-placeholder { min-width:0; }
/* Keep box labels on the app's usual left edge and reserve enough room for "Front port area".
   The input and its two spinner buttons use 80px + 2×14px, narrowing each control slightly. */
.what-if-panel { --label-w:128px; --what-if-box-w:114px; }
.what-if-panel :deep(.ui-field.ui-field[data-field] > .ui-field-label) {
  grid-column:1; grid-row:1; width:100%; max-width:none; box-sizing:border-box;
  justify-self:stretch; margin-right:22px; padding:0; white-space:nowrap; overflow-wrap:normal; text-align:left;
  max-width:calc(100% - 22px);
}
.what-if-panel :deep(.ui-field.ui-field[data-field]) {
  --joined-label:var(--label-w) !important;
  --joined-box:var(--what-if-box-w) !important;
  --joined-model:24px !important;
}
.what-if-subsect { color: #7d9fc9; font-weight: 600; font-size: 12px; margin: 10px 0 2px; }
.what-if-btns { display: flex; gap: 8px; justify-content: flex-end; padding-top: 8px; border-top: 1px solid #ddd; margin-top: 10px; }
.what-if-btns button { border: 1px solid #999; background: #f0f0f0; border-radius: 3px; padding: 6px 12px; cursor: pointer; }
.what-if-btns button:hover { background: #dbeaff; border-color: #7fb3ff; }
.what-if-btns button.footer-buttons-pri { background: #1868d1; color: #fff; border-color: #1868d1; }
</style>
