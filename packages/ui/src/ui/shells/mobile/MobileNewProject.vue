<script setup lang="ts">
// Mobile New Project wizard — same steps, same state as the desktop wizard (WinISD order:
// Driver -> Num/placement -> Box type + EBP -> Sealed alignment -> Metadata). Uses the SAME
// useOgNewProject() hook as OriginalNewProject.vue: one wizard implementation, two presentations.
import { computed, onBeforeUnmount, ref } from 'vue';
import { NumberField, PhoneLabels, PhoneWizardHelp, PhoneWizardText, ReadoutFormat, WinisdDeviation, type WizardInfoCard as WizardInfoCardData } from '@openisd/design/fields';
import { useOgNewProject } from '../../../hooks/OriginalNewProject-hooks.js';
import { createNewProjectFooter } from '../../../hooks/NewProjectFooter-hooks.js';
import { useEscToClose } from '../../../logic/useEscToClose.js';
import { useApp } from '../../../logic/app.js';
import BoxTypeDiagram from '../../components/BoxTypeDiagram.vue';
import PhoneButton from './PhoneButton.vue';
import PlacementDiagram from '../../components/PlacementDiagram.vue';
import WizardHelpSheet from '../../components/WizardHelpSheet.vue';
import WizardInfoButton from '../../components/WizardInfoButton.vue';
import WizardInfoCard from '../../components/WizardInfoCard.vue';
import MobileKeyStrip from './MobileKeyStrip.vue';
import PhoneClassicPage from './PhoneClassicPage.vue';
import UIFixedField from '../../components/UIFixedField.vue';
import {provideCellScope} from '../../components/cellScope.js';
import DriverLibrary from '../../components/DriverLibrary.vue';
import NewProjectPassiveRadiatorStep from '../../components/NewProjectPassiveRadiatorStep.vue';

const emit = defineEmits<{ close: [] }>();

const { driverBrowsing } = useApp();
const wizard = useOgNewProject();
// The wizard's fields are drafts held in props, which Vue sees change: the scope never ticks.
provideCellScope({ revision: ref(0), written: () => {} });

