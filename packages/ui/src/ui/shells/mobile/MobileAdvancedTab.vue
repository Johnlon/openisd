<script setup lang="ts">
// The mobile Advanced tab — environment overrides, sealed loss mode, and WinISD-compatibility
// switches. Thin: all state and domain reads/writes live in useMobileAdvancedTab()
// (src/hooks/MobileAdvancedTab-hooks.ts), which calls the SAME field-wiring factory
// OriginalShell-hooks.ts exports. AdvancedOptions.vue (the simulation-fidelity checkbox column)
// is reused unchanged — already presentation-only with its own hook.
import {NumberField, PhoneHelp, PhoneRowColumns, ToggleField} from '@openisd/design/fields';
import {inputChecked} from '../../../logic/domEvents.js';
import UISettlingField from '../../components/UISettlingField.vue';
import AdvancedOptions from '../../components/AdvancedOptions.vue';
import ErrorSwitch from '../../components/ErrorSwitch.vue';
import ErrorSwitchGroup from '../../components/ErrorSwitchGroup.vue';
import PhoneBand from './PhoneBand.vue';
import PhoneButton from './PhoneButton.vue';
import PhoneClassicPage from './PhoneClassicPage.vue';
import ToggleLabel from '../../components/ToggleLabel.vue';
import {useMobileAdvancedTab} from '../../../hooks/MobileAdvancedTab-hooks.js';

const {
  project,
  envTempStored, envHumidityStored, envPressureStored, envTempDq, envHumidityDq, envPressureDq,
  envSoundVelocityStored, envAirDensityStored, envSoundVelocityDq, envAirDensityDq,
  advTemp, advHumidity, advPressure, advSoundVelocity, advAirDensity,
  resetAirToAppDefaults,
  abcVelocityApplies, errorSwitches,
} = useMobileAdvancedTab();
</script>

