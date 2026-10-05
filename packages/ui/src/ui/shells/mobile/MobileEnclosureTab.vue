<script setup lang="ts">
// The mobile Enclosure tab — vent (port) fields for vented/bandpass4, passive-radiator fields for
// box-passive-radiator, and the bandpass6/abc placeholder. Thin: all state and domain reads/writes
// live in useMobileEnclosureTab() (src/hooks/MobileEnclosureTab-hooks.ts), which calls the SAME
// field-wiring factories OriginalShell-hooks.ts exports. PRBrowser is the app's
// existing global-style overlay, reused unchanged (not duplicated per skin) — position:fixed
// descendants of .app-root-mobile are already contained to the phone pane (App.vue's own fix).
import {NumberField, TextField} from '@openisd/design/fields';
import {inputValue, selectedOption} from '../../../logic/domEvents.js';
import NumInput from '../../components/NumInput.vue';
import NumReadout from '../../components/NumReadout.vue';
import UnitToggle from '../../components/UnitToggle.vue';
import PRBrowser from '../../components/PRBrowser.vue';
import {useMobileEnclosureTab} from '../../../hooks/MobileEnclosureTab-hooks.js';
import {useUnitReadouts} from '../../../hooks/useUnitReadouts.js';

const {
  project, selectedBox,
  activeVent, activeTuning, portPipeResonance_hz, fbState, ventLState, fbUnreachable, fbUnreachableMsg, frontChamberTuningLabel,
  prAddedMassDq, prTuningDq, prResonanceMassDq, prFsMass_hz,
  prBrowseOpen, loadPREntry, loadBundledPassiveRadiatorEntry, defineNewPREntry, saveToLibrary,
  setVentWidth, setVentHeight, setVentDiameter, setVentLength, setFbTarget,
  VENT_SHAPE_OPTIONS, END_CORRECTION_OPTIONS, VENT_COUNT_OPTIONS, PR_COUNT_OPTIONS,
  FB_TARGET_TIP, VENT_GEOMETRY_TIP,
} = useMobileEnclosureTab();
const {fieldWithUnit} = useUnitReadouts();
</script>

