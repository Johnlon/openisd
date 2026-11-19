<script setup lang="ts">
/**
 * New Project wizard — WinISD step order (Driver -> Num/placement -> Box type + EBP -> Sealed alignment -> Metadata).
 * State management delegated to useOgNewProject() hook per ui.md.
 */
import { computed, onBeforeUnmount, ref } from 'vue';
import { NumberField, PhoneWizardText, PickWidth, PlacementChoice, ReadoutFormat, WinisdDeviation } from '@openisd/design/fields';
import { useOgNewProject } from '../../../hooks/OriginalNewProject-hooks.js';
import { createNewProjectFooter } from '../../../hooks/NewProjectFooter-hooks.js';
import { useEscToClose } from '../../../logic/useEscToClose.js';
import { useApp } from '../../../logic/app.js';
import BoxPlacementDiagram from '../../components/BoxPlacementDiagram.vue';
import PlacementArt from '../../components/PlacementArt.vue';
import UIPickField from '../../components/UIPickField.vue';
import UIFixedField from '../../components/UIFixedField.vue';
import {provideCellScope} from '../../components/cellScope.js';
import WinisdDeviationCue from '../../components/WinisdDeviationCue.vue';
import {DriverListMode} from '../../../logic/driverListMode.js';
import DriverLibrary from '../../components/DriverLibrary.vue';
import NewProjectPassiveRadiatorStep from '../../components/NewProjectPassiveRadiatorStep.vue';
import WizardInfoButton from '../../components/WizardInfoButton.vue';
import WizardInfoCard from '../../components/WizardInfoCard.vue';
import { createWizardInfo } from '../../../hooks/wizardInfo.js';

const emit = defineEmits<{ close: [] }>();

const { driverBrowsing } = useApp();
const wizard = useOgNewProject();
// The wizard's fields are drafts held in props, which Vue sees change: the scope never ticks.
provideCellScope({ revision: ref(0), written: () => {} });

const {
  totalSteps,
  isDriverStep, isCountStep, isBoxTypeStep, isBoxDetailsStep, isProjectInfoStep,
  currentStepNumber,
  stepLabel,

  selectedDriver,
  selectedDriverName,
  selectedDriverSpecs,
  selectDriver,

  nDrivers,
  placement,
  placementChoice,
  placementValue,

  boxType,
  BOX_OPTIONS,
  IMPLEMENTED_BOX_TYPES,
  volume_m3,
  frontVolume_m3,
  hasTunings, rearTuning_hz, frontTuning_hz,
  isSealed,
  isVented,
  sealedVolume_m3,

  ebp,
  ebpSuitabilityLabel,

  SEALED_ALIGNMENT_OPTIONS,
  targetQtc,
  qtc,
  selectSealedAlignment,
  sealedPickerDeviationShown,
  setSealedVolume_m3,

  VENTED_ALIGNMENT_OPTIONS,
  selectedVentedAlignment,
  selectVentedAlignment,
  ventedVolume_m3, setVentedVolume_m3, setVentedTuning_hz,
  ventedTuning_hz,
  ventedVolumeWarning,
  ventedTuningWarning,
  passiveRadiatorPickError,
  passiveRadiatorPickId,

  isPassiveRadiator,
  passiveRadiatorView,
  passiveRadiatorCells,
  setPassiveRadiatorName,
  passiveRadiatorBrowseOpen,
  loadSavedPassiveRadiator,
  loadBundledPassiveRadiator,
  startDefinePassiveRadiator,
  passiveRadiatorEditor,

  projName,
  projDescription,

  selectedOption,

  canBack,
  canCreate,
  back,
  createProject,
  cancel,
} = wizard;

const { canGoNext, leadIsCreate, goNext } = createNewProjectFooter(wizard, driverBrowsing);

function handleCancel() {
  cancel();
  emit('close');
}