<template>
  <PhoneClassicPage>
    <PhoneBand :section="PhoneHelp.ADVANCED_ENVIRONMENT" />
    <UISettlingField class="mob-ui-field" :columns="PhoneRowColumns.MEDIUM_LABEL" :field="NumberField.ADV_TEMP_K" :value="advTemp" @update:value="v => advTemp = v" @clear="advTemp = null" :defaulted="!envTempStored" :dq="envTempDq.dq" :dq-state="envTempDq.dqState" stepper allow-out-of-range />
    <UISettlingField class="mob-ui-field" :columns="PhoneRowColumns.MEDIUM_LABEL" :field="NumberField.ADV_HUMIDITY_PCT" :value="advHumidity" @update:value="v => advHumidity = v" @clear="advHumidity = null" :defaulted="!envHumidityStored" :dq="envHumidityDq.dq" :dq-state="envHumidityDq.dqState" stepper allow-out-of-range />
    <UISettlingField class="mob-ui-field" :columns="PhoneRowColumns.MEDIUM_LABEL" :field="NumberField.ADV_PRESSURE_KPA" :value="advPressure" @update:value="v => advPressure = v" @clear="advPressure = null" :defaulted="!envPressureStored" :dq="envPressureDq.dq" :dq-state="envPressureDq.dqState" stepper allow-out-of-range />
    <UISettlingField class="mob-ui-field" :columns="PhoneRowColumns.MEDIUM_LABEL" :field="NumberField.ADV_SOUNDVELOCITY_M_PER_S" :value="advSoundVelocity" @update:value="v => advSoundVelocity = v" @clear="advSoundVelocity = null" :defaulted="!envSoundVelocityStored" :dq="envSoundVelocityDq.dq" :dq-state="envSoundVelocityDq.dqState" allow-out-of-range />
    <UISettlingField class="mob-ui-field" :columns="PhoneRowColumns.MEDIUM_LABEL" :field="NumberField.ADV_AIRDENSITY_KG_PER_M3" :value="advAirDensity" @update:value="v => advAirDensity = v" @clear="advAirDensity = null" :defaulted="!envAirDensityStored" :dq="envAirDensityDq.dq" :dq-state="envAirDensityDq.dqState" allow-out-of-range />
    <div class="mob-adv-btns">
      <PhoneButton @click="resetAirToAppDefaults">Reset to app levels</PhoneButton>
    </div>

    <PhoneBand :section="PhoneHelp.ADVANCED_SIMULATION" />
    <div class="mob-adv-options">
      <AdvancedOptions />
    </div>

    <PhoneBand :section="PhoneHelp.ADVANCED_WINISD_STYLE" />
    <div class="mob-switch-row">
      <label data-field-key="winisdWrapPhase" :title="ToggleField.ADV_WINISDWRAPPHASE.description">
        <input type="checkbox" :checked="project.winisdWrapPhase.value" @change="e => project.winisdWrapPhase.set(inputChecked(e))"> {{ ToggleField.ADV_WINISDWRAPPHASE.label }}
      </label>
    </div>
    <div class="mob-switch-row">
      <label data-field-key="winisdFlatModel" :title="ToggleField.ADV_WINISDFLATMODEL.description">
        <input type="checkbox" :checked="project.winisdFlatModel.value" @change="e => project.winisdFlatModel.set(inputChecked(e))"> {{ ToggleField.ADV_WINISDFLATMODEL.label }}
      </label>
    </div>
    <div class="mob-switch-row" :class="{ 'mob-row-na': !abcVelocityApplies }">
      <label data-field-key="winisdAbcIntraPortVelocity" :title="ToggleField.ADV_WINISDABCINTRAPORTVELOCITY.description">
        <input type="checkbox" :checked="project.winisdAbcIntraPortVelocity.value" :disabled="!abcVelocityApplies" @change="e => project.winisdAbcIntraPortVelocity.set(inputChecked(e))"> <ToggleLabel :field="ToggleField.ADV_WINISDABCINTRAPORTVELOCITY" />
      </label>
    </div>
    <ErrorSwitchGroup>
      <template #head><PhoneBand :section="PhoneHelp.ADVANCED_WINISD_BUGS" /></template>
      <ErrorSwitch as="label" class="mob-switch-row" field-key="winisdDriverModel" :marked="errorSwitches.driverModel.marked" :applicable="errorSwitches.driverModel.applicable" :reproduces-error="errorSwitches.driverModel.reproducesError" :title="ToggleField.ADV_WINISDDRIVERMODEL.description">
        <input type="checkbox" :checked="project.winisdDriverModel.value" @change="e => project.winisdDriverModel.set(inputChecked(e))"> {{ ToggleField.ADV_WINISDDRIVERMODEL.label }}
      </ErrorSwitch>
      <ErrorSwitch as="label" class="mob-switch-row" field-key="winisdVaModel" :marked="errorSwitches.vaModel.marked" :applicable="errorSwitches.vaModel.applicable" :reproduces-error="errorSwitches.vaModel.reproducesError" :title="ToggleField.ADV_WINISDVAMODEL.description">
        <input type="checkbox" :checked="project.winisdVaModel.value" @change="e => project.winisdVaModel.set(inputChecked(e))"> {{ ToggleField.ADV_WINISDVAMODEL.label }}
      </ErrorSwitch>
      <ErrorSwitch as="label" class="mob-switch-row" field-key="winisdPrNprResonance" :marked="errorSwitches.prNprResonance.marked" :applicable="errorSwitches.prNprResonance.applicable" :reproduces-error="errorSwitches.prNprResonance.reproducesError" :title="ToggleField.ADV_WINISDPRNPRRESONANCE.description">
        <input type="checkbox" :checked="project.winisdPrNprResonance.value" :disabled="!errorSwitches.prNprResonance.applicable" @change="e => project.winisdPrNprResonance.set(inputChecked(e))"> {{ ToggleField.ADV_WINISDPRNPRRESONANCE.label }}
      </ErrorSwitch>
      <ErrorSwitch as="label" class="mob-switch-row" field-key="winisdBesselHighpass" :marked="errorSwitches.besselHighpass.marked" :applicable="errorSwitches.besselHighpass.applicable" :reproduces-error="errorSwitches.besselHighpass.reproducesError" :title="ToggleField.ADV_WINISDBESSELHIGHPASS.description">
        <input type="checkbox" :checked="project.winisdBesselHighpass.value" :disabled="!errorSwitches.besselHighpass.applicable" @change="e => project.winisdBesselHighpass.set(inputChecked(e))"> {{ ToggleField.ADV_WINISDBESSELHIGHPASS.label }}
      </ErrorSwitch>
      <ErrorSwitch as="label" class="mob-switch-row" field-key="winisdAbcGroupDelay" :marked="errorSwitches.abcGroupDelay.marked" :applicable="errorSwitches.abcGroupDelay.applicable" :reproduces-error="errorSwitches.abcGroupDelay.reproducesError" :title="ToggleField.ADV_WINISDABCGROUPDELAY.description">
        <input type="checkbox" :checked="project.winisdAbcGroupDelay.value" :disabled="!errorSwitches.abcGroupDelay.applicable" @change="e => project.winisdAbcGroupDelay.set(inputChecked(e))"> {{ ToggleField.ADV_WINISDABCGROUPDELAY.label }}
      </ErrorSwitch>
      <ErrorSwitch as="label" class="mob-switch-row" field-key="winisdDriverCountModel" :marked="errorSwitches.driverCount.marked" :applicable="errorSwitches.driverCount.applicable" :reproduces-error="errorSwitches.driverCount.reproducesError" :title="ToggleField.ADV_WINISDDRIVERCOUNTMODEL.description">
        <input type="checkbox" :checked="project.winisdDriverCountModel.value" :disabled="!errorSwitches.driverCount.applicable" @change="e => project.winisdDriverCountModel.set(inputChecked(e))"> {{ ToggleField.ADV_WINISDDRIVERCOUNTMODEL.label }}
      </ErrorSwitch>
      <ErrorSwitch as="label" class="mob-switch-row" field-key="winisdSealedPicker" :marked="errorSwitches.sealedPicker.marked" :applicable="errorSwitches.sealedPicker.applicable" :reproduces-error="errorSwitches.sealedPicker.reproducesError" :title="ToggleField.ADV_WINISDSEALEDPICKER.description">
        <input type="checkbox" :checked="project.winisdSealedPicker.value" :disabled="!errorSwitches.sealedPicker.applicable" @change="e => project.winisdSealedPicker.set(inputChecked(e))"> {{ ToggleField.ADV_WINISDSEALEDPICKER.label }}
      </ErrorSwitch>
      <ErrorSwitch as="label" class="mob-switch-row" field-key="winisdTlPortNoEndCorrection" :marked="errorSwitches.tlPortEndCorrection.marked" :applicable="errorSwitches.tlPortEndCorrection.applicable" :reproduces-error="errorSwitches.tlPortEndCorrection.reproducesError" :title="ToggleField.ADV_WINISDTLPORTNOENDCORRECTION.description">
        <input type="checkbox" :checked="project.winisdTlPortNoEndCorrection.value" :disabled="!errorSwitches.tlPortEndCorrection.applicable" @change="e => project.winisdTlPortNoEndCorrection.set(inputChecked(e))"> {{ ToggleField.ADV_WINISDTLPORTNOENDCORRECTION.label }}
      </ErrorSwitch>
    </ErrorSwitchGroup>
  </PhoneClassicPage>
