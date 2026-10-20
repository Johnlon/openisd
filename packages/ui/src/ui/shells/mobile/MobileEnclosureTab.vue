<script setup lang="ts">
// The vent and passive-radiator sections of the Box page (after the chambers): one vent section per
// vent the box draws, the passive radiator, and the Chart section holding the velocity limit.
// Thin: all state and domain reads/writes live in useMobileEnclosureTab()
// (src/hooks/MobileEnclosureTab-hooks.ts). PRBrowser is the app's existing overlay, reused unchanged.
import {NumberField, PhoneHelp, TextField, WinisdDeviation} from '@openisd/design/fields';
import {inputValue, selectedOption} from '../../../logic/domEvents.js';
import UIField from '../../components/UIField.vue';
import UIFixedField from '../../components/UIFixedField.vue';
import PRBrowser from '../../components/PRBrowser.vue';
import SaveToLibraryDialog from '../../components/SaveToLibraryDialog.vue';
import PhoneBand from './PhoneBand.vue';
import {useMobileEnclosureTab} from '../../../hooks/MobileEnclosureTab-hooks.js';

const {
  project, selectedBox,
  activeTuning, ventSections, tuningLabel, tuningHeadsVents, fbUnreachable, fbUnreachableMsg, tuningField,
  prResonanceMassDq, prFsMass_hz,
  prBrowseOpen, loadPREntry, loadBundledPassiveRadiatorEntry, defineNewPREntry,
  prSaveOpen, prSaveFields, prSaveCanSave, openPRSave, cancelPRSave, confirmPRSave,
  VENT_SHAPE_OPTIONS, END_CORRECTION_OPTIONS, VENT_COUNT_OPTIONS, PR_COUNT_OPTIONS,
  FB_TARGET_TIP, VENT_GEOMETRY_TIP,
} = useMobileEnclosureTab();
</script>

<template>
  <section v-for="section in ventSections" :key="section.name" class="mob-csection">
    <PhoneBand :section="section.help" />
    <UIField v-if="tuningHeadsVents" class="mob-ui-field" :title="FB_TARGET_TIP" :field="tuningField" :label="tuningLabel" :cell="activeTuning" stepper />
    <div class="mob-crow">
      <label class="mob-crow-label">Number of Vents</label>
      <select class="mob-cselect" :value="section.vent.count.value"
              @change="e => { const n = selectedOption(e, VENT_COUNT_OPTIONS); if (n !== null) section.vent.count.set(n); }">
        <option v-for="o in VENT_COUNT_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </div>
    <div class="mob-crow">
      <label class="mob-crow-label">Shape</label>
      <select class="mob-cselect" :value="section.vent.shape.value"
              @change="e => { const shape = selectedOption(e, VENT_SHAPE_OPTIONS); if (shape !== null) section.vent.shape.set(shape); }">
        <option v-for="o in VENT_SHAPE_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </div>
    <div class="mob-crow">
      <label class="mob-crow-label">End Correction</label>
      <select class="mob-cselect mob-cselect-wide" :value="section.vent.endCorrection_m.value"
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
    <p v-if="tuningHeadsVents && fbUnreachable" class="mob-chint mob-chint-warn">{{ fbUnreachableMsg }}</p>
  </section>

  <template v-if="selectedBox === 'box-passive-radiator'">
    <section class="mob-csection">
    <PhoneBand :section="PhoneHelp.PASSIVE_RADIATOR" />
    <div class="mob-crow">
      <input id="mob-pr-name" class="mob-cname" type="text" :aria-label="TextField.PR_NAME.label" :title="TextField.PR_NAME.description" :value="project.box.passiveRadiator.radiator.model.value" @input="e => project.box.passiveRadiator.radiator.model.set(inputValue(e))">
    </div>
    <div class="mob-cbtns">
      <button type="button" class="mob-btn mob-btn-primary" @click="prBrowseOpen = true">Select passive radiator</button>
      <button type="button" class="mob-btn mob-btn-secondary" title="Save a copy of this passive radiator to your library, under a name you choose" @click="openPRSave">Save to library</button>
    </div>
    <SaveToLibraryDialog v-if="prSaveOpen" title="Save passive radiator to library"
      note="The name the copy has in your library. The project's passive radiator keeps its own name."
      :fields="prSaveFields" :can-save="prSaveCanSave" save-label="Save" @save="confirmPRSave" @cancel="cancelPRSave" />
    <PRBrowser v-if="prBrowseOpen" @close="prBrowseOpen = false"
      @load="loadPREntry" @load-bundled="loadBundledPassiveRadiatorEntry" @define="defineNewPREntry" />

    <UIField class="mob-ui-field" :field="NumberField.PR_VAS_L" :cell="project.box.passiveRadiator.radiator.spec.Vas_m3" stepper />
    <UIField class="mob-ui-field" :field="NumberField.PR_QMS" :cell="project.box.passiveRadiator.radiator.spec.Qms" stepper />
    <UIField class="mob-ui-field" :field="NumberField.PR_FS_HZ" :cell="project.box.passiveRadiator.radiator.spec.Fs_hz" stepper />
    <UIField class="mob-ui-field" :field="NumberField.PR_SD_CM2" :cell="project.box.passiveRadiator.radiator.spec.Sd_m2" stepper />
    <UIField class="mob-ui-field" :field="NumberField.MMS_KG" :cell="project.box.passiveRadiator.radiator.spec.Mms_kg" :deviation="WinisdDeviation.PR_MMS_CMS_TYPING" stepper />
    <UIField class="mob-ui-field" :field="NumberField.CMS_M_PER_N" :cell="project.box.passiveRadiator.radiator.spec.Cms_m_per_N" :deviation="WinisdDeviation.PR_MMS_CMS_TYPING" stepper />
    <UIField class="mob-ui-field" :field="NumberField.PR_XMAX_MM" :cell="project.box.passiveRadiator.radiator.spec.Xmax_m" stepper />

    </section>

    <section class="mob-csection">
    <PhoneBand :section="PhoneHelp.USER_OPTIONS" />
    <div class="mob-crow">
      <label class="mob-crow-label" for="mob-pr-count">Number of passive radiators</label>
      <select id="mob-pr-count" class="mob-cselect" :value="project.box.passiveRadiator.count.value" @change="e => { const n = selectedOption(e, PR_COUNT_OPTIONS); if (n !== null) project.box.passiveRadiator.count.set(n); }"><option v-for="o in PR_COUNT_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option></select>
    </div>
    <UIField class="mob-ui-field" :field="NumberField.PR_FP_HZ" :cell="project.box.passiveRadiator.tuning_goal_hz" stepper />
    <UIField class="mob-ui-field" :field="NumberField.PR_MADD_G" :cell="project.box.passiveRadiator.addedMass_kg" stepper />
    <UIFixedField class="mob-ui-field" :field="NumberField.PR_FSMASS_HZ" :value="prFsMass_hz" :dq="prResonanceMassDq.dq" readonly plain />
    </section>
  </template>

  <section v-if="ventSections.length > 0" class="mob-csection">
    <PhoneBand :section="PhoneHelp.CHART" />
    <UIFixedField class="mob-ui-field" input-id="mob-vent-velocity-limit" label="Velocity limit" :field="NumberField.VENT_PORTVELOCITYLIMIT_M_PER_S" :defaulted="false" :value="project.portVelocityLimit_m_per_s.value" @update:value="v => project.portVelocityLimit_m_per_s.set(v)" />
  </section>
</template>
