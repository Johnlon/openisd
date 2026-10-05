<script setup lang="ts">
// The mobile Advanced tab — environment overrides, sealed loss mode, and WinISD-compatibility
// switches. Thin: all state and domain reads/writes live in useMobileAdvancedTab()
// (src/hooks/MobileAdvancedTab-hooks.ts), which calls the SAME field-wiring factory
// OriginalShell-hooks.ts exports. AdvancedOptions.vue (the simulation-fidelity checkbox column)
// is reused unchanged — already presentation-only with its own hook.
import {CompatSwitchGroup, NumberField, ToggleField} from '@openisd/design/fields';
import {inputChecked} from '../../../logic/domEvents.js';
import NumInput from '../../components/NumInput.vue';
import UnitToggle from '../../components/UnitToggle.vue';
import AdvancedOptions from '../../components/AdvancedOptions.vue';
import ErrorSwitch from '../../components/ErrorSwitch.vue';
import ErrorSwitchGroup from '../../components/ErrorSwitchGroup.vue';
import {useMobileAdvancedTab} from '../../../hooks/MobileAdvancedTab-hooks.js';

const {
  project,
  envTempStored, envHumidityStored, envPressureStored, envTempDq, envHumidityDq, envPressureDq,
  advTemp, advHumidity, advPressure,
  resetAirToAppDefaults, advAir,
  abcVelocityApplies, errorSwitches,
} = useMobileAdvancedTab();
</script>

