<script setup lang="ts">
// The mobile Box tab — box type, volume, and the calculated resonance/Qtc readout. Thin: all
// state and domain reads/writes live in useMobileBoxTab() (src/hooks/MobileBoxTab-hooks.ts), which
// calls the SAME field-wiring factories src/hooks/boxFields.ts exports.
import {NumberField, PhoneBoxText, PhoneHelp, PhoneLabels, ReadoutFormat, WinisdDeviation} from '@openisd/design/fields';
import {selectedOption} from '../../../logic/domEvents.js';
import {useEscToClose} from '../../../logic/useEscToClose.js';
import BoxTypeDiagram from '../../components/BoxTypeDiagram.vue';
import UIField from '../../components/UIField.vue';
import UIFixedField from '../../components/UIFixedField.vue';
import UISettlingField from '../../components/UISettlingField.vue';
import WinisdDeviationCue from '../../components/WinisdDeviationCue.vue';
import MobileEnclosureTab from './MobileEnclosureTab.vue';
import PhoneBand from './PhoneBand.vue';
import PhoneButton from './PhoneButton.vue';
import PhoneClassicPage from './PhoneClassicPage.vue';
import { useMobileBoxTab } from '../../../hooks/MobileBoxTab-hooks.js';
import { useUnitReadouts } from '../../../hooks/useUnitReadouts.js';

const {
  selectedBox, pending, isDual, frontVolumeCell, boxLabel,
  boxResonance, prNaturalFh, boxVolumeCell, sealedFscCell, sealedQtcCell,
  FH_TARGET_TIP,
  selectBoxType, BOX_TYPE_OPTIONS, IMPLEMENTED_BOX_TYPES,
  sealedAlignmentEditor, sealedAlignmentOpen, sealedAlignmentDeviationShown, sealedAlignmentOptions, sealedAlignmentSelected,
  sealedAlignmentVolume_m3, sealedAlignmentEbp, sealedAlignmentSuitability, sealedAlignmentSuitabilityLabel,
  ventedAlignmentEditor, ventedAlignmentOpen, ventedAlignmentOptions, ventedAlignmentSelected,
  ventedAlignmentVolume_m3, ventedAlignmentTuning_hz, ventedAlignmentEbp, ventedAlignmentSuitability,
  ventedAlignmentSuitabilityLabel,
  lossesOpen, openLossGroups, resetBoxLosses,
} = useMobileBoxTab();
const { readoutWithUnit } = useUnitReadouts();
useEscToClose(() => sealedAlignmentOpen.value, () => sealedAlignmentEditor.cancel());
useEscToClose(() => ventedAlignmentOpen.value, () => ventedAlignmentEditor.cancel());
useEscToClose(() => lossesOpen.value !== null, () => { lossesOpen.value = null; });
</script>

