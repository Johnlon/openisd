<script setup lang="ts">
import { ref, computed } from 'vue';
import { useFocusedProject } from '../../logic/focusedProjectContext.js';
import { useEscToClose } from '../../logic/useEscToClose.js';
import { fieldHelp } from '../../logic/fields/fieldRegistry.js';
import NumInput from './NumInput.vue';
import UnitToggle from './UnitToggle.vue';

const project = useFocusedProject();

/** Field help from the ONE registry, plus this FORM's own requirement note. The requirement is
 *  a property of the create-a-PR form, not of the field — a PR already in a design has nothing
 *  "required" about it — so it is appended here rather than written into the registry. */
function help(id: string, requirement: string): string {
  return `${fieldHelp(id)} ${requirement}`.trim();
}

// Define a brand-new passive radiator — a BLANK, buffered form (mirrors
// DriverDefineModal: empty string inputs, writes to the live design ONLY on Create,
// so an unfinished entry never corrupts the project). WinISD-style inputs (Sd, Fs, Qms,
// Vas) — the same fields PREditModal exposes — converted to the canonical Sd/Mmd/
// Cms/Rms on Create using the identical formulas PRPanel.setWinIsd* use.

const emit = defineEmits<{ close: [] }>();
useEscToClose(() => true, () => emit('close'));

// Blank buffers — the form comes up empty and writes to the live design only on Create, so an
// unfinished entry never reaches the project. Every numeric buffer holds SI, because that is
// what NumInput's model is: the display unit is the field's own (cm², mm, L) and the
// conversion happens inside the component, from the unit registry. Null IS the blank state —
// NumInput renders null as an empty field and emits null when one is cleared.
const nName = ref('');
const nNum  = ref<number | null>(null);
const nSd   = ref<number | null>(null);   // m²
const nXmax = ref<number | null>(null);   // m
const nFs   = ref<number | null>(null);   // Hz
const nQms  = ref<number | null>(null);
const nVas  = ref<number | null>(null);   // m³

function stated(v: number | null): boolean { return v != null && isFinite(v) && v > 0; }
// Required to define a resonant PR: Sd, Fs, Qms, Vas (Xmax/count/name optional).
const canCreate = computed(() =>
  stated(nSd.value) && stated(nFs.value) && stated(nQms.value) && stated(nVas.value));

function create() {
  if (!canCreate.value) return;
  project.value.setPrName(nName.value.trim() || 'New PR');
  project.value.setPrCount(stated(nNum.value) ? nNum.value! : 1);
  // The datasheet → canonical conversion lives on the domain object, which takes SI throughout —
  // so this form hands its buffers over untouched and converts nothing.
  project.value.enterPrDatasheet({
    sdM2: nSd.value!,
    xmaxM: stated(nXmax.value) ? nXmax.value! : 0,
    fsHz: nFs.value!,
    qms: nQms.value!,
    vasM3: nVas.value!,
  });
  project.value.setPrAddedMass_kg(0);
  emit('close');
}

function close() { emit('close'); }
</script>

<template>
  <div class="overlay on">
    <div class="modal">
      <h2>Define new passive radiator<button class="x" @click="close" title="Close">✕</button></h2>
      <div class="body">
        <div class="row" title="Name for this passive radiator">
          <label>PR name</label>
          <input style="flex:1" type="text" v-model="nName" placeholder="e.g. Dayton SD270A-88">
        </div>
        <div class="row" data-field-key="prNum" :title="help('prNum', 'Blank means 1.')">
          <label>PR count</label>
          <NumInput style="flex:1" v-model="nNum" field="prNum" :precision="0" step="1" :min="1" :max="16" />
          <span class="u"></span>
        </div>
        <div class="row" data-field-key="prSd" :title="help('prSd', 'Required.')">
          <label>Sd</label>
          <NumInput style="flex:1" v-model="nSd" field="prSd" group="area" base="cm2" :precision="4" />
          <UnitToggle field="prSd" group="area" base="cm2" unit-class="u" />
        </div>
        <div class="row" data-field-key="prXmax" :title="help('prXmax', 'Optional.')">
          <label>Xmax</label>
          <NumInput style="flex:1" v-model="nXmax" field="prXmax" group="length" base="mm" :precision="3" />
          <UnitToggle field="prXmax" group="length" base="mm" unit-class="u" />
        </div>
        <div class="row" data-field-key="prFs" :title="help('prFs', 'Required.')">
          <label>Fs</label>
          <NumInput style="flex:1" v-model="nFs" field="prFs" :precision="4" />
          <span class="u">Hz</span>
        </div>
        <div class="row" data-field-key="prQms" :title="help('prQms', 'Required.')">
          <label>Qms</label>
          <NumInput style="flex:1" v-model="nQms" field="prQms" :precision="3" />
          <span class="u"></span>
        </div>
        <div class="row" data-field-key="prVas" :title="help('prVas', 'Required.')">
          <label>Vas</label>
          <NumInput style="flex:1" v-model="nVas" field="prVas" group="volume" base="L" :precision="3" />
          <UnitToggle field="prVas" group="volume" base="L" unit-class="u" />
        </div>

        <div class="btns" style="margin-top:8px">
          <button class="pri" :disabled="!canCreate" @click="create"
            title="Create this passive radiator and load it into the current design">Create</button>
          <button @click="close" title="Discard">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Narrow — these are short numeric fields, not a full-width form. */
.modal { width: min(320px, 92vw); }
/* No spinners on Define-New panels — they are not live-connected to the graphs
   (UX rule). Values are typed and applied on Create. Mirrors DriverDefineModal .dd-val. */
input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
input[type="number"] { -moz-appearance: textfield; appearance: textfield; }
.pri { background: var(--acc); color:#fff; border-color: var(--acc); }
.pri:disabled { opacity:.5; cursor:not-allowed; }
</style>
