<script setup lang="ts">
// The mobile Enclosure tab — vent (port) fields for vented/bandpass4, passive-radiator fields for
// box-passive-radiator, and the bandpass6/abc placeholder. Thin: all state and domain reads/writes
// live in useMobileEnclosureTab() (src/hooks/MobileEnclosureTab-hooks.ts), which calls the SAME
// field-wiring factories OriginalShell-hooks.ts exports. PRBrowser/PREditModal are the app's
// existing global-style overlays, reused unchanged (not duplicated per skin) — position:fixed
// descendants of .app-root-mobile are already contained to the phone pane (App.vue's own fix).
import {NumberField} from '@openisd/design/fields';
import {selectedOption} from '../../../logic/domEvents.js';
import NumInput from '../../components/NumInput.vue';
import UnitToggle from '../../components/UnitToggle.vue';
import PRBrowser from '../../components/PRBrowser.vue';
import PREditModal from '../../components/PREditModal.vue';
import {useMobileEnclosureTab} from '../../../hooks/MobileEnclosureTab-hooks.js';

const {
  project, selectedBox,
  activeVent, portPipeResonance_hz, fbState, ventLState, fbUnreachable, fbUnreachableMsg, frontChamberTuningLabel,
  prAddedMassDq, prTuningDq, prResonanceMassDq, prFsMass_hz,
  prBrowseOpen, prEditOpen, loadPREntry, loadBundledPassiveRadiatorEntry, defineNewPREntry,
  setVentWidth, setVentHeight, setVentDiameter, setVentLength, setFbTarget,
  VENT_SHAPE_OPTIONS, END_CORRECTION_OPTIONS, VENT_COUNT_OPTIONS,
  FB_TARGET_TIP, VENT_GEOMETRY_TIP,
} = useMobileEnclosureTab();
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
                      :field="NumberField.VENT_W_CM" unit-key="ventW" group="length" base="cm" :precision="NumberField.VENT_W_CM.precision" />
          </span>
        </div>
        <UnitToggle field="ventW" group="length" base="cm" unit-class="mob-unit" />
      </div>
      <div class="mob-field-row mob-field-entered">
        <div class="mob-field-main">
          <span class="mob-field-label">Slot height</span>
          <span class="mob-field-value" :title="VENT_GEOMETRY_TIP">
            <NumInput :model-value="activeVent.height_m.value" @update:model-value="setVentHeight"
                      :field="NumberField.VENT_H_CM" unit-key="ventH" group="length" base="cm" :precision="NumberField.VENT_H_CM.precision" />
          </span>
        </div>
        <UnitToggle field="ventH" group="length" base="cm" unit-class="mob-unit" />
      </div>
    </template>
    <div v-else class="mob-field-row mob-field-entered">
      <div class="mob-field-main">
        <span class="mob-field-label">Vent diameter</span>
        <span class="mob-field-value" :title="VENT_GEOMETRY_TIP">
          <NumInput :model-value="activeVent.diameter_m.value" @update:model-value="setVentDiameter"
                    :field="NumberField.VENT_D_CM" unit-key="ventD" group="length" base="cm" :precision="NumberField.VENT_D_CM.precision" />
        </span>
      </div>
      <UnitToggle field="ventD" group="length" base="cm" unit-class="mob-unit" />
    </div>

    <div class="mob-field-row" :class="ventLState === 'E' ? 'mob-field-entered' : 'mob-field-calculated'">
      <div class="mob-field-main">
        <span class="mob-field-label">Vent length</span>
        <span v-if="ventLState === 'E'" class="mob-field-value">
          <NumInput :model-value="activeVent.length_m.value"
                    @update:model-value="setVentLength"
                    :field="NumberField.VENT_L_CM" unit-key="ventL" group="length" base="cm" :precision="NumberField.VENT_L_CM.precision" />
        </span>
        <span v-else class="mob-field-value mob-readonly" :class="{ 'mob-impossible': activeVent.length_m.value === null }">
          {{ activeVent.length_m.value != null ? activeVent.length_m.value.toFixed(NumberField.VENT_L_CM.precision) + ' cm' : '—' }}
        </span>
      </div>
      <UnitToggle field="ventL" group="length" base="cm" unit-class="mob-unit" />
    </div>

    <div class="mob-field-row" :class="fbState === 'E' ? 'mob-field-entered' : 'mob-field-calculated'">
      <div class="mob-field-main">
        <span class="mob-field-label">{{ frontChamberTuningLabel }}</span>
        <span v-if="fbState === 'E'" class="mob-field-value" :title="FB_TARGET_TIP">
          <NumInput :model-value="project.box.vented.tuning_goal_hz.value"
                    @update:model-value="setFbTarget"
                    :field="NumberField.BOX_FB_HZ" unit-key="Fb" group="freq" base="Hz" :precision="NumberField.BOX_FB_HZ.precision" />
        </span>
        <span v-else class="mob-field-value mob-readonly" :title="FB_TARGET_TIP">
          {{ project.box.vented.tuning_goal_hz.value != null ? project.box.vented.tuning_goal_hz.value.toFixed(NumberField.BOX_FB_HZ.precision) + ' Hz' : '—' }}
        </span>
      </div>
      <UnitToggle field="Fb" group="freq" base="Hz" unit-class="mob-unit" />
    </div>

    <div class="mob-field-row mob-field-calculated">
      <div class="mob-field-main">
        <span class="mob-field-label">Cross area</span>
        <span class="mob-field-value mob-readonly">{{ activeVent.area_m2.value != null ? (activeVent.area_m2.value * 10000).toFixed(NumberField.VENT_CROSSAREA_M2.precision) + ' cm²' : '—' }}</span>
      </div>
    </div>
    <div class="mob-field-row mob-field-calculated">
      <div class="mob-field-main">
        <span class="mob-field-label">1st port resonance</span>
        <span class="mob-field-value mob-readonly">{{ portPipeResonance_hz != null ? portPipeResonance_hz.toFixed(NumberField.VENT_1STPORTRESONANCE_HZ.precision) + ' Hz' : '—' }}</span>
      </div>
    </div>
    <p v-if="fbUnreachable" class="mob-hint mob-hint-warn">{{ fbUnreachableMsg }}</p>
  </div>

  <div v-else-if="selectedBox === 'box-passive-radiator'" class="mob-panel">
    <div class="mob-panel-head">Passive radiator</div>
    <div class="mob-row">
      <label class="mob-row-label">PR</label>
      <span class="mob-pr-name">{{ project.box.passiveRadiator.radiator.model.value || 'Custom PR' }}</span>
    </div>
    <div class="mob-row mob-pr-actions">
      <button class="mob-btn" @click="prBrowseOpen = true">Select PR</button>
      <button class="mob-btn" @click="prEditOpen = true">&#9998; Edit</button>
    </div>
    <PRBrowser v-if="prBrowseOpen" @close="prBrowseOpen = false"
      @load="loadPREntry" @load-bundled="loadBundledPassiveRadiatorEntry" @define="defineNewPREntry" />
    <PREditModal v-if="prEditOpen" @close="prEditOpen = false" />

    <div class="mob-field-row mob-field-entered">
      <div class="mob-field-main"><span class="mob-field-label">Vas</span>
        <span class="mob-field-value"><NumInput :model-value="project.box.passiveRadiator.radiator.spec.Vas_m3.value" @update:model-value="(v: number | null) => project.box.passiveRadiator.radiator.spec.Vas_m3.set(v ?? 0)" :field="NumberField.PR_VAS_L" unit-key="prVas" group="volume" base="L" :precision="NumberField.PR_VAS_L.precision" /></span>
      </div>
      <UnitToggle field="prVas" group="volume" base="L" unit-class="mob-unit" />
    </div>
    <div class="mob-field-row mob-field-entered">
      <div class="mob-field-main"><span class="mob-field-label">Qms</span>
        <span class="mob-field-value"><NumInput :model-value="project.box.passiveRadiator.radiator.spec.Qms.value" @update:model-value="(v: number | null) => project.box.passiveRadiator.radiator.spec.Qms.set(v ?? 0)" :field="NumberField.PR_QMS" :precision="NumberField.PR_QMS.precision" /></span>
      </div>
    </div>
    <div class="mob-field-row mob-field-entered">
      <div class="mob-field-main"><span class="mob-field-label">Fpr</span>
        <span class="mob-field-value"><NumInput :model-value="project.box.passiveRadiator.radiator.spec.Fs_hz.value" @update:model-value="(v: number | null) => project.box.passiveRadiator.radiator.spec.Fs_hz.set(v ?? 0)" :field="NumberField.PR_FS_HZ" unit-key="prFs" group="freq" base="Hz" :precision="NumberField.PR_FS_HZ.precision" /></span>
      </div>
      <UnitToggle field="prFs" group="freq" base="Hz" unit-class="mob-unit" />
    </div>
    <div class="mob-field-row mob-field-entered">
      <div class="mob-field-main"><span class="mob-field-label">Sd</span>
        <span class="mob-field-value"><NumInput :model-value="project.box.passiveRadiator.radiator.spec.Sd_m2.value" @update:model-value="(v: number | null) => project.box.passiveRadiator.radiator.spec.Sd_m2.set(v ?? 0)" :field="NumberField.PR_SD_CM2" unit-key="prSd" group="area" base="cm2" :precision="NumberField.PR_SD_CM2.precision" /></span>
      </div>
      <UnitToggle field="prSd" group="area" base="cm2" unit-class="mob-unit" />
    </div>
    <div class="mob-field-row mob-field-entered">
      <div class="mob-field-main"><span class="mob-field-label">Xmax</span>
        <span class="mob-field-value"><NumInput :model-value="project.box.passiveRadiator.radiator.spec.Xmax_m.value" @update:model-value="(v: number | null) => project.box.passiveRadiator.radiator.spec.Xmax_m.set(v ?? 0)" :field="NumberField.PR_XMAX_MM" unit-key="prXmax" group="length" base="mm" :precision="NumberField.PR_XMAX_MM.precision" /></span>
      </div>
      <UnitToggle field="prXmax" group="length" base="mm" unit-class="mob-unit" />
    </div>

    <div class="mob-panel-head mob-panel-head-sub">User options</div>
    <div class="mob-field-row mob-field-entered">
      <div class="mob-field-main"><span class="mob-field-label">Num. of PRs</span>
        <span class="mob-field-value"><NumInput :model-value="project.box.passiveRadiator.count.value" @update:model-value="(v: number | null) => project.box.passiveRadiator.count.set(v ?? 0)" :field="NumberField.PR_NUM" :precision="NumberField.PR_NUM.precision" /></span>
      </div>
    </div>
    <div class="mob-field-row mob-field-entered" :class="{ 'mob-field-dq': prAddedMassDq.dq.length > 0 }">
      <div class="mob-field-main"><span class="mob-field-label">Added mass to cone</span>
        <span class="mob-field-value"><NumInput :model-value="project.box.passiveRadiator.addedMass_kg.value" @update:model-value="(v: number | null) => project.box.passiveRadiator.addedMass_kg.set(v ?? 0)" :field="NumberField.PR_MADD_G" unit-key="prMadd" group="mass" base="g" :precision="NumberField.PR_MADD_G.precision" v-bind="prAddedMassDq" /></span>
      </div>
      <UnitToggle field="prMadd" group="mass" base="g" unit-class="mob-unit" />
    </div>
    <div class="mob-field-row mob-field-entered" :class="{ 'mob-field-dq': prTuningDq.dq.length > 0 }">
      <div class="mob-field-main"><span class="mob-field-label">Target tuning freq (Fp)</span>
        <span class="mob-field-value"><NumInput :model-value="project.box.passiveRadiator.tuning_goal_hz.value" @update:model-value="(v: number | null) => project.box.passiveRadiator.tuning_goal_hz.set(v ?? 0)" :field="NumberField.PR_FP_HZ" unit-key="Fp" group="freq" base="Hz" :precision="NumberField.PR_FP_HZ.precision" v-bind="prTuningDq" /></span>
      </div>
      <UnitToggle field="Fp" group="freq" base="Hz" unit-class="mob-unit" />
    </div>
    <div class="mob-field-row mob-field-calculated" :class="{ 'mob-field-dq': prResonanceMassDq.dq.length > 0 }" :title="prResonanceMassDq.dq.length > 0 ? prResonanceMassDq.dq.join('; ') : ''">
      <div class="mob-field-main"><span class="mob-field-label">Fpr (with added mass)</span>
        <span class="mob-field-value mob-readonly">{{ prFsMass_hz != null ? prFsMass_hz.toFixed(NumberField.PR_FSMASS_HZ.precision) + ' Hz' : '—' }}</span>
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
.mob-pr-name { font-size: 14px; color: var(--fg); }
.mob-pr-actions { gap: 10px; }
.mob-btn {
  flex: 1;
  min-height: 40px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: #fff;
  color: var(--fg);
  font: inherit;
  font-size: 14px;
}

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
.mob-field-value { font-size: 18px; font-variant-numeric: tabular-nums; }
.mob-field-value :deep(input) {
  border: none;
  background: transparent;
  font: inherit;
  font-size: 18px;
  color: var(--fg);
  padding: 0;
  width: 100%;
  min-height: 32px;
}
.mob-readonly { color: var(--acc); }
.mob-impossible { color: #a11; }
.mob-unit { font-size: 13px; color: var(--mut); }
.mob-hint { margin: 8px 16px; font-size: 12.5px; color: var(--mut); line-height: 1.4; }
.mob-hint-warn { color: var(--acc2); }
</style>
