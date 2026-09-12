<script setup lang="ts">
import { computed, ref } from 'vue';
import { useFocusedProject } from '../../logic/focusedProjectContext.js';
import { passiveRadiatorRows } from '../../logic/driverDisplay.js';
import NumInput from './NumInput.vue';
import UnitToggle from './UnitToggle.vue';
import { useApp } from '../../logic/app.js';

const { myPassiveRadiators } = useApp();

// PR "Edit" — a real popup (unlike Tune, this doesn't need the graph
// visible while typing: WinISD ref view_3_passive_radiator.png "Passive radiator
// parameters" box). Fields here describe the PR unit itself, not the box around it.

import { useEscToClose } from '../../logic/useEscToClose.js';
import { fieldHelp } from '../../logic/fields/fieldRegistry.js';
import { inputValue } from '../../logic/domEvents.js';

const emit = defineEmits<{ close: [] }>();
useEscToClose(() => true, close);

const project = useFocusedProject();
// The fields WinISD's own passive-radiator pane asks for — Vas, Fs, Qms, Sd, Xmax
// (docs/winisd_screenshots/view_3_passive_radiator.png) — set straight onto the radiator's
// spec, exactly as the driver editor sets the driver's. They are peers, and the consistency
// solver works out what the rest of the radiator's parameters must be; nothing here converts.
// Display units are NumInput's business, through the field's unit group — this dialog holds
// SI end to end.
const radiator = computed(() => project.value.box.passiveRadiator.radiator);

/** Fs with the tuning mass on the cone — read-only, and the domain's own figure. */
const prFsWithMassShown = computed(() => project.value.box.passiveRadiator.resonanceWithAddedMass_hz.value);

// The list holds ROWS of strings, never radiators: a row's `uuid` is the handle, and the
// radiator is looked up again when one is chosen (A9 — no domain value in view state).
const libRows = () => passiveRadiatorRows(
  myPassiveRadiators.list().map(e => ({ id: e.uuid, radiator: e.passiveRadiator })));
const prLib = ref(libRows());
const showPRLib = ref(false);

function saveCurrentPR() {
  myPassiveRadiators.upsert(radiator.value.detach());
  prLib.value = libRows();
}
/** Adopt a library radiator into the box. The box takes its own copy, so editing it here never
 *  reaches the library entry it came from. */
function loadPR(uuid: string) {
  const entry = myPassiveRadiators.list().find(e => e.uuid === uuid);
  if (!entry) return;
  project.value.box.passiveRadiator.configurePR(entry.passiveRadiator);
  showPRLib.value = false;
}
function removePR(uuid: string) {
  myPassiveRadiators.remove(uuid);
  prLib.value = libRows();
}

function close() { emit('close'); }
</script>

<template>
  <div class="overlay on">
    <div class="modal">
      <h2>Edit passive radiator<button class="x" @click="close" title="Close">✕</button></h2>
      <div class="body">
        <button style="width:100%" @click="showPRLib = !showPRLib"
          title="Browse your saved passive radiators and load one into the current design">
          {{ showPRLib ? 'Hide PR library ▾' : 'Browse PR library… ▸' }}
        </button>
        <div v-if="showPRLib" class="pr-lib" style="margin:6px 0">
          <div v-if="!prLib.length" style="color:var(--mut);font-size:11px;padding:4px 0">No saved PRs yet — fill in the fields below and click Save.</div>
          <div v-for="e in prLib" :key="e.id" class="pr-lib-item">
            <span class="pr-lib-name" @click="loadPR(e.id)"
              :title="`Load ${e.name} — Sd=${e.sd} Mms=${e.mms} Cms=${e.cms}`">{{ e.name }}</span>
            <button class="pr-lib-del" @click="removePR(e.id)" title="Remove this PR from the library">✕</button>
          </div>
        </div>

        <div class="row" title="Name for this passive radiator">
          <label>PR name</label>
          <input style="flex:1" type="text" :value="radiator.model.get().value ?? ''" @input="e => radiator.model.set(inputValue(e))" placeholder="e.g. Dayton SD270A-88">
        </div>
        <div class="row" data-field-key="prNum" :title="fieldHelp('prNum')">
          <label>PR count</label>
          <NumInput :model-value="project.box.passiveRadiator.count.get()" @update:model-value="v => project.box.passiveRadiator.count.set(v ?? 0)" field="prNum" :precision="0" step="1" />
          <span class="u"></span>
        </div>
        <div class="row" data-field-key="prSd" :title="fieldHelp('prSd')">
          <label>Sd</label>
          <NumInput :model-value="radiator.spec.Sd_m2.get().value" @update:model-value="v => radiator.spec.Sd_m2.set(v ?? 0)" field="prSd" group="area" base="cm2" :precision="4" />
          <UnitToggle field="prSd" group="area" base="cm2" unit-class="u" />
        </div>
        <div class="row" data-field-key="prXmax" :title="fieldHelp('prXmax')">
          <label>Xmax</label>
          <NumInput :model-value="radiator.spec.Xmax_m.get().value" @update:model-value="v => radiator.spec.Xmax_m.set(v ?? 0)" field="prXmax" group="length" base="mm" :precision="3" />
          <UnitToggle field="prXmax" group="length" base="mm" unit-class="u" />
        </div>
        <div class="row" data-field-key="prFs" :title="fieldHelp('prFs')">
          <label>Fs</label>
          <NumInput :model-value="radiator.spec.Fs_hz.get().value" field="prFs" :precision="4" @update:model-value="v => radiator.spec.Fs_hz.set(v ?? 0)" />
          <span class="u">Hz</span>
        </div>
        <div class="row" data-field-key="prFsMass" :title="fieldHelp('prFsMass')">
          <label>Fs (with mass)</label>
          <NumInput :model-value="prFsWithMassShown" field="prFsMass" :precision="4" readonly />
          <span class="u">Hz</span>
        </div>
        <div class="row" data-field-key="prQms" :title="fieldHelp('prQms')">
          <label>Qms</label>
          <NumInput :model-value="radiator.spec.Qms.get().value" field="prQms" :precision="3" @update:model-value="v => radiator.spec.Qms.set(v ?? 0)" />
          <span class="u"></span>
        </div>
        <div class="row" data-field-key="prVas" :title="fieldHelp('prVas')">
          <label>Vas</label>
          <NumInput :model-value="radiator.spec.Vas_m3.get().value" @update:model-value="v => radiator.spec.Vas_m3.set(v ?? 0)" field="prVas" group="volume" base="L" :precision="3" />
          <UnitToggle field="prVas" group="volume" base="L" unit-class="u" />
        </div>

        <div class="btns" style="margin-top:8px">
          <button @click="saveCurrentPR" title="Save these PR parameters to your library under the current PR name">Save to PR library</button>
          <button class="pri" @click="close" title="Close">Done</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pri { background: var(--acc); color: #fff; border-color: var(--acc); }
</style>