useEscToClose(() => true, handleCancel);
// Registered after the dialog's own Escape, so Escape closes the popup first.
const ebpText = computed(() => ReadoutFormat.EBP.text(ebp.value, '--'));
const { infoCard, openPlacementInfo, openEbpInfo, closeInfo } = createWizardInfo(ebpText);

// Step 1 IS the driver library (FIX_WIZARD_SEALED Q1): choosing a driver hands it to the wizard
// for as long as the wizard is open; closing the wizard disarms that handoff.
// A wizard opens on the whole catalogue: the search and filters of an earlier opening are cleared.
driverBrowsing.clearAllFilters();
driverBrowsing.embedLibrary(driver => selectDriver(driver));
onBeforeUnmount(() => driverBrowsing.closeLibrary());

function handleCreate() {
  const p = createProject();
  if (p) {
    emit('close');
  }
}
</script>

<template>
  <div class="overlay open">
    <div class="modal">
      <div class="modal-titlebar">
        <div class="tb-left"><span class="app-icon"></span><span>New Project</span></div>
        <div class="win-controls"><span class="close-btn" role="button" tabindex="0" title="Cancel" @click="handleCancel" @keydown.enter="handleCancel">✕</span></div>
      </div>

      <div class="modal-body">
        <p class="np-step">Step {{ currentStepNumber }} of {{ totalSteps }} — {{ stepLabel }}</p>

        <!-- The chosen driver, on every step once there is one -->
        <div v-if="selectedDriver" class="selected-driver-banner">
          <span class="banner-label">Selected driver:</span> <strong class="banner-value">{{ selectedDriverName }}</strong>
          <span class="driver-specs-preview"><span v-for="line in selectedDriverSpecs" :key="line">{{ line }}</span></span>
        </div>

        <!-- Step 1: the driver library itself (Q1). A row summarises; the footer's Next chooses it. -->
        <div v-if="isDriverStep" class="step-content np-library-step">
          <DriverLibrary class="np-library" show-name :host="DriverListMode.Pick" />
        </div>

        <!-- Step 2: Driver count & placement -->
        <div v-else-if="isCountStep" class="step-content short-pick-fields">
          <div class="field-row">
            <UIFixedField input-id="np-ndrivers" :field="NumberField.DRIVER_NDRIVERS" label="Num. of drivers" :value="nDrivers" @update:value="n => nDrivers = n" />
          </div>
          <div class="np-placement-pic">
            <div class="field-row">
              <!-- A field row like the pick fields around it, so its label column is the group's and the radios start where their boxes do.
                   Three choices, one per drawing (John, 19 Nov 2026: "click the images to select the active one of the 3"): both Iso-Barik
                   drawings give the same Iso-Barik loading; which one is the user's intent, held by the dialog only. -->
              <div class="ui-field ui-pick-field radio-group" role="group" aria-labelledby="np-placement-label">
                <label id="np-placement-label" class="ui-field-label placement-label">{{ PhoneWizardText.PLACEMENT_LABEL }}</label>
                <span class="placement-choices">
                  <label v-for="c in PlacementChoice.ALL" :key="c.value" class="np-place-radio">
                    <input :id="`np-place-${c.value}`" type="radio" name="placement" :value="c.value" v-model="placementValue"> {{ c.label }}
                  </label>
                  <WizardInfoButton question label="About driver placement" @click="openPlacementInfo" />
                  <!-- Each drawing is its choice's label, under its radio: a click on it ticks that radio. The chosen one is framed. -->
                  <label v-for="c in PlacementChoice.ALL" :key="`art-${c.value}`" :for="`np-place-${c.value}`" class="np-place-drawing"
                    :class="{'np-place-on': placementChoice === c}" :data-testid="`placement-${c.art}`" :title="c.optionLabel">
                    <PlacementArt :art="c.art" />
                  </label>
                </span>
              </div>
            </div>
            <div class="np-placement-caption" :class="{'np-placement-caption-off': placement !== 'isobaric'}" :aria-hidden="placement !== 'isobaric'">{{ PhoneWizardText.ISOBARIK_CAPTION }}</div>
          </div>
        </div>

        <!-- Step 3: Type of design (Box Type + EBP) -->
        <div v-else-if="isBoxTypeStep" class="step-content">
          <div class="field-row">
            <UIPickField label="Box type" input-id="np-box-type" :width="PickWidth.MEDIUM">
              <select id="np-box-type" :value="boxType" @change="e => { const b = selectedOption(e, BOX_OPTIONS); if (b !== null) boxType = b; }">
                <option v-for="o in BOX_OPTIONS" :key="o.value" :value="o.value" :class="{ 'not-implemented': !IMPLEMENTED_BOX_TYPES.includes(o.value) }">{{ o.label }}</option>
              </select>
            </UIPickField>
          </div>

          <div class="ebp-readout-card">
            <div class="ebp-row">
              <span class="ebp-label">Efficiency Bandwidth Product (EBP):</span> <strong class="ebp-value">{{ ebpText }}</strong>
              <WizardInfoButton question label="About EBP" @click="openEbpInfo" />
            </div>
            <div class="suitability-row">
              <span class="suitability-badge" :class="ebpSuitabilityLabel.toLowerCase().startsWith('sealed') ? 'sealed' : ebpSuitabilityLabel.toLowerCase().startsWith('vented') ? 'vented' : 'either'">
                {{ ebpSuitabilityLabel }}
              </span>
            </div>
          </div>

          <div class="box-diagram-container">
            <BoxPlacementDiagram :box-type="boxType" :loading="placement" />
          </div>
        </div>

        <!-- Step 4: Sealed Alignment (only when Closed/sealed) -->
        <div v-else-if="isBoxDetailsStep && isSealed" class="step-content">
          <div class="field-row">
            <UIPickField label="Alignment" input-id="np-alignment" :width="PickWidth.LONG">
              <select id="np-alignment" :value="targetQtc" @change="e => { const q = selectedOption(e, SEALED_ALIGNMENT_OPTIONS); if (q !== null) selectSealedAlignment(q); }">
                <option v-for="o in SEALED_ALIGNMENT_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
              <template v-if="sealedPickerDeviationShown" #cue><WinisdDeviationCue :deviation="WinisdDeviation.SEALED_PICKER" /></template>
            </UIPickField>
          </div>

          <UIFixedField input-id="np-sealed-volume" label="Box volume" :field="NumberField.BOX_VB_L" :value="sealedVolume_m3" @update:value="setSealedVolume_m3" />

          <div class="readout-box">
            <div class="readout-item"><span>Calculated Qtc:</span> <strong>{{ ReadoutFormat.QTC.text(qtc, '--') }}</strong></div>
            <div class="readout-item"><span>EBP:</span> <strong>{{ ebpText }}</strong><WizardInfoButton question label="About EBP" @click="openEbpInfo" /></div>
            <div class="readout-item"><span>Recommendation:</span> <strong>{{ ebpSuitabilityLabel }}</strong></div>
          </div>
        </div>

        <!-- Step 4: Vented Alignment (only when box type is Vented; WinISD's five — docs/research/VENTED_ALIGNMENT_FORMULAS.md) -->
        <div v-else-if="isBoxDetailsStep && isVented" class="step-content">
          <div class="field-row">
            <UIPickField label="Alignment" input-id="np-vented-alignment" :width="PickWidth.LONG">
              <select id="np-vented-alignment" :value="selectedVentedAlignment" @change="e => { const a = selectedOption(e, VENTED_ALIGNMENT_OPTIONS); if (a !== null) selectVentedAlignment(a); }">
                <option v-for="o in VENTED_ALIGNMENT_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
            </UIPickField>
          </div>

          <!-- The alignment fills the volume and tuning; both stay typeable. The warnings say when a
               value is implausible. Band: Settings → Vented design limits. -->
          <UIFixedField input-id="np-vented-volume" label="Box volume" :field="NumberField.BOX_VB_L" :value="ventedVolume_m3" @update:value="setVentedVolume_m3" />
          <div v-if="ventedVolumeWarning" class="readout-warning" role="alert" aria-live="polite" data-testid="np-vented-volume-warning">{{ ventedVolumeWarning }}</div>
          <UIFixedField input-id="np-vented-tuning" label="Tuning frequency" :field="NumberField.BOX_FB_HZ" :value="ventedTuning_hz" @update:value="setVentedTuning_hz" />
          <div v-if="ventedTuningWarning" class="readout-warning" role="alert" aria-live="polite" data-testid="np-vented-tuning-warning">{{ ventedTuningWarning }}</div>

          <div class="readout-box">
            <div class="readout-item"><span>EBP:</span> <strong>{{ ebpText }}</strong><WizardInfoButton question label="About EBP" @click="openEbpInfo" /></div>
            <div class="readout-item"><span>Recommendation:</span> <strong>{{ ebpSuitabilityLabel }}</strong></div>
          </div>
        </div>

        <!-- Step 4: Passive Radiator (WinISD's own wizard step: the radiator and its Vas / Qms / Fs / Sd / Xmax) -->
        <div v-else-if="isBoxDetailsStep && isPassiveRadiator" class="step-content np-pr-fields">
          <UIFixedField input-id="np-starting-volume" label="Starting volume" :field="NumberField.BOX_VB_L" :value="volume_m3" @update:value="v => volume_m3 = v" />
          <NewProjectPassiveRadiatorStep :key="passiveRadiatorPickId" :radiator="passiveRadiatorView" :cells="passiveRadiatorCells" :browsing="passiveRadiatorBrowseOpen"
            @browse="passiveRadiatorBrowseOpen = true" @close-browse="passiveRadiatorBrowseOpen = false"
            @rename="setPassiveRadiatorName" @load-saved="loadSavedPassiveRadiator" @load-bundled="loadBundledPassiveRadiator" :editor="passiveRadiatorEditor" @define="startDefinePassiveRadiator" />
          <div v-if="passiveRadiatorPickError" class="readout-warning np-pr-error" role="alert" aria-live="polite">{{ passiveRadiatorPickError }}</div>
        </div>

        <!-- Step 4: Chambers (4th and 6th order bandpass, ABC): each chamber's volume and tuning together -->
        <div v-else-if="isBoxDetailsStep" class="step-content np-chambers">
          <div class="np-chamber">
            <h4>Rear chamber</h4>
            <UIFixedField input-id="np-rear-volume" label="Volume" :field="NumberField.BOX_VB_L" :value="volume_m3" @update:value="v => volume_m3 = v" />
            <UIFixedField v-if="hasTunings" input-id="np-rear-tuning" label="Tuning" :field="NumberField.BOX_FRC_HZ" :value="rearTuning_hz" @update:value="v => rearTuning_hz = v" />
          </div>
          <div class="np-chamber">
            <h4>Front chamber</h4>
            <UIFixedField input-id="np-front-volume" label="Volume" :field="NumberField.BOX_VF_L" :value="frontVolume_m3" @update:value="v => frontVolume_m3 = v" />
            <UIFixedField input-id="np-front-tuning" label="Tuning" :field="NumberField.BOX_FFC_HZ" :value="frontTuning_hz" @update:value="v => frontTuning_hz = v" />
          </div>
        </div>

        <!-- Step 5: Project Information -->
        <div v-else-if="isProjectInfoStep" class="step-content">
          <div class="field-row">
            <UIPickField label="Project name" input-id="np-project-name" :width="PickWidth.TEXT">
              <input id="np-project-name" type="text" placeholder="e.g. Living-room sub" v-model="projName" @keydown.enter="handleCreate">
            </UIPickField>
          </div>
          <div class="field-row" style="margin-top:10px; align-items:flex-start;">
            <div class="field" style="align-items:flex-start;"><label style="margin-top:4px;">Description</label>
              <textarea style="width:280px; height:80px; border:1px solid #999; padding:4px 6px; border-radius:2px;" placeholder="Optional description..." v-model="projDescription"></textarea>
            </div>
          </div>
          <p class="hint">Optional label and notes for this design; you can refine them later on the Project tab.</p>
        </div>
      </div>

      <!-- One footer on every step, step 1 included: Back, the green lead (Next, or Create on the
           last step), Cancel — the same set as the mobile wizard. -->
      <div class="modal-footer">
        <div class="footer-buttons">
          <button class="back-btn" :disabled="!canBack" title="Back to the previous step" @click="back">Back</button>
          <button v-if="!leadIsCreate" class="ok-btn" :disabled="!canGoNext" @click="goNext">Next</button>
          <button v-else class="ok-btn" :disabled="!canCreate" @click="handleCreate">Create</button>
          <button class="cancel-btn" @click="handleCancel">Cancel</button>
        </div>
      </div>
      <WizardInfoCard v-if="infoCard" :card="infoCard" @close="closeInfo" />
    </div>
  </div>
</template>

<style scoped>
.modal { position: relative; }
/* The popup is a 400px card over the middle of the dialog, as on the phone but not bottom-anchored. */
.modal :deep(.mob-np-icard) { left: 50%; right: auto; bottom: auto; top: 110px; width: 400px; margin-left: -200px; box-sizing: border-box; }
.ebp-row, .readout-item { display: flex; align-items: center; gap: 6px; }
.np-chambers { display: flex; gap: 32px; align-items: flex-start; }
.np-chamber h4 { margin: 0 0 8px; font-weight: 600; }
.np-chamber .field { margin-bottom: 6px; }
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.18); z-index: 100; display: flex; align-items: flex-start; justify-content: center; }
.modal { margin-top: 6vh; background: #f7f7f7; border: 1px solid #888; box-shadow: 3px 6px 18px rgba(0,0,0,.35); width: 800px; max-width: 92vw; display: flex; flex-direction: column; height: 500px; max-height: calc(100vh - 6vh - 6px); }
/* One compact size on every step and in both placements (John: "dlg changing size for a workflow is anti pattern"; "that MASSIVE popup is terrible!!!!").
   The content fits the size: the driver library scrolls inside its own area, the radiator rows sit in two columns. */
.modal-titlebar { display: flex; align-items: center; justify-content: space-between; background: #e9e9e9; border-bottom: 1px solid #bbb; padding: 8px 12px; font-size: 15px; }
.modal-titlebar .tb-left { display: flex; align-items: center; gap: 8px; }
.modal-titlebar .app-icon { width: 18px; height: 18px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #888, #333 70%); }
.modal-titlebar .close-btn { cursor: pointer; padding: 1px 6px; color: #555; }
.modal-titlebar .close-btn:hover { background: #e64545; color: #fff; }
.modal-body { padding: 10px 16px; flex: 1 1 auto; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; }
.np-step { color: #666; margin: 0 0 8px; font-weight: 500; }
.step-content { margin-top: 4px; }
/* The driver step: the library fills what is left of the dialog and scrolls its list inside it. */
.np-library-step { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
.selected-driver-banner { background: #eef4fc; border: 1px solid #b8d4f8; padding: 5px 10px; border-radius: 3px; margin-bottom: 6px; font-size: 13px; color: #224466; display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.driver-specs-preview { display: inline-flex; gap: 12px; font-size: 12px; color: #556; margin-left: auto; }
.np-library { flex: 1 1 auto; min-height: 0; }
/* The library in two columns, so its list gets the dialog's height: search and filters on the left, the count, the list and its
   buttons on the right. The overlay's own library keeps its one column. */
.np-library { display: grid; grid-template-columns: 330px minmax(0, 1fr); grid-template-rows: auto auto minmax(0, 1fr) auto; column-gap: 14px; row-gap: 6px; }
.np-library > :deep(.filter) { grid-column: 1; grid-row: 1; }
.np-library > :deep(.filters-block) { grid-column: 1; grid-row: 2 / -1; min-height: 0; overflow-y: auto; align-self: start; display: flex; flex-direction: column; gap: 6px; }
/* In the narrow filter column every filter takes its own line: Fs, Range, its checkbox, Sd, Z. */
.np-library :deep(.param-row) { grid-template-columns: max-content; }
.np-library :deep(.param-row > .pgroup) { grid-column: 1; }
.np-library > :deep(.statusrow) { grid-column: 2; grid-row: 1; }
.np-library > :deep(.filters-on) { grid-column: 2; grid-row: 2; }
.np-library > :deep(.dlist) { grid-column: 2; grid-row: 3; min-height: 0; }
/* A driver's details, opened from its row, take the whole library. */
.np-library > :deep(.preview) { grid-column: 1 / -1; grid-row: 1 / 4; min-height: 0; overflow-y: auto; }
.np-library > :deep(.browser-footer) { grid-column: 2; grid-row: 4; }
.field-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.step-content :deep(.ui-field) { margin-bottom: 6px; }
/* The passive radiator step: Starting volume beside the Select button, the name across, then the eight radiator rows in two
   columns (Vas Qms Fs Sd | Mms Cms Rms Xmax), the pick error across the bottom. The step component's own box is dissolved
   (display: contents) so its rows join this grid; the phone keeps its one column. */
.np-pr-fields { display: grid; grid-template-columns: max-content max-content; column-gap: 24px; row-gap: 6px; align-items: center; align-content: start; }
.np-pr-fields :deep(.np-pr-step) { display: contents; }
.np-pr-fields :deep(.ui-field) { margin: 0; }
.np-pr-fields :deep(.np-pr-browse) { grid-row: 1; grid-column: 2; justify-self: start; width: auto; padding: 0 14px; }
.np-pr-fields :deep(.np-pr-hint) { grid-row: 2; grid-column: 1 / -1; margin: 0; }
.np-pr-fields :deep(.ui-field:has(#np-pr-name)) { grid-row: 3; grid-column: 1 / -1; }
.np-pr-fields :deep(.ui-field:has(#np-pr-vas)) { grid-row: 4; grid-column: 1; }
.np-pr-fields :deep(.ui-field:has(#np-pr-qms)) { grid-row: 5; grid-column: 1; }
.np-pr-fields :deep(.ui-field:has(#np-pr-fs)) { grid-row: 6; grid-column: 1; }
.np-pr-fields :deep(.ui-field:has(#np-pr-sd)) { grid-row: 7; grid-column: 1; }
.np-pr-fields :deep(.ui-field:has(#np-pr-mms)) { grid-row: 4; grid-column: 2; }
.np-pr-fields :deep(.ui-field:has(#np-pr-cms)) { grid-row: 5; grid-column: 2; }
.np-pr-fields :deep(.ui-field:has(#np-pr-rms)) { grid-row: 6; grid-column: 2; }
.np-pr-fields :deep(.ui-field:has(#np-pr-xmax)) { grid-row: 7; grid-column: 2; }
/* Width 0 and min-width 100%: the long error wraps inside the two columns instead of widening them. */
.np-pr-fields .np-pr-error { grid-row: 8; grid-column: 1 / -1; width: 0; min-width: 100%; box-sizing: border-box; }
.field { display: flex; align-items: center; gap: 6px; }
.field label { color: #333; display: inline-block; min-width: 150px; }
.field input, .field select { border: 1px solid #999; padding: 4px 6px; border-radius: 2px; background: #fff; }
.field input { width: 140px; }
.field .unit { color: #555; }
.radio-group { display: grid; align-items: center; margin-bottom: 6px; }
.np-placement-pic { display: flex; flex-direction: column; gap: 4px; }
/* The radios on one line and the drawings under them share one set of columns, starting at the value column. */
.placement-choices { display: grid; grid-template-columns: repeat(3, 168px) auto; align-items: center; column-gap: 8px; row-gap: 6px; }
.np-place-radio { white-space: nowrap; }
/* The label sits level with the radios, not in the middle of radios and drawings. */
.np-placement-pic .placement-label { align-self: start; line-height: 20px; }
/* A drawing is a click target; the chosen one is framed. The Box tab's drawing height, not the phone's larger one. */
.np-place-drawing { display: flex; justify-content: center; box-sizing: border-box; padding: 4px 0; border: 2px solid transparent; border-radius: 4px; cursor: pointer; }
.np-place-drawing:hover { border-color: #b8d4f8; }
.np-place-drawing.np-place-on { border-color: #2e7d32; background: #f0f7f0; }
.np-place-drawing :deep(svg) { height: 88px; width: auto; }
/* The note starts where the labels above it start. */
.np-placement-caption { align-self: flex-start; font-size: 13px; color: #666; }
/* The note's row stays for Standard so the dialog keeps its size when Placement changes. */
.np-placement-caption-off { visibility: hidden; }
.placement-label { color: #333; white-space: nowrap; }
/* The first radio circle starts at the column edge, where the boxes above and below start. */
.placement-choices > label:first-child input { margin-left: 0; }
.radio-group label { cursor: pointer; }
.ebp-readout-card { background: #f0f7f0; border: 1px solid #c0e0c0; border-radius: 4px; padding: 8px 14px; margin: 8px 0; display: flex; align-items: center; justify-content: space-between; }
.ebp-row { font-size: 13.5px; }
.suitability-badge { padding: 3px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
.suitability-badge.sealed { background: #e1f5fe; color: #0277bd; border: 1px solid #81d4fa; }
.suitability-badge.vented { background: #e8f5e9; color: #2e7d32; border: 1px solid #a5d6a7; }
.suitability-badge.either { background: #fff8e1; color: #f57f17; border: 1px solid #ffe082; }
.box-diagram-container { --bpd-h: 112px; display: flex; justify-content: center; margin: 4px 0; }
.volume-fields { margin-top: 10px; }
.readout-box { background: #fafafa; border: 1px solid #ddd; padding: 8px 14px; border-radius: 4px; margin-top: 8px; display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
.readout-item { display: flex; gap: 12px; white-space: nowrap; }
.readout-warning { color: #8a5b00; background: #fff6e0; border: 1px solid #e8cd8a; border-radius: 3px; padding: 4px 8px; font-size: 12px; white-space: normal; }
.hint { color: #888; font-size: 12px; font-style: italic; margin-top: 8px; }
.modal-footer { display: flex; flex: none; align-items: center; justify-content: flex-end; border-top: 1px solid #ccc; padding: 8px 16px; background: #eee; }
.footer-buttons { display: flex; gap: 8px; }
.footer-buttons button { border: 1px solid #999; background: #f0f0f0; color: #222; border-radius: 3px; padding: 6px 14px; cursor: pointer; }
.footer-buttons button:hover:not(:disabled) { background: #dbeaff; border-color: #7fb3ff; }
.footer-buttons button:disabled { opacity: 0.5; cursor: not-allowed; }
.footer-buttons button.cancel-btn { color: #b02a2a; }
.footer-buttons button.ok-btn { background: #2e7d32; border-color: #2e7d32; color: #fff; font-weight: 600; }
.footer-buttons button.ok-btn:hover:not(:disabled) { background: #256b29; border-color: #256b29; }
.action-btn { border: 1px solid #999; background: #f5f5f5; border-radius: 3px; padding: 4px 10px; cursor: pointer; font-size: 12.5px; }
.action-btn:hover { background: #e8e8e8; }
</style>
