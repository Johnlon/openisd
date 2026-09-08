<script setup lang="ts">
/**
 * New Project wizard — name → box type → starting volume → driver. The wizard owns every
 * choice in its own component state; nothing is written to the store until the driver picker's
 * "Use" fires, at which point `newProject(spec, driver)` builds the one project in a single
 * call. There is no "empty project" — the app has no project at all until this completes.
 *
 * Only the four engine-modelled box types are offered — you can't create a design the engine
 * can't simulate.
 */
import { ref, computed } from 'vue';
import { isModified, newProject } from '../../../logic/appState.js';
import { fromDisplay } from '../../../logic/fields/units.js';
import { useApp } from '../../../logic/app.js';
import type { BoxType } from '@openisd/design/engine';
import { useEscToClose } from '../../../logic/useEscToClose.js';

const emit = defineEmits<{ close: [] }>();
useEscToClose(() => true, () => emit('close'));

const { driverBrowsing } = useApp();

const BOX_OPTIONS: { id: BoxType; label: string }[] = [
  { id: 'sealed',    label: 'Closed' },
  { id: 'vented',    label: 'Vented' },
  { id: 'box-passive-radiator', label: 'Passive Radiator' },
  { id: 'bandpass4', label: '4th Order Bandpass' },
];

const step = ref(1);
const STEP_LABELS = ['Project name', 'Box type', 'Starting volume'];
const projName = ref('');
const boxType = ref<BoxType>('sealed');
const vol = ref(6);        // single-chamber volume, litres
const frontVol = ref(10);  // bandpass front chamber, litres
const isDual = computed(() => boxType.value === 'bandpass4');

function next() { if (step.value < 3) step.value++; }
function back() { if (step.value > 1) step.value--; }

/** Warn (data-loss guard) if a project is open with unsaved changes — a new one takes focus. */
const hadUnsaved = computed(() => isModified.value);

/**
 * The last step: open the driver picker, and on "Use" create the project and write every choice
 * into it.
 *
 * The project is created HERE rather than when the wizard opens, so Cancel at any earlier step
 * leaves the registry untouched — there is no half-made project to clean up. `newProject()` hands
 * back a project with every section already present (QO125), so each step below is an ordinary
 * write to a live project rather than a field in a spec object that has to be carried around.
 */
function pickDriver() {
  const name = projName.value.trim();
  const box = boxType.value;
  const volume_m3 = fromDisplay(vol.value, 'volume', 'L');
  const frontVolume_m3 = fromDisplay(frontVol.value, 'volume', 'L');
  emit('close');
  driverBrowsing.openPickerFor((driver) => {
    const p = newProject();
    p.setDriver(driver);
    p.name.set(name);
    p.box.boxType.set(box);
    // Each box type owns its own volume, so the wizard's number goes to the one it chose.
    switch (box) {
      case 'sealed': p.box.sealed.volume_m3.set(volume_m3); break;
      case 'vented': p.box.vented.volume_m3.set(volume_m3); break;
      case 'box-passive-radiator': p.box.passiveRadiator.volume_m3.set(volume_m3); break;
      case 'bandpass4':
        p.box.bandpass4.chambers.rear.volume_m3.set(volume_m3);
        p.box.bandpass4.chambers.front.volume_m3.set(frontVolume_m3);
        break;
    }
  });
}
</script>

