<script setup lang="ts">
// The mobile Box tab — box type, volume, and the calculated resonance/Qtc readout. Thin: all
// state and domain reads/writes live in useMobileBoxTab() (src/hooks/MobileBoxTab-hooks.ts), which
// calls the SAME field-wiring factories src/hooks/boxFields.ts exports.
import {NumberField, ReadoutFormat} from '@openisd/design/fields';
import {selectedOption} from '../../../logic/domEvents.js';
import BoxTypeDiagram from '../../components/BoxTypeDiagram.vue';
import NumInput from '../../components/NumInput.vue';
import UIField from '../../components/UIField.vue';
import UIFixedField from '../../components/UIFixedField.vue';
import UnitToggle from '../../components/UnitToggle.vue';
import { useMobileBoxTab } from '../../../hooks/MobileBoxTab-hooks.js';
import { useUnitReadouts } from '../../../hooks/useUnitReadouts.js';

const {
  selectedBox, pending, isDual, frontVolumeCell, rearTuningCell, boxLabel, showEnclosureTab, enclosureNavLabel,
  boxResonance, rearQtc, boxVolumeCell,
  activeTuning, FB_TARGET_TIP,
  selectBoxType, BOX_TYPE_OPTIONS, IMPLEMENTED_BOX_TYPES,
  sealedAlignmentEditor, sealedAlignmentOpen, sealedAlignmentOptions, sealedAlignmentSelected,
  sealedAlignmentVolume_m3, sealedAlignmentEbp, sealedAlignmentSuitability, sealedAlignmentSuitabilityLabel,
  ventedAlignmentEditor, ventedAlignmentOpen, ventedAlignmentOptions, ventedAlignmentSelected,
  ventedAlignmentVolume_L, ventedAlignmentTuning_hz, ventedAlignmentEbp, ventedAlignmentSuitability,
  ventedAlignmentSuitabilityLabel,
  lossesOpen, openLossGroups, resetBoxLosses,
} = useMobileBoxTab();
const { fieldWithUnit, readoutWithUnit } = useUnitReadouts();
</script>