<template>
  <PhoneClassicPage>
    <section class="mob-csection">
    <PhoneBand :section="PhoneHelp.BOX" />
    <div class="mob-crow">
      <label class="mob-crow-label" for="mob-box-type">Box type</label>
      <select id="mob-box-type" class="mob-cselect mob-cselect-wide" :value="selectedBox"
              @change="e => selectBoxType((e.target as HTMLSelectElement).value)">
        <option v-for="o in BOX_TYPE_OPTIONS" :key="o.value" :value="o.value" :class="{ 'not-implemented': !IMPLEMENTED_BOX_TYPES.includes(o.value) }">{{ o.label }}</option>
      </select>
    </div>
    <p v-if="pending" class="mob-chint mob-chint-warn">
      Response model pending — {{ boxLabel }} isn't simulated by the engine yet, so no curve is drawn.
    </p>
    <div class="mob-cpic"><BoxTypeDiagram :box-type="selectedBox" /></div>
    </section>

    <section class="mob-csection">
    <PhoneBand :section="PhoneHelp.rearChamber(selectedBox)" />
    <UIField class="mob-ui-field" :field="NumberField.BOX_VB_L" :label="PhoneLabels.VB" :cell="boxVolumeCell" stepper />
    <UIField v-if="selectedBox === 'sealed'" class="mob-ui-field" :field="NumberField.BOX_FSC_HZ" :label="PhoneLabels.FSC" :cell="sealedFscCell" :deviation="WinisdDeviation.CLOSED_BOX_TYPING" stepper />
    <UIFixedField v-else-if="selectedBox === 'box-passive-radiator'" class="mob-ui-field" :title="FH_TARGET_TIP" :field="NumberField.BOX_FH_HZ" :label="PhoneLabels.FH" :value="prNaturalFh" readonly plain />
    <UIFixedField v-else-if="selectedBox === 'bandpass4'" class="mob-ui-field" :field="NumberField.BOX_FSC_HZ" :label="PhoneLabels.FSC" :value="boxResonance" readonly plain />
    <UIField v-if="selectedBox === 'sealed'" class="mob-ui-field" :field="NumberField.BOX_QTC_VALUE" :label="PhoneLabels.QTC" :cell="sealedQtcCell" :deviation="WinisdDeviation.CLOSED_BOX_TYPING" stepper />
    <div class="mob-clinks">
      <button v-if="selectedBox === 'sealed'" type="button" class="mob-clink" @click="sealedAlignmentEditor.openEditor">{{ PhoneBoxText.CHOOSE_ALIGNMENT_LINK }}</button>
      <button v-else-if="selectedBox === 'vented'" type="button" class="mob-clink" @click="ventedAlignmentEditor.openEditor">{{ PhoneBoxText.CHOOSE_ALIGNMENT_LINK }}</button>
      <button type="button" class="mob-clink mob-clink-end" @click="lossesOpen = isDual ? 'rear' : 'whole'">{{ PhoneBoxText.BOX_LOSSES_LINK }}</button>
    </div>

    </section>

    <section v-if="isDual" class="mob-csection">
      <PhoneBand :section="PhoneHelp.FRONT_CHAMBER" />
      <UIField v-if="frontVolumeCell" class="mob-ui-field" :field="NumberField.BOX_VF_L" :label="PhoneLabels.VF" :cell="frontVolumeCell" stepper />
      <div class="mob-clinks">
        <button type="button" class="mob-clink mob-clink-end" @click="lossesOpen = 'front'">{{ PhoneBoxText.BOX_LOSSES_LINK }}</button>
      </div>
    </section>

    <MobileEnclosureTab />
  </PhoneClassicPage>

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
        <WinisdDeviationCue v-if="sealedAlignmentDeviationShown" :deviation="WinisdDeviation.SEALED_PICKER" />
      </div>
      <UIFixedField class="mob-ui-field" input-id="mob-sealed-alignment-volume" :field="NumberField.BOX_VB_L" label="Volume" :value="sealedAlignmentVolume_m3" @update:value="v => { sealedAlignmentVolume_m3 = v; }" />
      <div class="mob-align-readout">
        <span class="mob-align-dot" :class="sealedAlignmentSuitability ?? 'unknown'"></span>
        <span>EBP {{ readoutWithUnit(ReadoutFormat.EBP, sealedAlignmentEbp, '—') }} — {{ sealedAlignmentSuitabilityLabel }}</span>
      </div>
      <div class="mob-align-footer">
        <PhoneButton @click="sealedAlignmentEditor.cancel()">Cancel</PhoneButton>
        <PhoneButton primary @click="sealedAlignmentEditor.accept()">Accept</PhoneButton>
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
      <UIFixedField class="mob-ui-field" :field="NumberField.BOX_VB_L" label="Volume" :value="ventedAlignmentVolume_m3" :format="ReadoutFormat.ALIGNMENT_VOLUME_L" readonly plain />
      <UIFixedField class="mob-ui-field" :field="NumberField.BOX_FB_HZ" label="Tuning freq (Fb)" :value="ventedAlignmentTuning_hz" :format="ReadoutFormat.TUNING_HZ" readonly plain />
      <div class="mob-align-readout">
        <span class="mob-align-dot" :class="ventedAlignmentSuitability ?? 'unknown'"></span>
        <span>EBP {{ readoutWithUnit(ReadoutFormat.EBP, ventedAlignmentEbp, '—') }} — {{ ventedAlignmentSuitabilityLabel }}</span>
      </div>
      <div class="mob-align-footer">
        <PhoneButton @click="ventedAlignmentEditor.cancel()">Cancel</PhoneButton>
        <PhoneButton primary @click="ventedAlignmentEditor.accept()">Accept</PhoneButton>
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
        <UISettlingField class="mob-ui-field" :field="NumberField.LOSS_QL" :value="g.Ql.value" @update:value="v => g.Ql.set(v)" @clear="g.Ql.clear()" stepper />
        <UISettlingField class="mob-ui-field" :field="NumberField.LOSS_QA" :value="g.Qa.value" @update:value="v => g.Qa.set(v)" @clear="g.Qa.clear()" stepper />
        <UISettlingField v-if="g.Qp !== null" class="mob-ui-field" :field="NumberField.LOSS_QP" :value="g.Qp.value" @update:value="v => g.Qp?.set(v)" @clear="g.Qp?.clear()" stepper />
        <UISettlingField v-if="g.Qicl !== null" class="mob-ui-field" :field="NumberField.LOSS_QICL" :value="g.Qicl.value" @update:value="v => g.Qicl?.set(v)" @clear="g.Qicl?.clear()" stepper />
      </template>
      <p class="mob-hint">Qa (stuffing): 100 = none · 20–50 = light · 5–10 = heavy. WinISD defaults: Ql=10, Qa=100, Qp=100, Qicl=100.</p>
      <div class="mob-align-footer">
        <PhoneButton id="mob-box-losses-reset" title="Back to WinISD's defaults: Ql 10, Qa 100, Qp 100, Qicl 100" @click="resetBoxLosses">Reset</PhoneButton>
        <PhoneButton primary @click="lossesOpen = null">OK</PhoneButton>
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
  padding: var(--mob-row-pad-y) 12px;
  min-height: var(--mob-row-min);
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

.mob-hint { margin: 8px 16px; font-size: 12.5px; color: var(--mut); line-height: 1.4; }
.mob-hint-warn { color: var(--acc2); }


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
