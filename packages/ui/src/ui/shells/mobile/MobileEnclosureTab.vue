<script setup lang="ts">
// The vent and passive-radiator sections of the Box page (after the chambers): one vent section per
// vent the box draws, the passive radiator (by name: its figures are in the passive-radiator editor, QO946.c115), and the Chart section holding the velocity limit.
// Thin: all state and domain reads/writes live in useMobileEnclosureTab()
// (src/hooks/MobileEnclosureTab-hooks.ts). PRBrowser is the app's existing overlay, reused unchanged.
import {ChartInputs, NumberField, PhoneBoxText, PhoneHelp, PhoneLabels, WinisdDeviation} from '@openisd/design/fields';
import {selectedOption} from '../../../logic/domEvents.js';
import UIField from '../../components/UIField.vue';
import UIFixedField from '../../components/UIFixedField.vue';
import PRBrowser from '../../components/PRBrowser.vue';
import PREditorDialog from '../../components/PREditorDialog.vue';
import PRInfoDialog from '../../components/PRInfoDialog.vue';
import PhoneBand from './PhoneBand.vue';
import {useMobileEnclosureTab} from '../../../hooks/MobileEnclosureTab-hooks.js';

const {
  project, selectedBox,
  ventSections, tuningNoteShown,
  prResonanceMassDq, prFsMass_hz,
  prBrowseOpen, loadPREntry, loadBundledPassiveRadiatorEntry, prEditor, startEditPR, defineNewPREntry, prInfoOpen, prInfo, openPRInfo, prKeyFigures, prTwoTimesRule,
  VENT_SHAPE_OPTIONS, END_CORRECTION_OPTIONS,
  FB_TARGET_TIP, VENT_GEOMETRY_TIP,
} = useMobileEnclosureTab();
</script>

