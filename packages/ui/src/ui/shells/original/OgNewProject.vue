<script setup lang="ts">
/**
 * New Project wizard — WinISD step order (Driver -> Num/placement -> Box type + EBP -> Sealed alignment -> Metadata).
 * State management delegated to useOgNewProject() hook per ui.md.
 */
import { onBeforeUnmount } from 'vue';
import { useOgNewProject } from '../../../hooks/OgNewProject-hooks.js';
import { useEscToClose } from '../../../logic/useEscToClose.js';
import { useApp } from '../../../logic/app.js';
import BoxTypeDiagram from '../../components/BoxTypeDiagram.vue';
import DriverLibrary from '../../components/DriverLibrary.vue';

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

// Step 1 IS the driver library (FIX_WIZARD_SEALED Q1): "Use" hands the driver to the wizard
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
        <p v-if="hadUnsaved" class="np-warn" title="The open project has unsaved changes.">⚠ The open project has unsaved changes — they are not lost, but the new project takes focus.</p>
        <p class="np-step">Step {{ currentStepNumber }} of {{ totalSteps }} — {{ stepLabel }}</p>

        <!-- The chosen driver, on every step once there is one -->
        <div v-if="selectedDriver" class="selected-driver-banner">
          <span class="banner-label">Selected driver:</span> <strong class="banner-value">{{ selectedDriverName }}</strong>
          <span class="driver-specs-preview"><span v-for="line in selectedDriverSpecs" :key="line">{{ line }}</span></span>
        </div>

        <!-- Step 1: the driver library itself (Q1). A row summarises, Use chooses. -->
        <div v-if="step === 1" class="step-content">
          <DriverLibrary class="np-library" show-name />
        </div>

        <!-- Step 2: Driver count & placement -->
        <div v-else-if="step === 2" class="step-content">
          <div class="field-row">
            <div class="field"><label>Num. of drivers</label>
              <select id="np-ndrivers" :value="nDrivers" @change="e => { const n = selectedOption(e, N_DRIVERS_OPTIONS); if (n !== null) nDrivers = n; }" style="width:180px">
                <option v-for="o in N_DRIVERS_OPTIONS" :key="o.value" :value="o.value">{{ o.label }} driver(s)</option>
              </select>
            </div>
          </div>
          <div class="radio-group field-row">
            <label><input type="radio" name="placement" value="standard" v-model="placement"> Standard</label>
            <label><input type="radio" name="placement" value="iso" v-model="placement" disabled> Iso-Barik <em style="color:#999">(not modelled)</em></label>
          </div>
          <div class="field-row">
            <div class="field"><label>Voice coil connection</label>
              <select id="np-wiring" :value="wiring" @change="e => { const w = selectedOption(e, ARRAY_WIRING_OPTIONS); if (w !== null) wiring = w; }" style="width:180px">
                <option v-for="o in ARRAY_WIRING_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Step 3: Type of design (Box Type + EBP) -->
        <div v-else-if="step === 3" class="step-content">
          <div class="field-row">
            <div class="field"><label>Box type</label>
              <select id="np-box-type" :value="boxType" @change="e => { const b = selectedOption(e, BOX_OPTIONS); if (b !== null) boxType = b; }" style="width:240px">
                <option v-for="o in BOX_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
            </div>
          </div>

          <div class="ebp-readout-card">
            <div class="ebp-row">
              <span class="ebp-label">Efficiency Bandwidth Product (EBP):</span>
              <strong class="ebp-value">{{ ebp !== null ? ebp.toFixed(1) : '--' }}</strong>
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

          <!-- Sealed and vented boxes take their volume from the alignment step; the other types start here. -->
          <div v-if="!isSealed && !isVented" class="volume-fields">
            <template v-if="!isDual">
              <div class="field-row"><div class="field"><label>Starting volume</label><input type="number" step="0.1" v-limits="{ min: 0.1, max: 100000 }" v-model.number="vol"><span class="unit">l</span></div></div>
            </template>
            <template v-else>
              <div class="field-row"><div class="field"><label>Rear chamber volume</label><input type="number" step="0.1" v-limits="{ min: 0.1, max: 100000 }" v-model.number="vol"><span class="unit">l</span></div></div>
              <div class="field-row"><div class="field"><label>Front chamber volume</label><input type="number" step="0.1" v-limits="{ min: 0.1, max: 100000 }" v-model.number="frontVol"><span class="unit">l</span></div></div>
            </template>
          </div>
        </div>

        <!-- Step 4: Sealed Alignment (only when Closed/sealed) -->
        <div v-else-if="step === 4 && isSealed" class="step-content">
          <div class="field-row">
            <div class="field"><label>Alignment</label>
              <select id="np-alignment" :value="targetQtc" @change="e => { const q = selectedOption(e, SEALED_ALIGNMENT_OPTIONS); if (q !== null) selectSealedAlignment(q); }" style="width:260px">
                <option v-for="o in SEALED_ALIGNMENT_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
            </div>
          </div>

          <div class="field-row">
            <div class="field"><label>Box volume</label>
              <input type="number" step="0.1" v-limits="{ min: 0.1, max: 100000 }" v-model.number="sealedVolume_L">
              <span class="unit">l</span>
            </div>
          </div>

          <div class="readout-box">
            <div class="readout-item"><span>Calculated Qtc:</span> <strong>{{ qtc !== null ? qtc.toFixed(3) : '--' }}</strong></div>
            <div class="readout-item"><span>EBP:</span> <strong>{{ ebp !== null ? ebp.toFixed(1) : '--' }}</strong></div>
            <div class="readout-item"><span>Recommendation:</span> <strong>{{ ebpSuitabilityLabel }}</strong></div>
          </div>
        </div>

        <!-- Step 4: Vented Alignment (only when box type is Vented; WinISD's five — docs/research/VENTED_ALIGNMENT_FORMULAS.md) -->
        <div v-else-if="step === 4 && isVented" class="step-content">
          <div class="field-row">
            <div class="field"><label>Alignment</label>
              <select id="np-vented-alignment" :value="selectedVentedAlignment" @change="e => { const a = selectedOption(e, VENTED_ALIGNMENT_OPTIONS); if (a !== null) selectVentedAlignment(a); }" style="width:260px">
                <option v-for="o in VENTED_ALIGNMENT_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
            </div>
          </div>

          <div class="readout-box">
            <div class="readout-item"><span>Box volume:</span> <strong>{{ ventedVolume_L.toFixed(1) }} l</strong></div>
            <!-- The designed value above is WinISD's own and is never changed; these say when it
                 is implausible. Band: Settings → Vented design limits. -->
            <div v-if="ventedVolumeWarning" class="readout-warning" data-testid="np-vented-volume-warning">{{ ventedVolumeWarning }}</div>
            <div class="readout-item"><span>Tuning frequency:</span> <strong>{{ ventedTuning_hz.toFixed(1) }} Hz</strong></div>
            <div v-if="ventedTuningWarning" class="readout-warning" data-testid="np-vented-tuning-warning">{{ ventedTuningWarning }}</div>
            <div class="readout-item"><span>EBP:</span> <strong>{{ ebp !== null ? ebp.toFixed(1) : '--' }}</strong></div>
            <div class="readout-item"><span>Recommendation:</span> <strong>{{ ebpSuitabilityLabel }}</strong></div>
          </div>
        </div>

        <!-- Step 5: Project Information -->
        <div v-else-if="step === 5" class="step-content">
          <div class="field-row">
            <div class="field"><label>Project name</label>
              <input type="text" style="width:280px" placeholder="e.g. Living-room sub" v-model="projName" @keydown.enter="handleCreate">
            </div>
          </div>
          <div class="field-row" style="margin-top:10px; align-items:flex-start;">
            <div class="field" style="align-items:flex-start;"><label style="margin-top:4px;">Description</label>
              <textarea style="width:280px; height:80px; border:1px solid #999; padding:4px 6px; border-radius:2px;" placeholder="Optional description..." v-model="projDescription"></textarea>
            </div>
          </div>
          <p class="hint">Optional label and notes for this design; you can refine them later on the Project tab.</p>
        </div>
      </div>

      <div class="modal-footer">
        <div class="footer-buttons">
          <button v-if="canBack" class="cancel-btn" title="Back to the previous step" @click="back">&lt; Back</button>
          <button v-if="canNext" class="ok-btn" title="Next step" @click="next">Next &gt;</button>
          <button v-if="step === 5" class="ok-btn" :disabled="!canCreate" title="Create project" @click="handleCreate">Create</button>
          <button class="cancel-btn" title="Cancel" @click="handleCancel">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.18); z-index: 100; display: flex; align-items: flex-start; justify-content: center; }
