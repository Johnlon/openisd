<script setup lang="ts">
// Mobile New Project wizard — same steps, same state as the desktop wizard (WinISD order:
// Driver -> Num/placement -> Box type + EBP -> Sealed alignment -> Metadata). Uses the SAME
// useOgNewProject() hook as OriginalNewProject.vue: one wizard implementation, two presentations.
import { onBeforeUnmount } from 'vue';
import { useOgNewProject } from '../../../hooks/OriginalNewProject-hooks.js';
import { useEscToClose } from '../../../logic/useEscToClose.js';
import { useApp } from '../../../logic/app.js';
import BoxTypeDiagram from '../../components/BoxTypeDiagram.vue';
import DriverLibrary from '../../components/DriverLibrary.vue';
import NewProjectPassiveRadiatorStep from '../../components/NewProjectPassiveRadiatorStep.vue';

const emit = defineEmits<{ close: [] }>();

const { driverBrowsing } = useApp();
const wizard = useOgNewProject();

const {
  step,
  totalSteps,
  currentStepNumber,
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
  vol,
  frontVol,
  isDual,
  isSealed,
  isVented,
  sealedVolume_L,

  ebp,
  ebpSuitabilityLabel,

  SEALED_ALIGNMENT_OPTIONS,
  targetQtc,
  qtc,
  selectSealedAlignment,

  VENTED_ALIGNMENT_OPTIONS,
  selectedVentedAlignment,
  selectVentedAlignment,
  ventedVolume_L,
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

  canNext,
  canBack,
  canCreate,
  next,
  back,
  createProject,
  cancel,
} = wizard;

function handleCancel() {
  cancel();
  emit('close');
}