<template>
  <div v-if="selectedBox === 'vented' || selectedBox === 'bandpass4'" class="mob-panel">
    <div class="mob-panel-head">Vents</div>

    <div class="mob-row">
      <label class="mob-row-label">Number of Vents</label>
      <select class="mob-select" :value="activeVent.count.value"
              @change="e => { const n = selectedOption(e, VENT_COUNT_OPTIONS); if (n !== null) activeVent.count.set(n); }">
        <option v-for="o in VENT_COUNT_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </div>
    <div class="mob-row">
      <label class="mob-row-label">Shape</label>
      <select class="mob-select" :value="activeVent.shape.value"
              @change="e => { const shape = selectedOption(e, VENT_SHAPE_OPTIONS); if (shape !== null) activeVent.shape.set(shape); }">
        <option v-for="o in VENT_SHAPE_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </div>
    <div class="mob-row">
      <label class="mob-row-label">End Correction</label>
      <select class="mob-select" :value="activeVent.endCorrection_m.value"
              @change="e => { const k = selectedOption(e, END_CORRECTION_OPTIONS); if (k !== null) activeVent.endCorrection_m.set(k); }">
        <option v-for="o in END_CORRECTION_OPTIONS" :key="o.value" :value="o.value">{{ o.label }} ({{ o.value }})</option>
      </select>
    </div>

    <template v-if="activeVent.shape.value === 'slotted'">
      <div class="mob-field-row mob-field-entered">
        <div class="mob-field-main">
          <span class="mob-field-label">Slot width</span>
          <span class="mob-field-value" :title="VENT_GEOMETRY_TIP">
            <NumInput :model-value="activeVent.width_m.value" @update:model-value="setVentWidth"
                      :field="NumberField.VENT_W_CM" :precision="NumberField.VENT_W_CM.precision" stepper />
          </span>
        </div>
        <UnitToggle :field="NumberField.VENT_W_CM" unit-class="mob-unit" />
      </div>
      <div class="mob-field-row mob-field-entered">
        <div class="mob-field-main">
          <span class="mob-field-label">Slot height</span>
          <span class="mob-field-value" :title="VENT_GEOMETRY_TIP">
            <NumInput :model-value="activeVent.height_m.value" @update:model-value="setVentHeight"
                      :field="NumberField.VENT_H_CM" :precision="NumberField.VENT_H_CM.precision" stepper />
          </span>
        </div>
        <UnitToggle :field="NumberField.VENT_H_CM" unit-class="mob-unit" />
      </div>
    </template>
    <div v-else class="mob-field-row mob-field-entered">
      <div class="mob-field-main">
        <span class="mob-field-label">Vent diameter</span>
        <span class="mob-field-value" :title="VENT_GEOMETRY_TIP">
          <NumInput :model-value="activeVent.diameter_m.value" @update:model-value="setVentDiameter"
                    :field="NumberField.VENT_D_CM" :precision="NumberField.VENT_D_CM.precision" stepper />
        </span>
      </div>
      <UnitToggle :field="NumberField.VENT_D_CM" unit-class="mob-unit" />
    </div>

    <!-- `ventLState === 'N'` means two different things: Fb entered but the solver found no
         valid length (impossible — stays readonly, the `fbState === 'E'` guard below), or
         NOTHING entered on either side (truly blank — must stay editable so the user has a way
         back in, QO139). -->
    <div class="mob-field-row" :class="(ventLState !== 'C' && fbState !== 'E') ? 'mob-field-entered' : 'mob-field-calculated'">
      <div class="mob-field-main">
        <span class="mob-field-label">Vent length</span>
        <span v-if="ventLState !== 'C' && fbState !== 'E'" class="mob-field-value">
          <NumInput :model-value="activeVent.length_m.value"
                    @update:model-value="setVentLength"
                    :field="NumberField.VENT_L_CM" :precision="NumberField.VENT_L_CM.precision" stepper />
        </span>
        <span v-else class="mob-field-value mob-readonly" :class="{ 'mob-impossible': activeVent.length_m.value === null }">
          <NumReadout :value="activeVent.length_m.value" :field="NumberField.VENT_L_CM" :precision="NumberField.VENT_L_CM.precision" />
        </span>
      </div>
      <UnitToggle :field="NumberField.VENT_L_CM" unit-class="mob-unit" />
    </div>

    <div class="mob-field-row" :class="fbState !== 'C' ? 'mob-field-entered' : 'mob-field-calculated'">
      <div class="mob-field-main">
        <span class="mob-field-label">{{ frontChamberTuningLabel }}</span>
        <span v-if="fbState !== 'C'" class="mob-field-value" :title="FB_TARGET_TIP">
          <NumInput :model-value="activeTuning.value"
                    @update:model-value="setFbTarget"
                    :field="NumberField.BOX_FB_HZ" :precision="NumberField.BOX_FB_HZ.precision" stepper />
        </span>
        <span v-else class="mob-field-value mob-readonly" :title="FB_TARGET_TIP">
          <NumReadout :value="activeTuning.value" :field="NumberField.BOX_FB_HZ" :precision="NumberField.BOX_FB_HZ.precision" />
        </span>
      </div>
      <UnitToggle :field="NumberField.BOX_FB_HZ" unit-class="mob-unit" />
    </div>

    <div class="mob-field-row mob-field-calculated">
      <div class="mob-field-main">
        <span class="mob-field-label">Cross area</span>
        <span class="mob-field-value mob-readonly"><NumReadout :value="activeVent.area_m2.value" :field="NumberField.VENT_CROSSAREA_M2" :precision="NumberField.VENT_CROSSAREA_M2.precision" /></span>
      </div>
      <UnitToggle :field="NumberField.VENT_CROSSAREA_M2" unit-class="mob-unit" />
    </div>
    <div class="mob-field-row mob-field-calculated">
      <div class="mob-field-main">
        <span class="mob-field-label">1st port resonance</span>
        <span class="mob-field-value mob-readonly"><NumReadout :value="portPipeResonance_hz" :field="NumberField.VENT_1STPORTRESONANCE_HZ" :precision="NumberField.VENT_1STPORTRESONANCE_HZ.precision" /></span>
      </div>
      <UnitToggle :field="NumberField.VENT_1STPORTRESONANCE_HZ" unit-class="mob-unit" />
    </div>
    <div class="mob-field-row mob-field-entered">
      <div class="mob-field-main">
        <span class="mob-field-label">Port velocity limit</span>
        <span class="mob-field-value" :title="NumberField.VENT_PORTVELOCITYLIMIT_M_PER_S.description">
          <NumInput id="mob-vent-velocity-limit" :model-value="project.portVelocityLimit_m_per_s.value"
                    @update:model-value="(v: number | null) => { if (v != null) project.portVelocityLimit_m_per_s.set(v); }"
                    :field="NumberField.VENT_PORTVELOCITYLIMIT_M_PER_S" :precision="NumberField.VENT_PORTVELOCITYLIMIT_M_PER_S.precision" stepper />
        </span>
      </div>
      <UnitToggle :field="NumberField.VENT_PORTVELOCITYLIMIT_M_PER_S" unit-class="mob-unit" />
    </div>
    <p v-if="fbUnreachable" class="mob-hint mob-hint-warn">{{ fbUnreachableMsg }}</p>
  </div>

  <div v-else-if="selectedBox === 'box-passive-radiator'" class="mob-panel">
    <div class="mob-panel-head">Passive radiator</div>
    <div class="mob-row">
      <div class="mob-pr-id">
        <label class="mob-pr-label" for="mob-pr-name">{{ TextField.PR_NAME.label }}</label>
        <input id="mob-pr-name" class="mob-pr-name" type="text" :title="TextField.PR_NAME.description" :value="project.box.passiveRadiator.radiator.model.value" @input="e => project.box.passiveRadiator.radiator.model.set(inputValue(e))">
      </div>
    </div>
    <div class="mob-row mob-pr-actions">
      <button class="mob-btn" @click="prBrowseOpen = true">Select passive radiator</button>
      <button class="mob-btn mob-btn-secondary" title="Save these passive radiator parameters to your library under the current passive radiator name" @click="saveToLibrary">Save to library</button>
    </div>
    <PRBrowser v-if="prBrowseOpen" @close="prBrowseOpen = false"
      @load="loadPREntry" @load-bundled="loadBundledPassiveRadiatorEntry" @define="defineNewPREntry" />

    <div class="mob-field-row mob-field-entered">
      <div class="mob-field-main"><span class="mob-field-label">Vas</span>
        <span class="mob-field-value"><NumInput :model-value="project.box.passiveRadiator.radiator.spec.Vas_m3.value" @update:model-value="(v: number | null) => project.box.passiveRadiator.radiator.spec.Vas_m3.set(v ?? 0)" :field="NumberField.PR_VAS_L" :precision="NumberField.PR_VAS_L.precision" stepper /></span>
      </div>
      <UnitToggle :field="NumberField.PR_VAS_L" unit-class="mob-unit" />
    </div>
    <div class="mob-field-row mob-field-entered">
      <div class="mob-field-main"><span class="mob-field-label">Qms</span>
        <span class="mob-field-value"><NumInput :model-value="project.box.passiveRadiator.radiator.spec.Qms.value" @update:model-value="(v: number | null) => project.box.passiveRadiator.radiator.spec.Qms.set(v ?? 0)" :field="NumberField.PR_QMS" :precision="NumberField.PR_QMS.precision" stepper /></span>
      </div>
      <!-- An empty unit column, so this row's ▲▼ line up with the rows that have a unit. -->
      <span class="mob-unit" aria-hidden="true"></span>
    </div>
    <div class="mob-field-row mob-field-entered">
      <div class="mob-field-main"><span class="mob-field-label">Fpr</span>
        <span class="mob-field-value"><NumInput :model-value="project.box.passiveRadiator.radiator.spec.Fs_hz.value" @update:model-value="(v: number | null) => project.box.passiveRadiator.radiator.spec.Fs_hz.set(v ?? 0)" :field="NumberField.PR_FS_HZ" :precision="NumberField.PR_FS_HZ.precision" stepper /></span>
      </div>
      <UnitToggle :field="NumberField.PR_FS_HZ" unit-class="mob-unit" />
    </div>
    <div class="mob-field-row mob-field-entered">
      <div class="mob-field-main"><span class="mob-field-label">Sd</span>
        <span class="mob-field-value"><NumInput :model-value="project.box.passiveRadiator.radiator.spec.Sd_m2.value" @update:model-value="(v: number | null) => project.box.passiveRadiator.radiator.spec.Sd_m2.set(v ?? 0)" :field="NumberField.PR_SD_CM2" :precision="NumberField.PR_SD_CM2.precision" stepper /></span>
      </div>
      <UnitToggle :field="NumberField.PR_SD_CM2" unit-class="mob-unit" />
    </div>
    <div class="mob-field-row mob-field-entered">
      <div class="mob-field-main"><span class="mob-field-label">Xmax</span>
        <span class="mob-field-value"><NumInput :model-value="project.box.passiveRadiator.radiator.spec.Xmax_m.value" @update:model-value="(v: number | null) => project.box.passiveRadiator.radiator.spec.Xmax_m.set(v ?? 0)" :field="NumberField.PR_XMAX_MM" :precision="NumberField.PR_XMAX_MM.precision" stepper /></span>
      </div>
      <UnitToggle :field="NumberField.PR_XMAX_MM" unit-class="mob-unit" />
    </div>

    <div class="mob-panel-head mob-panel-head-sub">User options</div>
    <div class="mob-field-row mob-field-entered">
      <div class="mob-field-main"><span class="mob-field-label">Number of passive radiators</span>
        <span class="mob-field-value"><select id="mob-pr-count" class="mob-select" :value="project.box.passiveRadiator.count.value" @change="e => { const n = selectedOption(e, PR_COUNT_OPTIONS); if (n !== null) project.box.passiveRadiator.count.set(n); }"><option v-for="o in PR_COUNT_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option></select></span>
      </div>
    </div>
    <div class="mob-field-row mob-field-entered" :class="{ 'mob-field-dq': prTuningDq.dq.length > 0 }">
      <div class="mob-field-main"><span class="mob-field-label">Target tuning freq (Fh)</span>
        <span class="mob-field-value"><NumInput :model-value="project.box.passiveRadiator.tuning_goal_hz.value" @update:model-value="(v: number | null) => project.box.passiveRadiator.tuning_goal_hz.set(v ?? 0)" :field="NumberField.PR_FP_HZ" :precision="NumberField.PR_FP_HZ.precision" v-bind="prTuningDq" stepper /></span>
      </div>
      <UnitToggle :field="NumberField.PR_FP_HZ" unit-class="mob-unit" />
    </div>
    <div class="mob-field-row mob-field-entered" :class="{ 'mob-field-dq': prAddedMassDq.dq.length > 0 }">
      <div class="mob-field-main"><span class="mob-field-label">Added mass to cone</span>
        <span class="mob-field-value"><NumInput :model-value="project.box.passiveRadiator.addedMass_kg.value" @update:model-value="(v: number | null) => project.box.passiveRadiator.addedMass_kg.set(v ?? 0)" :field="NumberField.PR_MADD_G" :precision="NumberField.PR_MADD_G.precision" v-bind="prAddedMassDq" stepper /></span>
      </div>
      <UnitToggle :field="NumberField.PR_MADD_G" unit-class="mob-unit" />
    </div>
    <div class="mob-field-row mob-field-calculated" :class="{ 'mob-field-dq': prResonanceMassDq.dq.length > 0 }" :title="prResonanceMassDq.dq.length > 0 ? prResonanceMassDq.dq.join('; ') : ''">
      <div class="mob-field-main"><span class="mob-field-label">Fpr (with added mass)</span>
        <span class="mob-field-value mob-readonly">{{ fieldWithUnit(NumberField.PR_FSMASS_HZ, prFsMass_hz, '—') }}</span>
      </div>
    </div>
  </div>

  <div v-else-if="selectedBox === 'bandpass6' || selectedBox === 'abc'" class="mob-panel">
    <div class="mob-panel-head">Vents</div>
    <p class="mob-hint mob-hint-warn">
      <b>Response model pending.</b> These vent fields are shown for parity but are not yet wired to the engine for this enclosure type.
    </p>
  </div>
