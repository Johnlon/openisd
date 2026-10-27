<script setup lang="ts">
/**
 * New Project wizard — WinISD step order (Driver -> Num/placement -> Box type + EBP -> Sealed alignment -> Metadata).
 * State management delegated to useOgNewProject() hook per ui.md.
 */
import { onBeforeUnmount, ref } from 'vue';
import { NumberField, PickWidth, ReadoutFormat, WinisdDeviation } from '@openisd/design/fields';
import { useOgNewProject } from '../../../hooks/OriginalNewProject-hooks.js';
import { createNewProjectFooter } from '../../../hooks/NewProjectFooter-hooks.js';
import { useEscToClose } from '../../../logic/useEscToClose.js';
import { useApp } from '../../../logic/app.js';
import BoxTypeDiagram from '../../components/BoxTypeDiagram.vue';
import UIPickField from '../../components/UIPickField.vue';
import UIFixedField from '../../components/UIFixedField.vue';
import {provideCellScope} from '../../components/cellScope.js';
import WinisdDeviationCue from '../../components/WinisdDeviationCue.vue';
import {DriverListMode} from '../../../logic/driverListMode.js';
import DriverLibrary from '../../components/DriverLibrary.vue';
import NewProjectPassiveRadiatorStep from '../../components/NewProjectPassiveRadiatorStep.vue';

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
  wiring,
  N_DRIVERS_OPTIONS,
  ARRAY_WIRING_OPTIONS,

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

  isPassiveRadiator,
  passiveRadiatorView,
  passiveRadiatorEdits,
  passiveRadiatorBrowseOpen,
  loadSavedPassiveRadiator,
  loadBundledPassiveRadiator,
  defineNewPassiveRadiator,

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