useEscToClose(() => true, handleCancel);

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
  <div class="mob-np-overlay">
    <div class="mob-np-head">
      <span class="mob-np-title">New project</span>
      <button type="button" class="mob-np-close" title="Cancel" @click="handleCancel">✕</button>
    </div>

    <div class="mob-np-body">
      <p v-if="hadUnsaved" class="np-warn">⚠ The open project has unsaved changes — they are not lost, but the new project takes focus.</p>
      <p class="np-step">Step {{ currentStepNumber }} of {{ totalSteps }} — {{ stepLabel }}</p>

      <div v-if="selectedDriver" class="selected-driver-banner">
        <span class="banner-label">Selected driver:</span> <strong class="banner-value">{{ selectedDriverName }}</strong>
        <span class="driver-specs-preview"><span v-for="line in selectedDriverSpecs" :key="line">{{ line }}</span></span>
      </div>

      <!-- Step 1: driver library -->
      <div v-if="step === 1" class="step-content mob-np-library-wrap">
        <DriverLibrary class="mob-np-library" show-name />
      </div>

      <!-- Step 2: Driver count & placement -->
      <div v-else-if="step === 2" class="step-content">
        <div class="field"><label>Num. of drivers</label>
          <select id="np-ndrivers" :value="nDrivers" @change="e => { const n = selectedOption(e, N_DRIVERS_OPTIONS); if (n !== null) nDrivers = n; }">
            <option v-for="o in N_DRIVERS_OPTIONS" :key="o.value" :value="o.value">{{ o.label }} driver(s)</option>
          </select>
        </div>
        <div class="radio-group">
          <label><input type="radio" name="mob-placement" value="standard" v-model="placement"> Standard</label>
          <label><input type="radio" name="mob-placement" value="iso" v-model="placement" disabled> Iso-Barik <em>(not modelled)</em></label>
        </div>
        <div class="field"><label>Voice coil connection</label>
          <select id="np-wiring" :value="wiring" @change="e => { const w = selectedOption(e, ARRAY_WIRING_OPTIONS); if (w !== null) wiring = w; }">
            <option v-for="o in ARRAY_WIRING_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </div>
      </div>

      <!-- Step 3: Box type + EBP -->
      <div v-else-if="step === 3" class="step-content">
        <div class="field"><label>Box type</label>
          <select id="np-box-type" :value="boxType" @change="e => { const b = selectedOption(e, BOX_OPTIONS); if (b !== null) boxType = b; }">
            <option v-for="o in BOX_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </div>

        <div class="ebp-readout-card">
          <div class="ebp-row">
            <span class="ebp-label">EBP:</span>
            <strong class="ebp-value">{{ ebp !== null ? ebp.toFixed(1) : '--' }}</strong>
          </div>
          <span class="suitability-badge" :class="ebpSuitabilityLabel.toLowerCase().startsWith('sealed') ? 'sealed' : ebpSuitabilityLabel.toLowerCase().startsWith('vented') ? 'vented' : 'either'">
            {{ ebpSuitabilityLabel }}
          </span>
        </div>

        <div class="box-diagram-container">
          <BoxTypeDiagram :box-type="boxType" />
        </div>

        <div v-if="!isSealed && !isVented" class="volume-fields">
          <template v-if="!isDual">
            <div class="field"><label>Starting volume</label><div class="field-inline"><input type="number" step="0.1" v-limits="{ min: 0.1, max: 100000 }" v-model.number="vol"><span class="unit">l</span></div></div>
          </template>
          <template v-else>
            <div class="field"><label>Rear chamber volume</label><div class="field-inline"><input type="number" step="0.1" v-limits="{ min: 0.1, max: 100000 }" v-model.number="vol"><span class="unit">l</span></div></div>
            <div class="field"><label>Front chamber volume</label><div class="field-inline"><input type="number" step="0.1" v-limits="{ min: 0.1, max: 100000 }" v-model.number="frontVol"><span class="unit">l</span></div></div>
          </template>
        </div>
      </div>

      <!-- Step 4: Sealed Alignment -->
      <div v-else-if="step === 4 && isSealed" class="step-content">
        <div class="field"><label>Alignment</label>
          <select id="np-alignment" :value="targetQtc" @change="e => { const q = selectedOption(e, SEALED_ALIGNMENT_OPTIONS); if (q !== null) selectSealedAlignment(q); }">
            <option v-for="o in SEALED_ALIGNMENT_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </div>
        <div class="field"><label>Box volume</label>
          <div class="field-inline"><input type="number" step="0.1" v-limits="{ min: 0.1, max: 100000 }" v-model.number="sealedVolume_L"><span class="unit">l</span></div>
        </div>
        <div class="readout-box">
          <div class="readout-item"><span>Calculated Qtc:</span> <strong>{{ qtc !== null ? qtc.toFixed(3) : '--' }}</strong></div>
          <div class="readout-item"><span>EBP:</span> <strong>{{ ebp !== null ? ebp.toFixed(1) : '--' }}</strong></div>
          <div class="readout-item"><span>Recommendation:</span> <strong>{{ ebpSuitabilityLabel }}</strong></div>
        </div>
      </div>

      <!-- Step 4: Vented Alignment -->
      <div v-else-if="step === 4 && isVented" class="step-content">
        <div class="field"><label>Alignment</label>
          <select id="np-vented-alignment" :value="selectedVentedAlignment" @change="e => { const a = selectedOption(e, VENTED_ALIGNMENT_OPTIONS); if (a !== null) selectVentedAlignment(a); }">
            <option v-for="o in VENTED_ALIGNMENT_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </div>
        <div class="readout-box">
          <div class="readout-item"><span>Box volume:</span> <strong>{{ ventedVolume_L.toFixed(1) }} l</strong></div>
          <div v-if="ventedVolumeWarning" class="readout-warning" role="alert" aria-live="polite" data-testid="np-vented-volume-warning">{{ ventedVolumeWarning }}</div>
          <div class="readout-item"><span>Tuning frequency:</span> <strong>{{ ventedTuning_hz.toFixed(1) }} Hz</strong></div>
          <div v-if="ventedTuningWarning" class="readout-warning" role="alert" aria-live="polite" data-testid="np-vented-tuning-warning">{{ ventedTuningWarning }}</div>
          <div class="readout-item"><span>EBP:</span> <strong>{{ ebp !== null ? ebp.toFixed(1) : '--' }}</strong></div>
          <div class="readout-item"><span>Recommendation:</span> <strong>{{ ebpSuitabilityLabel }}</strong></div>
        </div>
      </div>

      <!-- Step 4: Passive Radiator (WinISD's own wizard step: the radiator and its Vas / Qms / Fs / Sd / Xmax) -->
      <div v-else-if="step === 4 && isPassiveRadiator" class="step-content">
        <NewProjectPassiveRadiatorStep :radiator="passiveRadiatorView" :edits="passiveRadiatorEdits" :browsing="passiveRadiatorBrowseOpen"
            @browse="passiveRadiatorBrowseOpen = true" @close-browse="passiveRadiatorBrowseOpen = false"
          @load-saved="loadSavedPassiveRadiator" @load-bundled="id => void loadBundledPassiveRadiator(id)" @define="defineNewPassiveRadiator" />
      </div>

      <!-- Step 5: Project Information -->
      <div v-else-if="step === 5" class="step-content">
        <div class="field field-stack"><label>Project name</label>
          <input type="text" placeholder="e.g. Living-room sub" v-model="projName" @keydown.enter="handleCreate">
        </div>
        <div class="field field-stack"><label>Description</label>
          <textarea placeholder="Optional description..." v-model="projDescription"></textarea>
        </div>
        <p class="hint">Optional label and notes for this design; you can refine them later on the Project tab.</p>
      </div>
    </div>

    <!-- Same footer on every step, step 1 included: Cancel is always in the same place. On step 1
         DriverLibrary keeps its own compact Cancel/Use pair for the driver preview inside the list. -->
    <div class="mob-np-footer">
      <button v-if="canBack" class="cancel-btn" @click="back">&lt; Back</button>
      <button v-if="canNext" class="ok-btn" @click="next">Next &gt;</button>
      <button v-if="step === 5" class="ok-btn" :disabled="!canCreate" @click="handleCreate">Create</button>
      <button class="cancel-btn" @click="handleCancel">Cancel</button>
    </div>
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
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 14px; background: #F9FAF9; border-bottom: 1px solid #C7CDCB;
}
.mob-np-title { font-weight: 600; font-size: 16px; }
.mob-np-close { background: none; border: none; font-size: 18px; padding: 6px 10px; cursor: pointer; }
/* display:flex here (not just overflow-y) so step 1's library-wrap below can flex:1 to fill
   the FULL remaining height, not just a min-height guess — without this, DriverLibrary's own
   Cancel/Use pair (.prev-footer) ends up wherever its content happens to end, floating
   mid-screen instead of pinned at the true bottom like every other step's own footer. */
