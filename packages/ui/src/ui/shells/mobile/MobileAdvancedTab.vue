<script setup lang="ts">
// The mobile Advanced tab — environment overrides, sealed loss mode, and WinISD-compatibility
// switches. Thin: all state and domain reads/writes live in useMobileAdvancedTab()
// (src/hooks/MobileAdvancedTab-hooks.ts), which calls the SAME field-wiring factory
// OriginalShell-hooks.ts exports. AdvancedOptions.vue (the simulation-fidelity checkbox column)
// is reused unchanged — already presentation-only with its own hook.
import {NumberField, ToggleField} from '@openisd/design/fields';
import {inputChecked, selectedOption} from '../../../logic/domEvents.js';
import NumInput from '../../components/NumInput.vue';
import UnitToggle from '../../components/UnitToggle.vue';
import AdvancedOptions from '../../components/AdvancedOptions.vue';
import {useMobileAdvancedTab} from '../../../hooks/MobileAdvancedTab-hooks.js';

const {
  project,
  envTempStored, envHumidityStored, envPressureStored, envTempDq, envHumidityDq, envPressureDq,
  advTemp, advHumidity, advPressure,
  resetAirToAppDefaults, advAir,
  LOSS_MODE_OPTIONS, lossMode, applyWinisdSettings,
} = useMobileAdvancedTab();
</script>

<template>
  <div class="mob-panel">
    <div class="mob-panel-head">Environment</div>
    <div class="mob-field-row" :class="[envTempStored ? 'mob-field-entered' : 'mob-field-calculated', { 'mob-field-dq': envTempDq.dq.length > 0 }]" :title="envTempDq.dq.join('; ')">
      <div class="mob-field-main"><span class="mob-field-label">Temperature</span>
        <span class="mob-field-value"><NumInput v-model="advTemp" :field="NumberField.ADV_TEMP_K" unit-key="advTemp" :precision="2" :allow-out-of-range="true" v-bind="envTempDq" stepper /></span>
      </div>
      <UnitToggle :field="NumberField.ADV_TEMP_K" unit-key="advTemp" unit-class="mob-unit" />
    </div>
    <div class="mob-field-row" :class="[envHumidityStored ? 'mob-field-entered' : 'mob-field-calculated', { 'mob-field-dq': envHumidityDq.dq.length > 0 }]" :title="envHumidityDq.dq.join('; ')">
      <div class="mob-field-main"><span class="mob-field-label">Relative humidity</span>
        <span class="mob-field-value"><NumInput v-model="advHumidity" :precision="2" :allow-out-of-range="true" v-bind="envHumidityDq" stepper /></span>
      </div>
      <span class="mob-unit">%</span>
    </div>
    <div class="mob-field-row" :class="[envPressureStored ? 'mob-field-entered' : 'mob-field-calculated', { 'mob-field-dq': envPressureDq.dq.length > 0 }]" :title="envPressureDq.dq.join('; ')">
      <div class="mob-field-main"><span class="mob-field-label">Air pressure</span>
        <span class="mob-field-value"><NumInput v-model="advPressure" :field="NumberField.ADV_PRESSURE_KPA" unit-key="advPressure" :precision="1" :allow-out-of-range="true" v-bind="envPressureDq" stepper /></span>
      </div>
      <UnitToggle :field="NumberField.ADV_PRESSURE_KPA" unit-key="advPressure" unit-class="mob-unit" />
    </div>
    <div class="mob-field-row mob-field-calculated">
      <div class="mob-field-main"><span class="mob-field-label">Sound velocity</span>
        <span class="mob-field-value mob-readonly">{{ advAir.c.toFixed(NumberField.ADV_SOUNDVELOCITY_M_PER_S.precision) }} m/s</span>
      </div>
    </div>
    <div class="mob-field-row mob-field-calculated">
      <div class="mob-field-main"><span class="mob-field-label">Air density</span>
        <span class="mob-field-value mob-readonly">{{ advAir.rho.toFixed(NumberField.ADV_AIRDENSITY_KG_PER_M3.precision) }} kg/m³</span>
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
    <div class="mob-panel-head mob-panel-head-row">
      <span>WinISD compatibility</span>
      <button class="mob-btn mob-btn-small" title="Reset to WinISD: set every WinISD-vs-conventional switch to WinISD" @click="applyWinisdSettings">Reset</button>
    </div>
    <div class="mob-row">
      <label class="mob-row-label" for="mob-adv-lossmode">Sealed loss model</label>
      <select id="mob-adv-lossmode" class="mob-select" :value="lossMode"
              @change="e => { const m = selectedOption(e, LOSS_MODE_OPTIONS); if (m !== null) lossMode = m; }">
        <option v-for="m in LOSS_MODE_OPTIONS" :key="m.value" :value="m.value">{{ m.label }}</option>
      </select>
    </div>
    <div class="mob-row mob-checkbox-row">
      <label :title="ToggleField.ADV_USEWINISDAIRMODEL.description">
        <input type="checkbox" :checked="project.envUseWinisdAirModel.value" @change="e => project.envUseWinisdAirModel.set(inputChecked(e))"> WinISD air model
      </label>
    </div>
    <div class="mob-row mob-checkbox-row">
      <label title="Ticked (default, as WinISD): the simulation uses two BLs, as WinISD does. Unticked (conventional): one BL throughout, from the entered datasheet values.">
        <input type="checkbox" :checked="project.winisdDriverModel.value" @change="e => project.winisdDriverModel.set(inputChecked(e))"> WinISD driver model
      </label>
    </div>
    <div class="mob-row mob-checkbox-row">
      <label title="Affects the Amplifier apparent load power (VA) chart only — see the desktop tooltip for the formula difference.">
        <input type="checkbox" :checked="project.winisdVaModel.value" @change="e => project.winisdVaModel.set(inputChecked(e))"> WinISD VA model
      </label>
    </div>
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
.mob-panel-head-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
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
.mob-btn-small { flex: none; min-height: 32px; padding: 0 12px; font-size: 13px; }
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
.mob-readonly { color: var(--acc); }
.mob-unit { font-size: 13px; color: var(--mut); min-width: 30px; flex-shrink: 0; }
</style>