// Step 1 IS the driver library (FIX_WIZARD_SEALED Q1): choosing a driver hands it to the wizard
// for as long as the wizard is open; closing the wizard disarms that handoff.
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
        <div v-if="isDriverStep" class="step-content">
          <DriverLibrary class="np-library" show-name :host="DriverListMode.Pick" />
        </div>

        <!-- Step 2: Driver count & placement -->
        <div v-else-if="isCountStep" class="step-content">
          <div class="field-row">
            <UIPickField label="Num. of drivers" input-id="np-ndrivers" :width="PickWidth.SHORT">
              <select id="np-ndrivers" :value="nDrivers" @change="e => { const n = selectedOption(e, N_DRIVERS_OPTIONS); if (n !== null) nDrivers = n; }">
                <option v-for="o in N_DRIVERS_OPTIONS" :key="o.value" :value="o.value">{{ o.label }} driver(s)</option>
              </select>
            </UIPickField>
          </div>
          <div class="radio-group field-row">
            <label><input type="radio" name="placement" value="standard" v-model="placement"> Standard</label>
            <label><input type="radio" name="placement" value="iso" v-model="placement" disabled> Iso-Barik <em style="color:#999">(not modelled)</em></label>
          </div>
          <div class="field-row">
            <UIPickField label="Voice coil connection" input-id="np-wiring" :width="PickWidth.SHORT">
              <select id="np-wiring" :value="wiring" @change="e => { const w = selectedOption(e, ARRAY_WIRING_OPTIONS); if (w !== null) wiring = w; }">
                <option v-for="o in ARRAY_WIRING_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
            </UIPickField>
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
              <span class="ebp-label">Efficiency Bandwidth Product (EBP):</span> <strong class="ebp-value">{{ ReadoutFormat.EBP.text(ebp, '--') }}</strong>
            </div>
            <div class="suitability-row">
              <span class="suitability-badge" :class="ebpSuitabilityLabel.toLowerCase().startsWith('sealed') ? 'sealed' : ebpSuitabilityLabel.toLowerCase().startsWith('vented') ? 'vented' : 'either'">
                {{ ebpSuitabilityLabel }}
              </span>
            </div>
          </div>

          <div class="box-diagram-container">
            <BoxTypeDiagram :box-type="boxType" />
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
            <div class="readout-item"><span>EBP:</span> <strong>{{ ReadoutFormat.EBP.text(ebp, '--') }}</strong></div>
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
            <div class="readout-item"><span>EBP:</span> <strong>{{ ReadoutFormat.EBP.text(ebp, '--') }}</strong></div>
            <div class="readout-item"><span>Recommendation:</span> <strong>{{ ebpSuitabilityLabel }}</strong></div>
          </div>
        </div>

        <!-- Step 4: Passive Radiator (WinISD's own wizard step: the radiator and its Vas / Qms / Fs / Sd / Xmax) -->
        <div v-else-if="isBoxDetailsStep && isPassiveRadiator" class="step-content">
          <UIFixedField input-id="np-starting-volume" label="Starting volume" :field="NumberField.BOX_VB_L" :value="volume_m3" @update:value="v => volume_m3 = v" />
          <NewProjectPassiveRadiatorStep :radiator="passiveRadiatorView" :edits="passiveRadiatorEdits" :browsing="passiveRadiatorBrowseOpen"
            @browse="passiveRadiatorBrowseOpen = true" @close-browse="passiveRadiatorBrowseOpen = false"
            @load-saved="loadSavedPassiveRadiator" @load-bundled="id => void loadBundledPassiveRadiator(id)" @define="defineNewPassiveRadiator" />
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
    </div>
  </div>
</template>

<style scoped>
.np-chambers { display: flex; gap: 32px; align-items: flex-start; }
.np-chamber h4 { margin: 0 0 8px; font-weight: 600; }
.np-chamber .field { margin-bottom: 6px; }
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.18); z-index: 100; display: flex; align-items: flex-start; justify-content: center; }
.modal { margin-top: 6vh; background: #f7f7f7; border: 1px solid #888; box-shadow: 3px 6px 18px rgba(0,0,0,.35); width: 800px; max-width: 92vw; }
.modal-titlebar { display: flex; align-items: center; justify-content: space-between; background: #e9e9e9; border-bottom: 1px solid #bbb; padding: 8px 12px; font-size: 15px; }
.modal-titlebar .tb-left { display: flex; align-items: center; gap: 8px; }
.modal-titlebar .app-icon { width: 18px; height: 18px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #888, #333 70%); }
.modal-titlebar .close-btn { cursor: pointer; padding: 1px 6px; color: #555; }
.modal-titlebar .close-btn:hover { background: #e64545; color: #fff; }
.modal-body { padding: 16px 20px; }
.np-step { color: #666; margin-bottom: 10px; font-weight: 500; }
.step-content { margin-top: 10px; }
.selected-driver-banner { background: #eef4fc; border: 1px solid #b8d4f8; padding: 6px 10px; border-radius: 3px; margin-bottom: 12px; font-size: 13px; color: #224466; display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.driver-specs-preview { display: inline-flex; gap: 12px; font-size: 12px; color: #556; margin-left: auto; }
/* The library sets its own height here: the overlay gives it a 535px window, the wizard has no window to fill. */
.np-library { height: 420px; }
.field-row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.step-content :deep(.ui-field) { margin-bottom: 10px; }
.field { display: flex; align-items: center; gap: 6px; }
.field label { color: #333; display: inline-block; min-width: 150px; }
.field input, .field select { border: 1px solid #999; padding: 4px 6px; border-radius: 2px; background: #fff; }
.field input { width: 140px; }
.field .unit { color: #555; }
.radio-group { margin-left: 156px; gap: 16px; margin-bottom: 12px; }
.radio-group label { cursor: pointer; }
.ebp-readout-card { background: #f0f7f0; border: 1px solid #c0e0c0; border-radius: 4px; padding: 10px 14px; margin: 12px 0; display: flex; align-items: center; justify-content: space-between; }
.ebp-row { font-size: 13.5px; }
.suitability-badge { padding: 3px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
.suitability-badge.sealed { background: #e1f5fe; color: #0277bd; border: 1px solid #81d4fa; }
.suitability-badge.vented { background: #e8f5e9; color: #2e7d32; border: 1px solid #a5d6a7; }
.suitability-badge.either { background: #fff8e1; color: #f57f17; border: 1px solid #ffe082; }
.box-diagram-container { display: flex; justify-content: center; margin: 10px 0; }
.volume-fields { margin-top: 10px; }
.readout-box { background: #fafafa; border: 1px solid #ddd; padding: 10px 14px; border-radius: 4px; margin-top: 12px; display: flex; flex-direction: column; gap: 6px; font-size: 13px; }
.readout-item { display: flex; gap: 12px; white-space: nowrap; }
.readout-warning { color: #8a5b00; background: #fff6e0; border: 1px solid #e8cd8a; border-radius: 3px; padding: 4px 8px; font-size: 12px; white-space: normal; }
.hint { color: #888; font-size: 12px; font-style: italic; margin-top: 8px; }
.modal-footer { display: flex; align-items: center; justify-content: flex-end; border-top: 1px solid #ccc; padding: 10px 20px; background: #eee; }
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
