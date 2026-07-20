<script setup lang="ts">
/**
 * Original-skin New Project wizard — the mock's 2-step #modal-new-project (box type →
 * starting volume), wired to the shared store. On Create it applies the box type + volume
 * and hands off to the shared driver picker (state.browseOpen) to choose the driver.
 *
 * A per-skin presentation under shells/original/. Honesty note: only the four
 * engine-modelled box types are offered — you can't "create" a design the engine can't
 * simulate (6th-order bandpass / ABC are pending everywhere), same rule as elsewhere.
 */
import { ref, computed } from 'vue';
import { state } from '../../store.js';
import type { BoxType } from '@openisd/engine';

const emit = defineEmits<{ close: [] }>();

const BOX_OPTIONS: { id: BoxType; label: string }[] = [
  { id: 'sealed',    label: 'Closed' },
  { id: 'vented',    label: 'Vented' },
  { id: 'pr',        label: 'Passive Radiator' },
  { id: 'bandpass4', label: '4th Order Bandpass' },
];

const step = ref(1);
const boxType = ref<BoxType>('sealed');
const vol = ref(6);        // single-chamber / rear volume, litres
const frontVol = ref(10);  // front chamber (bandpass), litres
const isDual = computed(() => boxType.value === 'bandpass4');

function next() { if (step.value === 1) step.value = 2; }
function back() { if (step.value === 2) step.value = 1; }

function create() {
  state.box = boxType.value;
  state.P.Vb = vol.value / 1000;                 // L → m³
  if (isDual.value) state.P.Vf = frontVol.value / 1000;
  emit('close');
  state.browseOpen = true;                        // hand off to the driver picker
}
</script>

<template>
  <div class="overlay open" @click.self="emit('close')">
    <div class="modal">
      <div class="modal-titlebar">
        <div class="tb-left"><span class="app-icon"></span><span>New Project</span></div>
        <div class="win-controls"><span class="close-btn" role="button" tabindex="0" title="Cancel" @click="emit('close')" @keydown.enter="emit('close')">✕</span></div>
      </div>

      <div class="modal-body">
        <p class="np-step">Step {{ step }} of 2 — {{ step === 1 ? 'Box type' : 'Starting volume' }}</p>

        <div v-if="step === 1">
          <div class="field-row">
            <div class="field"><label>Box type</label>
              <select v-model="boxType" style="width:240px">
                <option v-for="o in BOX_OPTIONS" :key="o.id" :value="o.id">{{ o.label }}</option>
              </select>
            </div>
          </div>
          <p class="hint">Change the box type any time once the project is open.</p>
        </div>

        <div v-else>
          <template v-if="!isDual">
            <div class="field-row"><div class="field"><label>Volume</label><input type="number" min="0" step="0.1" v-model.number="vol"><span class="unit">l</span></div></div>
          </template>
          <template v-else>
            <div class="field-row"><div class="field"><label>Rear chamber volume</label><input type="number" min="0" step="0.1" v-model.number="vol"><span class="unit">l</span></div></div>
            <div class="field-row"><div class="field"><label>Front chamber volume</label><input type="number" min="0" step="0.1" v-model.number="frontVol"><span class="unit">l</span></div></div>
          </template>
          <p class="hint">Starting volume — refine later once you've picked a driver.</p>
        </div>
      </div>

      <div class="modal-footer">
        <div class="footer-buttons">
          <button v-if="step === 2" class="cancel-btn" title="Back to box type" @click="back">&lt; Back</button>
          <button v-if="step === 1" class="ok-btn" title="Next — choose the starting volume" @click="next">Next &gt;</button>
          <button v-else class="ok-btn" title="Create the design and pick a driver" @click="create">Create</button>
          <button class="cancel-btn" title="Cancel — discard, keep the current design" @click="emit('close')">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Ported from mock/style.css (.overlay/.modal/.modal-*). */
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.18); z-index: 100; display: flex; align-items: flex-start; justify-content: center; }
.modal { margin-top: 8vh; background: #f7f7f7; border: 1px solid #888; box-shadow: 3px 6px 18px rgba(0,0,0,.35); width: 620px; max-width: 92vw; }
.modal-titlebar { display: flex; align-items: center; justify-content: space-between; background: #e9e9e9; border-bottom: 1px solid #bbb; padding: 8px 12px; font-size: 15px; }
.modal-titlebar .tb-left { display: flex; align-items: center; gap: 8px; }
.modal-titlebar .app-icon { width: 18px; height: 18px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #888, #333 70%); }
.modal-titlebar .close-btn { cursor: pointer; padding: 1px 6px; color: #555; }
.modal-titlebar .close-btn:hover { background: #e64545; color: #fff; }
.modal-body { padding: 16px 20px; }
.np-step { color: #666; margin-bottom: 10px; }
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