.mob-np-body { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; }
.mob-np-library-wrap { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.mob-np-library { flex: 1; min-height: 0; }
.np-step { color: #59635F; margin-bottom: 10px; font-weight: 500; }
.np-warn { color: #8a4b00; background: #fff3e0; border: 1px solid #f0c088; border-radius: 3px; padding: 8px 10px; margin-bottom: 10px; font-size: 13px; }
.selected-driver-banner { background: #eef4fc; border: 1px solid #b8d4f8; padding: 8px 10px; border-radius: 4px; margin-bottom: 12px; font-size: 13px; color: #224466; display: flex; flex-direction: column; gap: 4px; }
.driver-specs-preview { display: flex; flex-wrap: wrap; gap: 10px; font-size: 12px; color: #556; }
.field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.field label { color: #333; font-size: 13px; font-weight: 500; }
.field input, .field select, .field textarea { border: 1px solid #999; padding: 10px; border-radius: 4px; background: #fff; font: inherit; width: 100%; min-height: 40px; }
.field textarea { height: 80px; resize: vertical; }
.field-inline { display: flex; align-items: center; gap: 8px; }
.field .unit { color: #555; font-size: 13px; }
.field-stack input, .field-stack textarea { width: 100%; }
.radio-group { display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px; }
.radio-group label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px; }
.ebp-readout-card { background: #f0f7f0; border: 1px solid #c0e0c0; border-radius: 4px; padding: 10px 12px; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
.ebp-row { font-size: 14px; }
.suitability-badge { padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
.suitability-badge.sealed { background: #e1f5fe; color: #0277bd; border: 1px solid #81d4fa; }
.suitability-badge.vented { background: #e8f5e9; color: #2e7d32; border: 1px solid #a5d6a7; }
.suitability-badge.either { background: #fff8e1; color: #f57f17; border: 1px solid #ffe082; }
.box-diagram-container { display: flex; justify-content: center; margin: 12px 0; }
.readout-box { background: #fafafa; border: 1px solid #ddd; padding: 10px 12px; border-radius: 4px; margin-top: 10px; display: flex; flex-direction: column; gap: 8px; font-size: 13px; }
.readout-item { display: flex; justify-content: space-between; gap: 12px; }
.readout-warning { color: #8a5b00; background: #fff6e0; border: 1px solid #e8cd8a; border-radius: 3px; padding: 6px 8px; font-size: 12px; }
.hint { color: #888; font-size: 12px; font-style: italic; margin-top: 8px; }
.mob-np-footer { display: flex; gap: 8px; padding: 10px 14px; border-top: 1px solid #C7CDCB; background: #F9FAF9; }
.mob-np-footer button { flex: 1; border: 1px solid #999; background: #f0f0f0; color: #222; border-radius: 4px; padding: 12px; font: inherit; cursor: pointer; }
.mob-np-footer button:disabled { opacity: 0.5; }
.mob-np-footer button.cancel-btn { color: #b02a2a; }
.mob-np-footer button.ok-btn { color: #1b7d1b; font-weight: 600; }
</style>
