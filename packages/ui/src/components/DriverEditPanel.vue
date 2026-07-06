<script setup lang="ts">
import { watch } from 'vue';
import { state, driverRaw, enterDriverField, setDriverFromRaw } from '../store.js';
import type { DriverRaw } from '@openisd/engine';

// Driver EDIT pane — identity/metadata fields (Brand, Model, Comment, Provided by).
// Distinct from DriverWhatIfPanel (T/S parameter tweaking): this is "what the driver
// IS", not "what if I change its specs". Same in-memory-only, project-scoped rule
// applies — nothing here ever writes to the shared driver library.

let sessionSnapshot: DriverRaw = { ...driverRaw.value };
watch(() => state.editDriverInfo, (open) => { if (open) sessionSnapshot = { ...driverRaw.value }; }, { immediate: true });

function set(field: 'brand' | 'model' | 'comment' | 'providedBy', e: Event) {
  enterDriverField(field, (e.target as HTMLInputElement).value);
}

function resetToCommon() {
  if (state.driverSource) setDriverFromRaw(state.driverSource);
}
function cancelEdit() {
  setDriverFromRaw(sessionSnapshot);
  state.editDriverInfo = false;
}
function done() {
  state.editDriverInfo = false;
}
</script>

<template>
  <div class="dep">
    <div class="whatif-hint">
      Editing this project's driver record — Brand/Model/notes shown here and in exports.
      The shared driver library is never modified.
    </div>
    <div class="row"><label>Brand</label>
      <input type="text" :value="driverRaw.brand || ''" @input="set('brand', $event)" title="Manufacturer/brand name">
    </div>
    <div class="row"><label>Model</label>
      <input type="text" :value="driverRaw.model || ''" @input="set('model', $event)" title="Model number/name">
    </div>
    <div class="row"><label>Provided by</label>
      <input type="text" :value="driverRaw.providedBy || ''" @input="set('providedBy', $event)" title="Attribution — who supplied this driver's data">
    </div>
    <div class="row"><label>Comment</label>
      <input type="text" :value="driverRaw.comment || ''" @input="set('comment', $event)" title="Free-text note saved with this driver">
    </div>

    <div class="btns">
      <button :disabled="!state.driverSource" @click="resetToCommon"
              :title="state.driverSource ? 'Reset these fields back to the common library model' : 'No library model to reset to'">Reset</button>
      <button @click="cancelEdit" title="Discard edits made in this session and close">Cancel</button>
      <button class="pri" @click="done" title="Keep these edits in the current project and close">Done</button>
    </div>
  </div>
</template>

<style scoped>
.dep { display: flex; flex-direction: column; height: 100%; overflow-y: auto; padding-right: 4px; }
.dep .btns { margin-top: 8px; display: flex; gap: 6px; flex-wrap: wrap; }
.dep .btns .pri { background: var(--acc); color: #fff; border-color: var(--acc); }
</style>