.modal { margin-top: 6vh; background: #f7f7f7; border: 1px solid #888; box-shadow: 3px 6px 18px rgba(0,0,0,.35); width: 800px; max-width: 92vw; }
.modal-titlebar { display: flex; align-items: center; justify-content: space-between; background: #e9e9e9; border-bottom: 1px solid #bbb; padding: 8px 12px; font-size: 15px; }
.modal-titlebar .tb-left { display: flex; align-items: center; gap: 8px; }
.modal-titlebar .app-icon { width: 18px; height: 18px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #888, #333 70%); }
.modal-titlebar .close-btn { cursor: pointer; padding: 1px 6px; color: #555; }
.modal-titlebar .close-btn:hover { background: #e64545; color: #fff; }
.modal-body { padding: 16px 20px; }
.np-step { color: #666; margin-bottom: 10px; font-weight: 500; }
.np-warn { color: #8a4b00; background: #fff3e0; border: 1px solid #f0c088; border-radius: 3px; padding: 6px 10px; margin-bottom: 10px; font-size: 12.5px; }
.step-content { margin-top: 10px; }
.selected-driver-banner { background: #eef4fc; border: 1px solid #b8d4f8; padding: 6px 10px; border-radius: 3px; margin-bottom: 12px; font-size: 13px; color: #224466; display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.driver-specs-preview { display: inline-flex; gap: 12px; font-size: 12px; color: #556; margin-left: auto; }
/* The library sets its own height here: the overlay gives it a 535px window, the wizard has no window to fill. */
.np-library { height: 420px; }
.field-row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
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
.footer-buttons button.ok-btn { color: #1b7d1b; }
.action-btn { border: 1px solid #999; background: #f5f5f5; border-radius: 3px; padding: 4px 10px; cursor: pointer; font-size: 12.5px; }
.action-btn:hover { background: #e8e8e8; }
</style>