<template>
  <div class="mob-panel">
    <div class="mob-panel-head">Environment</div>
    <div class="mob-field-row" :class="[envTempStored ? 'mob-field-entered' : 'mob-field-calculated', { 'mob-field-dq': envTempDq.dq.length > 0 }]" :title="envTempDq.dq.join('; ')">
      <div class="mob-field-main"><span class="mob-field-label">Temperature</span>
        <span class="mob-field-value"><NumInput v-model="advTemp" :field="NumberField.ADV_TEMP_K" :precision="2" :allow-out-of-range="true" v-bind="envTempDq" stepper /></span>
      </div>
      <UnitToggle :field="NumberField.ADV_TEMP_K" unit-class="mob-unit" />
    </div>
    <div class="mob-field-row" :class="[envHumidityStored ? 'mob-field-entered' : 'mob-field-calculated', { 'mob-field-dq': envHumidityDq.dq.length > 0 }]" :title="envHumidityDq.dq.join('; ')">
      <div class="mob-field-main"><span class="mob-field-label">Relative humidity</span>
        <span class="mob-field-value"><NumInput v-model="advHumidity" :precision="2" :allow-out-of-range="true" v-bind="envHumidityDq" stepper /></span>
      </div>
      <span class="mob-unit">{{ NumberField.ADV_HUMIDITY_PCT.unitLabel() }}</span>
    </div>
    <div class="mob-field-row" :class="[envPressureStored ? 'mob-field-entered' : 'mob-field-calculated', { 'mob-field-dq': envPressureDq.dq.length > 0 }]" :title="envPressureDq.dq.join('; ')">
      <div class="mob-field-main"><span class="mob-field-label">Air pressure</span>
        <span class="mob-field-value"><NumInput v-model="advPressure" :field="NumberField.ADV_PRESSURE_KPA" :precision="1" :allow-out-of-range="true" v-bind="envPressureDq" stepper /></span>
      </div>
      <UnitToggle :field="NumberField.ADV_PRESSURE_KPA" unit-class="mob-unit" />
    </div>
    <div class="mob-field-row mob-field-calculated">
      <div class="mob-field-main"><span class="mob-field-label">Sound velocity</span>
        <span class="mob-field-value mob-readonly">{{ NumberField.ADV_SOUNDVELOCITY_M_PER_S.fixed(advAir.c) }} {{ NumberField.ADV_SOUNDVELOCITY_M_PER_S.unitLabel() }}</span>
      </div>
    </div>
    <div class="mob-field-row mob-field-calculated">
      <div class="mob-field-main"><span class="mob-field-label">Air density</span>
        <span class="mob-field-value mob-readonly">{{ NumberField.ADV_AIRDENSITY_KG_PER_M3.fixed(advAir.rho) }} {{ NumberField.ADV_AIRDENSITY_KG_PER_M3.unitLabel() }}</span>
      </div>
    </div>
    <div class="mob-row">
      <button class="mob-btn" @click="resetAirToAppDefaults">Reset to app levels</button>
    </div>
  </div>

  <div class="mob-panel">
    <div class="mob-panel-head">Simulation options</div>
    <div class="mob-adv-options">
      <AdvancedOptions />
    </div>
  </div>

  <div class="mob-panel">
    <div class="mob-panel-head">WinISD compatibility</div>
    <div class="mob-row mob-group-head" :title="CompatSwitchGroup.OPTIONS.tooltip">{{ CompatSwitchGroup.OPTIONS.heading }}</div>
    <div class="mob-row mob-checkbox-row">
      <label data-field-key="winisdWrapPhase" :title="ToggleField.ADV_WINISDWRAPPHASE.description">
        <input type="checkbox" :checked="project.winisdWrapPhase.value" @change="e => project.winisdWrapPhase.set(inputChecked(e))"> {{ ToggleField.ADV_WINISDWRAPPHASE.label }}
      </label>
    </div>
    <div class="mob-row mob-checkbox-row">
      <label data-field-key="winisdFlatModel" :title="ToggleField.ADV_WINISDFLATMODEL.description">
        <input type="checkbox" :checked="project.winisdFlatModel.value" @change="e => project.winisdFlatModel.set(inputChecked(e))"> {{ ToggleField.ADV_WINISDFLATMODEL.label }}
      </label>
    </div>
    <div class="mob-row mob-checkbox-row" :class="{ 'mob-row-na': !abcVelocityApplies }">
      <label data-field-key="winisdAbcIntraPortVelocity" :title="ToggleField.ADV_WINISDABCINTRAPORTVELOCITY.description">
        <input type="checkbox" :checked="project.winisdAbcIntraPortVelocity.value" :disabled="!abcVelocityApplies" @change="e => project.winisdAbcIntraPortVelocity.set(inputChecked(e))"> {{ ToggleField.ADV_WINISDABCINTRAPORTVELOCITY.label }}
      </label>
    </div>
    <ErrorSwitchGroup>
      <ErrorSwitch as="label" class="mob-row mob-checkbox-row" field-key="winisdDriverModel" :marked="errorSwitches.driverModel.marked" :applicable="errorSwitches.driverModel.applicable" :reproduces-error="errorSwitches.driverModel.reproducesError" :title="ToggleField.ADV_WINISDDRIVERMODEL.description">
        <input type="checkbox" :checked="project.winisdDriverModel.value" @change="e => project.winisdDriverModel.set(inputChecked(e))"> {{ ToggleField.ADV_WINISDDRIVERMODEL.label }}
      </ErrorSwitch>
      <ErrorSwitch as="label" class="mob-row mob-checkbox-row" field-key="winisdVaModel" :marked="errorSwitches.vaModel.marked" :applicable="errorSwitches.vaModel.applicable" :reproduces-error="errorSwitches.vaModel.reproducesError" :title="ToggleField.ADV_WINISDVAMODEL.description">
        <input type="checkbox" :checked="project.winisdVaModel.value" @change="e => project.winisdVaModel.set(inputChecked(e))"> {{ ToggleField.ADV_WINISDVAMODEL.label }}
      </ErrorSwitch>
      <ErrorSwitch as="label" class="mob-row mob-checkbox-row" field-key="winisdPrNprResonance" :marked="errorSwitches.prNprResonance.marked" :applicable="errorSwitches.prNprResonance.applicable" :reproduces-error="errorSwitches.prNprResonance.reproducesError" :title="ToggleField.ADV_WINISDPRNPRRESONANCE.description">
        <input type="checkbox" :checked="project.winisdPrNprResonance.value" :disabled="!errorSwitches.prNprResonance.applicable" @change="e => project.winisdPrNprResonance.set(inputChecked(e))"> {{ ToggleField.ADV_WINISDPRNPRRESONANCE.label }}
      </ErrorSwitch>
      <ErrorSwitch as="label" class="mob-row mob-checkbox-row" field-key="winisdBesselHighpass" :marked="errorSwitches.besselHighpass.marked" :applicable="errorSwitches.besselHighpass.applicable" :reproduces-error="errorSwitches.besselHighpass.reproducesError" :title="ToggleField.ADV_WINISDBESSELHIGHPASS.description">
        <input type="checkbox" :checked="project.winisdBesselHighpass.value" :disabled="!errorSwitches.besselHighpass.applicable" @change="e => project.winisdBesselHighpass.set(inputChecked(e))"> {{ ToggleField.ADV_WINISDBESSELHIGHPASS.label }}
      </ErrorSwitch>
      <ErrorSwitch as="label" class="mob-row mob-checkbox-row" field-key="winisdAbcGroupDelay" :marked="errorSwitches.abcGroupDelay.marked" :applicable="errorSwitches.abcGroupDelay.applicable" :reproduces-error="errorSwitches.abcGroupDelay.reproducesError" :title="ToggleField.ADV_WINISDABCGROUPDELAY.description">
        <input type="checkbox" :checked="project.winisdAbcGroupDelay.value" :disabled="!errorSwitches.abcGroupDelay.applicable" @change="e => project.winisdAbcGroupDelay.set(inputChecked(e))"> {{ ToggleField.ADV_WINISDABCGROUPDELAY.label }}
      </ErrorSwitch>
      <ErrorSwitch as="label" class="mob-row mob-checkbox-row" field-key="winisdDriverCountModel" :marked="errorSwitches.driverCount.marked" :applicable="errorSwitches.driverCount.applicable" :reproduces-error="errorSwitches.driverCount.reproducesError" :title="ToggleField.ADV_WINISDDRIVERCOUNTMODEL.description">
        <input type="checkbox" :checked="project.winisdDriverCountModel.value" :disabled="!errorSwitches.driverCount.applicable" @change="e => project.winisdDriverCountModel.set(inputChecked(e))"> {{ ToggleField.ADV_WINISDDRIVERCOUNTMODEL.label }}
      </ErrorSwitch>
    </ErrorSwitchGroup>
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
.mob-checkbox-row { justify-content: flex-start; }
.mob-checkbox-row label { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--fg); cursor: pointer; }
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
.mob-group-head { min-height: 0; padding: 6px 12px; font-size: 12px; font-weight: 600; color: var(--mut); }
.mob-row-na { opacity: 0.45; }
.mob-adv-options { padding: 10px 12px; }
.mob-adv-options :deep(.adv-options) { gap: 12px; }
.mob-adv-options :deep(.adv-options label) { font-size: 14px; min-height: 32px; }

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
.mob-unit { font-size: 13px; color: var(--mut); min-width: 30px; flex-shrink: 0; }
</style>