<template>
  <div class="overlay open">
    <div class="modal">
      <div class="modal-titlebar">
        <div class="tb-left"><span class="app-icon"></span><span>New Project</span></div>
        <div class="win-controls"><span class="close-btn" role="button" tabindex="0" title="Cancel" @click="emit('close')" @keydown.enter="emit('close')">✕</span></div>
      </div>

      <div class="modal-body">
        <p v-if="hadUnsaved" class="np-warn" title="The open project has unsaved changes.">⚠ The open project has unsaved changes — they are not lost, but the new project takes focus.</p>
        <p class="np-step">Step {{ step }} of 3 — {{ STEP_LABELS[step - 1] }}</p>

        <div v-if="step === 1">
          <div class="field-row">
            <div class="field"><label>Project name</label>
              <input type="text" style="width:240px" placeholder="e.g. Living-room sub" v-model="projName" @keydown.enter="next">
            </div>
          </div>
          <p class="hint">Optional — a label for this design; you can change it later on the Project tab.</p>
        </div>

        <div v-else-if="step === 2">
          <div class="field-row">
            <div class="field"><label>Box type</label>
              <select v-model="boxType" style="width:240px">
                <option v-for="o in BOX_OPTIONS" :key="o.id" :value="o.id">{{ o.label }}</option>
              </select>
            </div>
          </div>
          <p class="hint">Optional — starts at Closed; change the box type any time once the project is open.</p>
        </div>

        <div v-else-if="step === 3">
          <template v-if="!isDual">
            <div class="field-row"><div class="field"><label>Volume</label><input type="number" step="0.1" v-limits="{ min: 0.1, max: 100000 }" v-model.number="vol"><span class="unit">l</span></div></div>
          </template>
          <template v-else>
            <div class="field-row"><div class="field"><label>Rear chamber volume</label><input type="number" step="0.1" v-limits="{ min: 0.1, max: 100000 }" v-model.number="vol"><span class="unit">l</span></div></div>
            <div class="field-row"><div class="field"><label>Front chamber volume</label><input type="number" step="0.1" v-limits="{ min: 0.1, max: 100000 }" v-model.number="frontVol"><span class="unit">l</span></div></div>
          </template>
          <p class="hint">Optional — starting volume, refine later once you've picked a driver.</p>
        </div>
      </div>

      <div class="modal-footer">
        <div class="footer-buttons">
          <button v-if="step > 1" class="cancel-btn" title="Back to the previous step" @click="back">&lt; Back</button>
          <button v-if="step < 3" class="ok-btn" title="Next step" @click="next">Next &gt;</button>
          <button v-else class="ok-btn" title="Choose the driver for this project" @click="pickDriver">Pick Driver &gt;</button>
          <button class="cancel-btn" title="Cancel" @click="emit('close')">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.18); z-index: 100; display: flex; align-items: flex-start; justify-content: center; }
.modal { margin-top: 8vh; background: #f7f7f7; border: 1px solid #888; box-shadow: 3px 6px 18px rgba(0,0,0,.35); width: 620px; max-width: 92vw; }
.modal-titlebar { display: flex; align-items: center; justify-content: space-between; background: #e9e9e9; border-bottom: 1px solid #bbb; padding: 8px 12px; font-size: 15px; }
.modal-titlebar .tb-left { display: flex; align-items: center; gap: 8px; }
.modal-titlebar .app-icon { width: 18px; height: 18px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #888, #333 70%); }
.modal-titlebar .close-btn { cursor: pointer; padding: 1px 6px; color: #555; }
.modal-titlebar .close-btn:hover { background: #e64545; color: #fff; }
.modal-body { padding: 16px 20px; }
.np-step { color: #666; margin-bottom: 10px; }
.np-warn { color: #8a4b00; background: #fff3e0; border: 1px solid #f0c088; border-radius: 3px; padding: 6px 10px; margin-bottom: 10px; font-size: 12.5px; }
.field-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.field { display: flex; align-items: center; gap: 6px; }
.field label { color: #333; display: inline-block; min-width: 150px; }
.field input, .field select { border: 1px solid #999; padding: 4px 6px; border-radius: 2px; background: #fff; }
.field input { width: 120px; }
.field .unit { color: #555; }
.hint { color: #888; font-size: 12px; font-style: italic; margin-top: 8px; }
.modal-footer { display: flex; align-items: center; justify-content: flex-end; border-top: 1px solid #ccc; padding: 10px 20px; background: #eee; }
.footer-buttons { display: flex; gap: 8px; }
.footer-buttons button { border: 1px solid #999; background: #f0f0f0; color: #222; border-radius: 3px; padding: 6px 14px; cursor: pointer; }
.footer-buttons button:hover { background: #dbeaff; border-color: #7fb3ff; }
.footer-buttons button.cancel-btn { color: #b02a2a; }
.footer-buttons button.ok-btn { color: #1b7d1b; }
</style>