<template>
  <div class="mob-panel">
    <div class="mob-panel-head">Box</div>
    <div class="mob-row">
      <label class="mob-row-label" for="mob-box-type">Box type</label>
      <select id="mob-box-type" class="mob-select" :value="selectedBox"
              @change="e => selectBoxType((e.target as HTMLSelectElement).value)">
        <option v-for="o in BOX_TYPE_OPTIONS" :key="o.value" :value="o.value" :class="{ 'not-implemented': !IMPLEMENTED_BOX_TYPES.includes(o.value) }">{{ o.label }}</option>
      </select>
    </div>
    <p v-if="pending" class="mob-hint mob-hint-warn">
      Response model pending — {{ boxLabel }} isn't simulated by the engine yet, so no curve is drawn.
    </p>
    <div class="mob-diagram"><BoxTypeDiagram :box-type="selectedBox" /></div>
  </div>

  <div class="mob-panel">
    <div class="mob-panel-head">Rear chamber</div>
    <UIField class="mob-ui-field" :field="NumberField.BOX_VB_L" :cell="boxVolumeCell" stepper />

    <UIField v-if="rearTuningCell && (selectedBox === 'bandpass6' || selectedBox === 'abc')" class="mob-ui-field" :field="NumberField.BOX_FRC_HZ" :cell="rearTuningCell" stepper />
    <UIField v-else-if="selectedBox === 'vented'" class="mob-ui-field" :title="FB_TARGET_TIP" :field="NumberField.BOX_FB_HZ" :cell="activeTuning" stepper />
    <div v-else class="mob-field-row mob-field-calculated">
      <div class="mob-field-main">
        <span class="mob-field-label">{{ selectedBox === 'box-passive-radiator' ? 'Fh' : 'Fsc' }}</span>
        <span class="mob-field-value mob-readonly">{{ fieldWithUnit(NumberField.BOX_RESONANCE_HZ, boxResonance, '—') }}</span>
      </div>
    </div>
    <div v-if="selectedBox === 'sealed'" class="mob-field-row mob-field-calculated">
      <div class="mob-field-main">
        <span class="mob-field-label">Qtc</span>
        <span class="mob-field-value mob-readonly">{{ ReadoutFormat.QTC.text(rearQtc, '—') }}</span>
      </div>
    </div>
    <div v-if="selectedBox === 'sealed'" class="mob-row">
      <button class="mob-btn" @click="sealedAlignmentEditor.openEditor">Choose alignment</button>
    </div>
    <div v-if="selectedBox === 'vented'" class="mob-row">
      <button class="mob-btn" @click="ventedAlignmentEditor.openEditor">Choose alignment</button>
    </div>
    <div class="mob-row">
      <button class="mob-btn" @click="lossesOpen = isDual ? 'rear' : 'whole'">Box losses -&gt;</button>
    </div>
  </div>

  <div v-if="isDual" class="mob-panel">
    <div class="mob-panel-head">Front chamber</div>
    <UIField v-if="frontVolumeCell" class="mob-ui-field" :field="NumberField.BOX_VF_L" :cell="frontVolumeCell" stepper />
    <UIField v-if="selectedBox === 'bandpass6' || selectedBox === 'abc'" class="mob-ui-field" :title="FB_TARGET_TIP" :field="NumberField.BOX_FFC_HZ" :cell="activeTuning" stepper />
    <div class="mob-row">
      <button class="mob-btn" @click="lossesOpen = 'front'">Box losses -&gt;</button>
    </div>
  </div>

  <p v-if="showEnclosureTab" class="mob-hint">
    Vents and enclosure details for {{ boxLabel }} are on the "{{ enclosureNavLabel }}" tab.
  </p>

  <div v-if="sealedAlignmentOpen" class="mob-align-overlay" @click.self="sealedAlignmentEditor.cancel">
    <div class="mob-align-sheet">
      <div class="mob-panel-head mob-panel-head-row">
        <span>Choose sealed alignment</span>
        <button class="mob-x" @click="sealedAlignmentEditor.cancel">&#10005;</button>
      </div>
      <div class="mob-row">
        <label class="mob-row-label">Alignment</label>
        <select class="mob-select" :value="sealedAlignmentSelected?.value ?? ''"
                @change="e => { const qtc = selectedOption(e, sealedAlignmentOptions); if (qtc !== null) sealedAlignmentEditor.selectQtc(qtc); }">
          <option v-for="o in sealedAlignmentOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </div>
      <div class="mob-field-row mob-field-entered">
        <div class="mob-field-main">
          <span class="mob-field-label">Volume</span>
          <span class="mob-field-value">
            <NumInput id="mob-sealed-alignment-volume" :model-value="sealedAlignmentVolume_m3" @update:model-value="(v: number | null) => { sealedAlignmentVolume_m3 = v; }"
                      :field="NumberField.BOX_VB_L" :precision="NumberField.BOX_VB_L.precision" />
          </span>
        </div>
        <UnitToggle :field="NumberField.BOX_VB_L" unit-class="mob-unit" />
      </div>
      <div class="mob-align-readout">
        <span class="mob-align-dot" :class="sealedAlignmentSuitability ?? 'unknown'"></span>
        <span>EBP {{ readoutWithUnit(ReadoutFormat.EBP, sealedAlignmentEbp, '—') }} — {{ sealedAlignmentSuitabilityLabel }}</span>
      </div>
      <div class="mob-align-footer">
        <button class="mob-btn" @click="sealedAlignmentEditor.cancel">Cancel</button>
        <button class="mob-btn mob-btn-primary" @click="sealedAlignmentEditor.accept">Accept</button>
      </div>
    </div>
  </div>

  <div v-if="ventedAlignmentOpen" class="mob-align-overlay" @click.self="ventedAlignmentEditor.cancel">
    <div class="mob-align-sheet">
      <div class="mob-panel-head mob-panel-head-row">
        <span>Choose vented alignment</span>
        <button class="mob-x" @click="ventedAlignmentEditor.cancel">&#10005;</button>
      </div>
      <div class="mob-row">
        <label class="mob-row-label">Alignment</label>
        <select class="mob-select" :value="ventedAlignmentSelected"
                @change="e => { const a = selectedOption(e, ventedAlignmentOptions); if (a !== null) ventedAlignmentEditor.selectAlignment(a); }">
          <option v-for="o in ventedAlignmentOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </div>
      <div class="mob-field-row mob-field-calculated">
        <div class="mob-field-main">
          <span class="mob-field-label">Volume</span>
          <span class="mob-field-value mob-readonly">{{ readoutWithUnit(ReadoutFormat.ALIGNMENT_VOLUME_L, ventedAlignmentVolume_L, '—') }}</span>
        </div>
      </div>
      <div class="mob-field-row mob-field-calculated">
        <div class="mob-field-main">
          <span class="mob-field-label">Tuning freq (Fb)</span>
          <span class="mob-field-value mob-readonly">{{ readoutWithUnit(ReadoutFormat.TUNING_HZ, ventedAlignmentTuning_hz, '—') }}</span>
        </div>
      </div>
      <div class="mob-align-readout">
        <span class="mob-align-dot" :class="ventedAlignmentSuitability ?? 'unknown'"></span>
        <span>EBP {{ readoutWithUnit(ReadoutFormat.EBP, ventedAlignmentEbp, '—') }} — {{ ventedAlignmentSuitabilityLabel }}</span>
      </div>
      <div class="mob-align-footer">
        <button class="mob-btn" @click="ventedAlignmentEditor.cancel">Cancel</button>
        <button class="mob-btn mob-btn-primary" @click="ventedAlignmentEditor.accept">Accept</button>
      </div>
    </div>
  </div>

  <div v-if="lossesOpen !== null" class="mob-align-overlay" @click.self="lossesOpen = null">
    <div class="mob-align-sheet">
      <div class="mob-panel-head mob-panel-head-row">
        <span>Box losses</span>
        <button class="mob-x" @click="lossesOpen = null">&#10005;</button>
      </div>
      <template v-for="g in openLossGroups" :key="g.chamber">
        <div v-if="g.heading !== null" class="mob-panel-head">{{ g.heading }}</div>
        <UIFixedField class="mob-ui-field" :field="NumberField.LOSS_QL" :value="g.Ql.value" @update:value="v => g.Ql.set(v)" stepper />
        <UIFixedField class="mob-ui-field" :field="NumberField.LOSS_QA" :value="g.Qa.value" @update:value="v => g.Qa.set(v)" stepper />
        <UIFixedField v-if="g.Qp !== null" class="mob-ui-field" :field="NumberField.LOSS_QP" :value="g.Qp.value" @update:value="v => g.Qp?.set(v)" stepper />
        <UIFixedField v-if="g.Qicl !== null" class="mob-ui-field" :field="NumberField.LOSS_QICL" :value="g.Qicl.value" @update:value="v => g.Qicl?.set(v)" stepper />
      </template>
      <p class="mob-hint">Qa (stuffing): 100 = none · 20–50 = light · 5–10 = heavy. WinISD defaults: Ql=10, Qa=100, Qp=100, Qicl=100.</p>
      <div class="mob-align-footer">
        <button id="mob-box-losses-reset" class="mob-btn" title="Back to WinISD's defaults: Ql 10, Qa 100, Qp 100, Qicl 100" @click="resetBoxLosses">Reset</button>
        <button class="mob-btn mob-btn-primary" @click="lossesOpen = null">OK</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mob-panel {
  margin: 12px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 4px;
  overflow: hidden;
}
.mob-panel-head {
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--mut);
  border-bottom: 1px solid var(--line);
  background: var(--panel2);
}
.mob-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  min-height: 48px;
}
.mob-row-label { font-size: 14px; color: var(--fg); }
.mob-select {
  flex: 1;
  max-width: 60%;
  min-height: 40px;
  padding: 6px 8px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: #fff;
  color: var(--fg);
  font: inherit;
  font-size: 14px;
}
.mob-diagram { display: flex; justify-content: center; padding: 8px 12px 16px; }