<template>
  <section v-for="section in ventSections" :key="section.name" class="mob-csection">
    <PhoneBand :section="section.help" />
    <p v-if="section.name === 'Intra'" class="mob-cnote">{{ PhoneBoxText.INTRA_VENT_NOTE }}</p>
    <UIField v-if="section.tuning" class="mob-ui-field" :title="FB_TARGET_TIP" :field="section.tuning.field" :label="section.tuning.label" :cell="section.tuning.cell" stepper />
    <UIFixedField class="mob-ui-field" :field="NumberField.VENT_COUNT" :label="'Number of Vents'" :value="section.vent.count.value" @update:value="n => section.vent.count.set(n)" />
    <div class="mob-crow">
      <label class="mob-crow-label">Shape</label>
      <select class="mob-cselect" :value="section.vent.shape.value"
              @change="e => { const shape = selectedOption(e, VENT_SHAPE_OPTIONS); if (shape !== null) section.vent.shape.set(shape); }">
        <option v-for="o in VENT_SHAPE_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </div>
    <div class="mob-crow">
      <label class="mob-crow-label">End Correction</label>
      <select class="mob-cselect" :value="section.vent.endCorrection_m.value"
              @change="e => { const k = selectedOption(e, END_CORRECTION_OPTIONS); if (k !== null) section.vent.endCorrection_m.set(k); }">
        <option v-for="o in END_CORRECTION_OPTIONS" :key="o.value" :value="o.value">{{ o.label }} ({{ o.value }})</option>
      </select>
    </div>
    <template v-if="section.vent.shape.value === 'slotted'">
      <UIField class="mob-ui-field" :title="VENT_GEOMETRY_TIP" :field="NumberField.VENT_W_CM" :cell="section.vent.width_m" stepper />
      <UIField class="mob-ui-field" :title="VENT_GEOMETRY_TIP" :field="NumberField.VENT_H_CM" :cell="section.vent.height_m" stepper />
    </template>
    <UIField v-else class="mob-ui-field" :title="VENT_GEOMETRY_TIP" :field="NumberField.VENT_D_CM" :cell="section.vent.diameter_m" stepper />
    <UIField class="mob-ui-field" :field="NumberField.VENT_L_CM" :cell="section.vent.length_m" stepper />
    <UIFixedField class="mob-ui-field" :field="NumberField.VENT_CROSSAREA_M2" :value="section.vent.totalArea_m2()" readonly plain />
    <UIFixedField class="mob-ui-field" :field="NumberField.VENT_1STPORTRESONANCE_HZ" :value="section.portPipeResonance_hz" readonly plain />
    <p v-if="tuningNoteShown && section.tuning && section.unreachable" class="mob-chint mob-chint-warn">{{ section.unreachableMsg }}</p>
  </section>

  <template v-if="selectedBox === 'box-passive-radiator'">
    <section class="mob-csection">
    <PhoneBand :section="PhoneHelp.PASSIVE_RADIATOR" />
    <div class="mob-crow">
      <button id="mob-pr-name-btn" type="button" class="mob-cname mob-cname-button" title="Choose a passive radiator" @click="prBrowseOpen = true">{{ project.box.passiveRadiator.radiator.model.value || PhoneBoxText.PR_UNNAMED }}</button>
    </div>
    <div class="mob-cbtns">
      <button type="button" class="mob-btn mob-btn-primary" @click="prBrowseOpen = true">Select PR</button>
      <button type="button" class="mob-btn mob-btn-secondary mob-pr-info" id="mob-pr-info" title="View information about this project’s passive radiator" @click="openPRInfo">Info</button>
      <button id="mob-pr-edit" type="button" class="mob-btn mob-btn-secondary" :title="PhoneBoxText.PR_EDIT_TIP" @click="startEditPR">Edit</button>
    </div>
    <PRBrowser v-if="prBrowseOpen" phone :editor="prEditor" @close="prBrowseOpen = false"
      @load="loadPREntry" @load-bundled="loadBundledPassiveRadiatorEntry" @define="defineNewPREntry" />
    <PRInfoDialog v-if="prInfoOpen && prInfo" phone :info="prInfo" @close="prInfoOpen = false" />
    <PREditorDialog v-if="!prBrowseOpen && prEditor.cells.value" phone :editor="prEditor" :cells="prEditor.cells.value" />
    <UIField class="mob-ui-field" :title="PhoneBoxText.FP_TIP" :field="NumberField.PR_FP_HZ" :label="PhoneLabels.PR_FP" :cell="project.box.passiveRadiator.tuning_goal_hz" :deviation="WinisdDeviation.PR_BOX_TUNING" stepper />
    </section>

    <section class="mob-csection">
    <PhoneBand :section="PhoneHelp.PR_KEY_FIGURES" />
    <!-- Tapping a key figure opens the editor, as on the Driver tab. -->
    <UIFixedField class="mob-ui-field mob-ui-field-tap" :chart-inputs="ChartInputs.RADIATOR" input-id="mob-pr-key-fs" @click="startEditPR" @keydown.enter="startEditPR" :field="NumberField.PR_FS_HZ" :value="prKeyFigures.Fs_hz" readonly plain />
    <UIFixedField class="mob-ui-field mob-ui-field-tap" :chart-inputs="ChartInputs.RADIATOR" input-id="mob-pr-key-mms" @click="startEditPR" @keydown.enter="startEditPR" :field="NumberField.MMS_KG" :value="prKeyFigures.Mms_kg" readonly plain />
    <UIFixedField class="mob-ui-field mob-ui-field-tap" :chart-inputs="ChartInputs.RADIATOR" input-id="mob-pr-key-sd" @click="startEditPR" @keydown.enter="startEditPR" :field="NumberField.PR_SD_CM2" :value="prKeyFigures.Sd_m2" readonly plain />
    <UIFixedField class="mob-ui-field mob-ui-field-tap" :chart-inputs="ChartInputs.RADIATOR" input-id="mob-pr-key-xmax" @click="startEditPR" @keydown.enter="startEditPR" :field="NumberField.PR_XMAX_MM" :value="prKeyFigures.Xmax_m" readonly plain />
    <UIFixedField class="mob-ui-field mob-ui-field-tap" :chart-inputs="ChartInputs.RADIATOR" input-id="mob-pr-key-vd" @click="startEditPR" @keydown.enter="startEditPR" :field="NumberField.VD_M3" :value="prKeyFigures.Vd_m3" readonly plain />
    <p v-if="prTwoTimesRule" id="mob-pr-two-times" class="mob-cnote">{{ prTwoTimesRule }}</p>
    </section>

    <section class="mob-csection">
    <PhoneBand :section="PhoneHelp.USER_OPTIONS" />
    <UIFixedField class="mob-ui-field" input-id="mob-pr-count" :field="NumberField.PR_NUM" :value="project.box.passiveRadiator.count.value" @update:value="n => project.box.passiveRadiator.count.set(n)" />
    <UIField class="mob-ui-field" :field="NumberField.PR_MADD_G" :label="PhoneLabels.PR_ADDED_MASS" :cell="project.box.passiveRadiator.addedMass_kg" stepper />
    <UIFixedField class="mob-ui-field" :field="NumberField.PR_FSMASS_HZ" :label="PhoneLabels.PR_FPR_MASS" :value="prFsMass_hz" :dq="prResonanceMassDq.dq" readonly plain />
    </section>
  </template>

  <section v-if="ventSections.length > 0" class="mob-csection">
    <PhoneBand :section="PhoneHelp.CHART" />
    <UIFixedField class="mob-ui-field" input-id="mob-vent-velocity-limit" label="Velocity limit" :field="NumberField.VENT_PORTVELOCITYLIMIT_M_PER_S" :defaulted="false" :value="project.portVelocityLimit_m_per_s.value" @update:value="v => project.portVelocityLimit_m_per_s.set(v)" />
  </section>
</template>

<style scoped>
.mob-pr-info { flex: 0 0 var(--mob-button-h); padding: 0; }
</style>