const {
  isDriverStep, isCountStep, isBoxTypeStep, isBoxDetailsStep, isProjectInfoStep,
  stepLabel,
  hadUnsaved,

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
  ebpSuitability,

  SEALED_ALIGNMENT_OPTIONS,
  targetQtc,
  qtc,
  sealedFsc_hz,
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

// The ⓘ popups and the step bar's help sheet, over the page; Escape closes the top one first.
const info = ref<'placement' | 'ebp' | null>(null);
const helpOpen = ref(false);
useEscToClose(() => info.value !== null, () => { info.value = null; });
useEscToClose(() => helpOpen.value, () => { helpOpen.value = false; });
const ebpText = computed(() => ReadoutFormat.EBP.text(ebp.value, '--'));
const ebpBadge = computed(() => PhoneWizardText.ebpBadge(ebpSuitability.value));
const infoCard = computed<WizardInfoCardData | null>(() => {
  if (info.value === 'placement') return PhoneWizardText.PLACEMENT_INFO;
  if (info.value === 'ebp') return PhoneWizardText.ebpInfo(ebpText.value);
  return null;
});
const boxLabel = computed(() => BOX_OPTIONS.find(o => o.value === boxType.value)?.label ?? '');
/** The banner's second line: the driver's figures, its EBP, or the box and driver count, by step. */
const bannerSub = computed(() => {
  if (isCountStep.value) return PhoneWizardText.driverFigures(selectedDriverSpecs.value);
  if (isBoxTypeStep.value) return PhoneWizardText.ebpLine(ebpText.value, ebpBadge.value);
  return PhoneWizardText.boxAndDrivers(boxLabel.value, nDrivers.value);
});
const helpSections = computed(() => {
  if (isDriverStep.value) return PhoneWizardHelp.DRIVER;
  if (isCountStep.value) return PhoneWizardHelp.COUNT;
  if (isBoxTypeStep.value) return PhoneWizardHelp.BOX_TYPE;
  if (isBoxDetailsStep.value) return PhoneWizardHelp.boxDetails(boxType.value);
  return PhoneWizardHelp.PROJECT_INFO;
});

driverBrowsing.embedLibrary(driver => selectDriver(driver));
onBeforeUnmount(() => driverBrowsing.closeLibrary());

function finishName(e: KeyboardEvent): void {
  if (e.currentTarget instanceof HTMLElement) e.currentTarget.blur();   // Enter finishes the name; it does not create
}

function handleCreate() {
  const p = createProject();
  if (p) {
    emit('close');
  }
}
</script>

<template>
  <div class="mob-np-overlay">
    <div class="mob-np-head">
      <span class="mob-np-title">{{ PhoneWizardText.TITLE }}</span>
      <button type="button" class="mob-np-close" title="Cancel" aria-label="Close" @click="handleCancel">✕</button>
    </div>
    <MobileKeyStrip />
    <div class="mob-np-stepbar">
      <span class="np-step">{{ stepLabel }}</span>
      <button type="button" class="mob-np-help" :aria-label="PhoneWizardText.HELP_BUTTON" @click="helpOpen = true">
        <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><circle cx="10" cy="10" r="8.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7.6 7.7a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1.1.9-1.1 1.6v.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="10" cy="14.7" r="1.1" fill="currentColor"/></svg>
      </button>
    </div>

    <div class="mob-np-body">
      <p v-if="hadUnsaved" class="np-warn">⚠ The open project has unsaved changes — they are not lost, but the new project takes focus.</p>

      <!-- Step 1: driver library -->
      <div v-if="isDriverStep" class="mob-np-library-wrap">
        <DriverLibrary class="mob-np-library" show-name host="pick" />
      </div>

      <PhoneClassicPage v-else>
        <div v-if="selectedDriver" class="mob-np-banner">
          <div class="mob-np-banner-name">{{ selectedDriverName }}</div>
          <div class="mob-np-banner-sub">{{ bannerSub }}</div>
        </div>

        <!-- Step 2: Driver count & placement -->
        <template v-if="isCountStep">
          <div class="mob-band"><span class="mob-band-title">{{ PhoneWizardText.BAND_DRIVER_ARRAY }}</span></div>
          <div class="mob-crow">
            <label class="mob-crow-label" for="np-ndrivers">{{ PhoneLabels.DRIVERS }}</label>
            <select id="np-ndrivers" class="mob-cselect" :value="nDrivers" @change="e => { const n = selectedOption(e, N_DRIVERS_OPTIONS); if (n !== null) nDrivers = n; }">
              <option v-for="o in N_DRIVERS_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </div>
          <div class="mob-crow">
            <label class="mob-crow-label" for="np-placement">{{ PhoneWizardText.PLACEMENT_LABEL }}</label>
            <select id="np-placement" class="mob-cselect mob-cselect-info" v-model="placement">
              <option value="standard">{{ PhoneWizardText.PLACEMENT_STANDARD }}</option>
              <option value="iso">{{ PhoneWizardText.PLACEMENT_ISOBARIK }}</option>
            </select>
            <WizardInfoButton label="About driver placement" @click="info = 'placement'" />
          </div>
          <div class="mob-np-pic mob-np-pic-note">
            <PlacementDiagram :placement="placement" />
            <div v-if="placement === 'iso'" class="mob-np-pic-caption">{{ PhoneWizardText.ISOBARIK_NOT_MODELLED }}</div>
          </div>
          <div class="mob-crow">
            <label class="mob-crow-label" for="np-wiring">{{ PhoneLabels.CONNECTION }}</label>
            <select id="np-wiring" class="mob-cselect" :value="wiring" @change="e => { const w = selectedOption(e, ARRAY_WIRING_OPTIONS); if (w !== null) wiring = w; }">
              <option v-for="o in ARRAY_WIRING_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </div>
        </template>

        <!-- Step 3: Box type + EBP -->
        <template v-else-if="isBoxTypeStep">
          <div class="mob-band"><span class="mob-band-title">{{ PhoneWizardText.BAND_ENCLOSURE }}</span></div>
          <div class="mob-crow">
            <label class="mob-crow-label" for="np-box-type">{{ PhoneWizardText.BOX_TYPE_LABEL }}</label>
            <select id="np-box-type" class="mob-cselect mob-cselect-wide" :value="boxType" @change="e => { const b = selectedOption(e, BOX_OPTIONS); if (b !== null) boxType = b; }">
              <option v-for="o in BOX_OPTIONS" :key="o.value" :value="o.value" :class="{ 'not-implemented': !IMPLEMENTED_BOX_TYPES.includes(o.value) }">{{ o.label }}</option>
            </select>
          </div>
          <div class="mob-np-ebp">
            <div class="mob-np-ebp-main">
              <span><span class="mob-np-ebp-val">{{ PhoneWizardText.EBP_LABEL }}: {{ ebpText }}</span> <span class="mob-np-ebp-formula">{{ PhoneWizardText.EBP_FORMULA }}</span></span>
              <span v-if="ebpBadge" class="mob-np-ebp-badge" :class="ebpBadge.tone">{{ ebpBadge.label }}</span>
            </div>
            <WizardInfoButton label="About EBP" @click="info = 'ebp'" />
          </div>
          <div class="mob-np-pic"><BoxTypeDiagram :box-type="boxType" /></div>
        </template>

        <!-- Step 4: Sealed Alignment -->
        <template v-else-if="isBoxDetailsStep && isSealed">
          <div class="mob-band"><span class="mob-band-title">{{ PhoneWizardText.BAND_ALIGNMENT }}</span></div>
          <div class="mob-crow mob-crow-stack">
            <label class="mob-crow-label" for="np-alignment">{{ PhoneWizardText.ALIGNMENT_LABEL }}</label>
            <select id="np-alignment" class="mob-cselect mob-cselect-wide" :value="targetQtc" @change="e => { const q = selectedOption(e, SEALED_ALIGNMENT_OPTIONS); if (q !== null) selectSealedAlignment(q); }">
              <option v-for="o in SEALED_ALIGNMENT_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </div>
          <UIFixedField class="mob-ui-field" input-id="np-sealed-volume" :label="PhoneWizardText.BOX_VOLUME_LABEL" :field="NumberField.BOX_VB_L" :value="sealedVolume_m3" @update:value="setSealedVolume_m3" />
          <div class="mob-band"><span class="mob-band-title">{{ PhoneWizardText.BAND_KEY_FIGURES }}</span></div>
          <UIFixedField class="mob-ui-field" :label="PhoneWizardText.CALCULATED_QTC_LABEL" :field="NumberField.BOX_QTC_VALUE" :value="qtc" :deviation="sealedPickerDeviationShown ? WinisdDeviation.SEALED_PICKER : undefined" readonly plain />
          <UIFixedField class="mob-ui-field" :label="PhoneWizardText.BOX_RESONANCE_LABEL" :field="NumberField.BOX_FSC_HZ" :value="sealedFsc_hz" readonly plain />
          <div class="mob-np-pic"><BoxTypeDiagram :box-type="boxType" /></div>
        </template>

        <!-- Step 4: Vented Alignment -->
        <template v-else-if="isBoxDetailsStep && isVented">
          <div class="mob-band"><span class="mob-band-title">{{ PhoneWizardText.BAND_ALIGNMENT }}</span></div>
          <div class="mob-crow mob-crow-stack">
            <label class="mob-crow-label" for="np-vented-alignment">{{ PhoneWizardText.ALIGNMENT_LABEL }}</label>
            <select id="np-vented-alignment" class="mob-cselect mob-cselect-wide" :value="selectedVentedAlignment" @change="e => { const a = selectedOption(e, VENTED_ALIGNMENT_OPTIONS); if (a !== null) selectVentedAlignment(a); }">
              <option v-for="o in VENTED_ALIGNMENT_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </div>
          <UIFixedField class="mob-ui-field" input-id="np-vented-volume" :label="PhoneWizardText.BOX_VOLUME_LABEL" :field="NumberField.BOX_VB_L" :value="ventedVolume_m3" @update:value="setVentedVolume_m3" />
          <div v-if="ventedVolumeWarning" class="mob-chint mob-chint-warn" role="alert" aria-live="polite" data-testid="np-vented-volume-warning">{{ ventedVolumeWarning }}</div>
          <UIFixedField class="mob-ui-field" input-id="np-vented-tuning" :label="PhoneWizardText.TUNING_FREQUENCY_LABEL" :field="NumberField.BOX_FB_HZ" :value="ventedTuning_hz" @update:value="setVentedTuning_hz" />
          <div v-if="ventedTuningWarning" class="mob-chint mob-chint-warn" role="alert" aria-live="polite" data-testid="np-vented-tuning-warning">{{ ventedTuningWarning }}</div>
          <div class="mob-np-pic"><BoxTypeDiagram :box-type="boxType" /></div>
        </template>

        <!-- Step 4: Passive Radiator (WinISD's own wizard step: the radiator and its Vas / Qms / Fs / Sd / Xmax) -->
        <template v-else-if="isBoxDetailsStep && isPassiveRadiator">
          <div class="mob-band"><span class="mob-band-title">{{ PhoneWizardText.BAND_BOX }}</span></div>
          <UIFixedField class="mob-ui-field" input-id="np-starting-volume" :label="PhoneWizardText.STARTING_VOLUME_LABEL" :field="NumberField.BOX_VB_L" :value="volume_m3" @update:value="v => volume_m3 = v" />
          <div class="mob-band"><span class="mob-band-title">{{ PhoneWizardText.BAND_RADIATOR }}</span></div>
          <NewProjectPassiveRadiatorStep classic field-class="mob-ui-field" :radiator="passiveRadiatorView" :edits="passiveRadiatorEdits" :browsing="passiveRadiatorBrowseOpen"
              @browse="passiveRadiatorBrowseOpen = true" @close-browse="passiveRadiatorBrowseOpen = false"
            @load-saved="loadSavedPassiveRadiator" @load-bundled="id => void loadBundledPassiveRadiator(id)" @define="defineNewPassiveRadiator" />
          <div class="mob-np-pic"><BoxTypeDiagram :box-type="boxType" /></div>
        </template>

        <!-- Step 4: Chambers (4th and 6th order bandpass, ABC): each chamber's volume and tuning together -->
        <template v-else-if="isBoxDetailsStep">
          <div class="mob-band"><span class="mob-band-title">{{ PhoneWizardText.BAND_REAR_CHAMBER }}</span></div>
          <UIFixedField class="mob-ui-field" input-id="np-rear-volume" :label="PhoneWizardText.VOLUME_LABEL" :field="NumberField.BOX_VB_L" :value="volume_m3" @update:value="v => volume_m3 = v" />
          <UIFixedField v-if="hasTunings" class="mob-ui-field" input-id="np-rear-tuning" :label="PhoneWizardText.TUNING_LABEL" :field="NumberField.BOX_FRC_HZ" :value="rearTuning_hz" @update:value="v => rearTuning_hz = v" />
          <div class="mob-band"><span class="mob-band-title">{{ PhoneWizardText.BAND_FRONT_CHAMBER }}</span></div>
          <UIFixedField class="mob-ui-field" input-id="np-front-volume" :label="PhoneWizardText.VOLUME_LABEL" :field="NumberField.BOX_VF_L" :value="frontVolume_m3" @update:value="v => frontVolume_m3 = v" />
          <UIFixedField class="mob-ui-field" input-id="np-front-tuning" :label="PhoneWizardText.TUNING_LABEL" :field="NumberField.BOX_FFC_HZ" :value="frontTuning_hz" @update:value="v => frontTuning_hz = v" />
          <div class="mob-np-pic"><BoxTypeDiagram :box-type="boxType" /></div>
        </template>

        <!-- Step 5: Project Information -->
        <template v-else-if="isProjectInfoStep">
          <div class="mob-band"><span class="mob-band-title">{{ PhoneWizardText.BAND_PROJECT_DETAILS }}</span></div>
          <label class="mob-np-stack-label" for="np-proj-name">{{ PhoneWizardText.PROJECT_NAME_LABEL }}</label>
          <div class="mob-np-stack-box"><textarea id="np-proj-name" class="mob-np-text mob-np-text-name" rows="2" enterkeyhint="done" autocomplete="off" v-model="projName" @keydown.enter.prevent="finishName"></textarea></div>
          <label class="mob-np-stack-label" for="np-proj-desc">{{ PhoneWizardText.DESCRIPTION_LABEL }}</label>
          <div class="mob-np-stack-box"><textarea id="np-proj-desc" class="mob-np-text" :placeholder="PhoneWizardText.DESCRIPTION_PLACEHOLDER" v-model="projDescription"></textarea></div>
          <p class="mob-np-hint">{{ PhoneWizardText.PROJECT_HINT }}</p>
        </template>
      </PhoneClassicPage>
    </div>

    <!-- One footer on every step, step 1 included: Cancel, Back, Next (Create Project on the last step), always in the same
         place. On step 1 Next chooses the driver being read; the preview has no buttons of its own. -->
    <div class="mob-np-footer">
      <PhoneButton @click="handleCancel">{{ PhoneWizardText.CANCEL }}</PhoneButton>
      <PhoneButton :disabled="!canBack" @click="back">{{ PhoneWizardText.BACK }}</PhoneButton>
      <PhoneButton v-if="!leadIsCreate" primary class="np-primary" :disabled="!canGoNext" @click="goNext">{{ PhoneWizardText.NEXT }}</PhoneButton>
      <PhoneButton v-else primary class="np-primary" :disabled="!canCreate" @click="handleCreate">{{ PhoneWizardText.CREATE }}</PhoneButton>
    </div>

    <WizardInfoCard v-if="infoCard" :card="infoCard" @close="info = null" />
    <WizardHelpSheet v-if="helpOpen" :title="stepLabel" :sections="helpSections" @close="helpOpen = false" />
  </div>
</template>

<style scoped>
.mob-np-overlay {
  position: fixed; inset: 0; z-index: 100;
  background: var(--m-bg, #EEF1F0);
  display: flex; flex-direction: column;
  font: 15px/1.4 "Inter", system-ui, sans-serif;
}
.mob-np-head {
  flex: none; height: 44px; box-sizing: border-box; display: flex; align-items: center; justify-content: space-between;
  padding: 0 14px; background: #F9FAF9; border-bottom: 1px solid #C7CDCB;
}
.mob-np-title { font-weight: 600; font-size: 16px; }
.mob-np-close { width: 44px; height: 44px; background: none; border: none; font-size: 18px; padding: 0; color: var(--mut); cursor: pointer; }
.mob-np-stepbar {
  position: relative; flex: none; height: 32px; box-sizing: border-box; display: flex; align-items: center;
  padding: 0 48px 0 16px; background: #f7f8f9; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #444;
}
.np-step { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mob-np-help { position: absolute; right: 4px; top: 50%; margin-top: -22px; width: 44px; height: 44px; padding: 0; border: none; background: none; color: var(--acc); display: grid; place-items: center; cursor: pointer; z-index: 2; }
.mob-np-body { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; display: flex; flex-direction: column; background: #fff; }
.mob-np-body > :deep(.mob-classic) { flex: 1 0 auto; }
.mob-np-library-wrap { display: flex; flex-direction: column; flex: 1; min-height: 0; padding: 14px; background: var(--m-bg, #EEF1F0); }
.mob-np-library { flex: 1; min-height: 0; }
.np-warn { margin: 10px 14px 0; color: #8a4b00; background: #fff3e0; border: 1px solid #f0c088; border-radius: 3px; padding: 8px 10px; font-size: 13px; }

/* Selected-driver banner on steps 2 to 5: two lines, each one line with an ellipsis if too long */
.mob-np-banner { padding: 8px 16px; background: #f0fdf4; border-bottom: 1px solid #bbf7d0; font-size: 13px; color: #166534; display: flex; flex-direction: column; gap: 1px; }
.mob-np-banner-name { font-weight: 600; }
.mob-np-banner-sub { font-size: 12px; color: #15803d; }
.mob-np-banner-name, .mob-np-banner-sub { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mob-np-banner + .mob-band { margin-top: 0; }

/* Placement: the select keeps its width; the ⓘ sits in the 90 px stepper area (46 + 44) */
.mob-cselect-info { margin-right: 46px; }
.mob-np-info { flex: none; display: grid; place-items: center; width: 44px; height: 44px; border: none; background: none; color: var(--acc); padding: 0; cursor: pointer; }
.mob-np-pic { display: flex; justify-content: center; align-items: center; padding: 12px 0; border-bottom: 1px solid #e6e6e6; }
.mob-np-pic-note { flex-direction: column; gap: 4px; }
.mob-np-pic-caption { font-size: 13px; color: #666; }

/* Alignment: prod's option names are long, so the label sits above a full-width select */
.mob-classic .mob-crow-stack { flex-direction: column; align-items: stretch; height: auto; padding: 0 var(--mob-edge) 8px; }
.mob-classic .mob-crow-stack .mob-crow-label { width: auto; height: 28px; display: flex; align-items: flex-end; padding: 0 0 4px; }

/* The EBP row: the figure, then the badge on the same line if it fits or whole on the next line, the ⓘ at the right end */
.mob-np-ebp { min-height: var(--mob-row-min); box-sizing: border-box; padding: 4px 0 4px var(--mob-edge); box-shadow: inset 0 -1px 0 #e6e6e6; display: flex; align-items: center; }
.mob-np-ebp-main { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; align-items: center; column-gap: 10px; row-gap: 4px; }
.mob-np-ebp-val { font-size: 14px; font-weight: 600; color: #1e293b; }
.mob-np-ebp-formula { font-size: 12px; color: #64748b; margin-left: 6px; }
.mob-np-ebp-badge { white-space: nowrap; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.5px; text-transform: uppercase; }
.mob-np-ebp-badge.vented { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
.mob-np-ebp-badge.sealed { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
.mob-np-ebp-badge.either { background: #e0f2fe; color: #0369a1; border: 1px solid #7dd3fc; }

/* Step 5: label above a full-width box, as the driver editor's Comment */
.mob-np-stack-label { display: flex; align-items: flex-end; height: 28px; box-sizing: border-box; padding: 0 var(--mob-edge) 4px; font-size: 14px; color: #555; }
.mob-np-stack-box { display: flex; padding: 0 var(--mob-edge) 8px; }
.mob-np-text { flex: 1; min-width: 0; box-sizing: border-box; min-height: 117px; resize: none; overflow-y: auto; border: 1px solid #c4c4c4; border-radius: 4px; padding: 5px 14px; font: inherit; font-size: 15px; line-height: 21px; background: #fff; overflow-wrap: anywhere; outline: none; }
.mob-np-text-name { min-height: 0; height: 54px; overflow: hidden; }
.mob-np-text:focus { border: 2px solid var(--acc); padding: 4px 13px; box-shadow: 0 0 0 3px rgba(24, 104, 209, 0.15); }
.mob-np-hint { margin: 0; padding: 6px var(--mob-edge); font-size: 12px; color: #64748b; font-style: italic; }

.mob-np-footer { flex: none; box-sizing: border-box; display: flex; align-items: center; gap: 10px; padding: 6px 16px; border-top: 1px solid #C7CDCB; background: #F9FAF9; }
.mob-np-footer .mob-btn { flex: 1; min-width: 0; padding: 0 4px; font-size: 13px; white-space: nowrap; }
.mob-np-footer .mob-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