/* One editable/readonly row = one "instrument control": a left-edge status stripe carrying the
   SAME provenance colour desktop uses in text (--good entered / --acc calculated), so the value
   itself stays high-contrast rather than tinted — a phone needs the number legible at arm's
   length more than it needs the colour ON the digits. */
.mob-field-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px 10px 14px;
  min-height: 48px;
  border-left: 3px solid transparent;
  border-top: 1px solid var(--line);
}
.mob-field-row:first-of-type { border-top: none; }
.mob-field-entered { border-left-color: var(--good); }
.mob-field-calculated { border-left-color: var(--acc); }
.mob-field-main { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.mob-field-label { font-size: 13px; color: var(--mut); }
.mob-field-value { font-size: 18px; font-variant-numeric: tabular-nums; display: flex; align-items: center; gap: 6px; }
.mob-field-value :deep(input) {
  border: none;
  background: transparent;
  font: inherit;
  font-size: 18px;
  color: var(--fg);
  padding: 0;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 32px;
}
/* An editable value looks like an input box; a read-only one stays flat text. */
.mob-field-value :deep(input:not([readonly])) {
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #fff;
  padding: 2px 8px;
}
.mob-field-value :deep(input:not([readonly]):focus) {
  border-color: var(--acc);
  outline: none;
}
.mob-readonly { color: var(--acc); }
.mob-unit { font-size: 13px; color: var(--mut); min-width: 30px; flex-shrink: 0; }
.mob-hint { margin: 8px 16px; font-size: 12.5px; color: var(--mut); line-height: 1.4; }
.mob-hint-warn { color: var(--acc2); }

.mob-btn {
  flex: 1;
  min-height: 40px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: #fff;
  color: var(--fg);
  font: inherit;
  font-size: 14px;
}
.mob-btn-primary { background: var(--acc); border-color: var(--acc); color: #fff; font-weight: 600; }

/* absolute, not fixed: same reasoning as MobileShell.vue's own .mob-menu-overlay — covers
   .mobile-root (its containing block) so the sheet stays within the phone pane. */
.mob-align-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 210;
  display: flex;
  align-items: flex-end;
}
.mob-align-sheet {
  width: 100%;
  max-height: 80%;
  overflow-y: auto;
  background: var(--panel);
  border-top: 1px solid var(--line);
  border-radius: 8px 8px 0 0;
}
.mob-panel-head-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.mob-x { all: unset; cursor: pointer; padding: 4px 8px; font-size: 14px; color: var(--mut); }
.mob-align-readout {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid var(--line);
  font-size: 13px;
  color: var(--fg);
}
.mob-align-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.mob-align-dot.sealed { background: #2f9e44; }
.mob-align-dot.either { background: #d08a00; }
.mob-align-dot.vented { background: #2878c8; }
.mob-align-dot.unknown { background: #888; }
.mob-align-footer {
  display: flex;
  gap: 10px;
  padding: 12px;
  border-top: 1px solid var(--line);
}
</style>