</template>

<style scoped>
/* A switch row (classic phone page): a tick box, its label, and any ≠W cue; at least the classic row depth. */
.mob-switch-row {
  display: flex;
  align-items: center;
  gap: 10px;
  box-sizing: border-box;
  min-height: var(--mob-row-min);
  padding: 4px 16px;
  border-bottom: 1px solid #e6e6e6;
  font-size: 15px;
  line-height: 19px;
  color: var(--fg);
  cursor: pointer;
}
.mob-switch-row > label { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; min-height: inherit; cursor: inherit; }
.mob-switch-row input[type=checkbox] { width: 20px; height: 20px; margin: 0; flex: none; }
.mob-row-na { opacity: 0.45; cursor: default; }
/* A bug switch is a yellow row; its warning mark sits inside the row, in front of the tick box (the phone has no gutter for a badge on the border). */
.mob-switch-row.error-switch-marked { border-width: 0 0 1px; border-style: solid; border-color: #e6e6e6; border-radius: 0; background: #fbf3d9; box-shadow: inset 3px 0 0 #d4a514; padding: 4px 16px; gap: 10px; }
.mob-switch-row.error-switch-marked.error-switch-on { background: #f6e3a1; }
.mob-switch-row.error-switch-marked :deep(.error-switch-mark) { position: static; transform: none; flex: none; background: none; font-size: 15px; color: #9a6d00; }
/* The button row under the air rows: one PhoneButton, full width. */
.mob-adv-btns { display: flex; padding: 6px 16px; border-bottom: 1px solid #e6e6e6; }
/* The simulation options are the same switch rows, drawn by the shared AdvancedOptions component. */
.mob-adv-options :deep(.adv-options) { gap: 0; }
.mob-adv-options :deep(.adv-options label) {
  box-sizing: border-box; min-height: var(--mob-row-min); padding: 4px 16px; gap: 10px;
  border-bottom: 1px solid #e6e6e6; font-size: 15px; line-height: 19px; color: var(--fg);
}
.mob-adv-options :deep(.adv-options input[type=checkbox]) { width: 20px; height: 20px; margin: 0; flex: none; }
</style>