</template>

<style scoped>
.mob-panel {
  margin: 12px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 4px;
  overflow: hidden;
}
.mob-panel-head {
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--mut);
  border-bottom: 1px solid var(--line);
  background: var(--panel2);
}
.mob-panel-head-sub { border-top: 1px solid var(--line); }
.mob-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  min-height: 48px;
  border-top: 1px solid var(--line);
}
.mob-panel > .mob-row:first-of-type,
.mob-panel > .mob-field-row:first-of-type { border-top: none; }
.mob-row-label { font-size: 14px; color: var(--fg); }
.mob-select {
  flex: 1;
  max-width: 60%;
  min-height: 40px;
  padding: 6px 8px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: #fff;
  color: var(--fg);
  font: inherit;
  font-size: 14px;
}
.mob-pr-id { display: flex; flex-direction: column; gap: 2px; }
.mob-pr-label { font-size: 13px; color: var(--mut); }
.mob-pr-name { font-size: 17px; font-weight: 600; padding: 6px 8px; border: 1px solid var(--line); border-radius: 6px; }
.mob-pr-actions { gap: 12px; }
.mob-btn {
  flex: 1;
  min-height: 44px;
  border: 1px solid var(--acc);
  border-radius: 4px;
  background: var(--acc);
  color: #fff;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.mob-btn-secondary { background: var(--panel); color: var(--acc); }

.mob-field-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px 10px 14px;
  min-height: 48px;
  border-left: 3px solid transparent;
  border-top: 1px solid var(--line);
}
.mob-field-entered { border-left-color: var(--good); }
.mob-field-calculated { border-left-color: var(--acc); }
.mob-field-dq { border-left-color: var(--acc2); }
.mob-field-main { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.mob-field-label { font-size: 13px; color: var(--mut); }
.mob-field-value { font-size: 18px; font-variant-numeric: tabular-nums; display: flex; align-items: center; gap: 6px; }
.mob-field-value :deep(input) {
  border: none;
  background: transparent;
  font: inherit;
  font-size: 18px;
  color: var(--fg);
  padding: 0;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 32px;
}
/* An editable value looks like an input box; a read-only one stays flat text. */
.mob-field-value :deep(input:not([readonly])) {
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #fff;
  padding: 2px 8px;
}
.mob-field-value :deep(input:not([readonly]):focus) {
  border-color: var(--acc);
  outline: none;
}
.mob-readonly { color: var(--acc); }
.mob-impossible { color: #a11; }
.mob-unit { font-size: 13px; color: var(--mut); min-width: 30px; flex-shrink: 0; }
.mob-hint { margin: 8px 16px; font-size: 12.5px; color: var(--mut); line-height: 1.4; }
.mob-hint-warn { color: var(--acc2); }
</style>
