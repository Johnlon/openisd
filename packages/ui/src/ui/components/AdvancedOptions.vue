<script setup lang="ts">
/**
 * WinISD's Advanced-pane checkbox column — the simulation-fidelity toggles
 * (docs/winisd_screenshots/info/view_6_advanced.md). ONE implementation, embedded in the Advanced pane.
 * `inert-control-gate.test.ts` asserts this file binds every modeled toggle
 * in the field registry, so a checkbox here can never go back to being decorative.
 *
 * Each field's full semantics, WinISD cross-reference and assumption status live in the
 * field registry (`ToggleField`, `@openisd/design/fields`); the tooltips below are the
 * short form of the same text. Design: PLAN_ADVANCED_SIM_OPTIONS.md.
 */
import {ToggleField} from '@openisd/design/fields';
import {useAdvancedOptions} from '../../hooks/AdvancedOptions-hooks.js';
import ToggleLabel from './ToggleLabel.vue';

const {project, hasVent, simVcInductance, inputChecked} = useAdvancedOptions();
</script>

<template>
  <div class="adv-options">
    <label data-field-key="simVcInductance" :title="ToggleField.ADV_SIMVCINDUCTANCE.description">
      <input type="checkbox" v-model="simVcInductance"> <ToggleLabel :field="ToggleField.ADV_SIMVCINDUCTANCE" />
    </label>
    <label data-field-key="forceFlatResponse" :title="ToggleField.ADV_FORCEFLATRESPONSE.description">
      <input type="checkbox" :checked="project.forceFlatResponse.value" @change="e => project.forceFlatResponse.set(inputChecked(e))"> <ToggleLabel :field="ToggleField.ADV_FORCEFLATRESPONSE" />
    </label>
    <label data-field-key="tlPortModel" :title="ToggleField.ADV_TLPORTMODEL.description"
      :class="{ 'na': !hasVent }">
      <input type="checkbox" :checked="project.useTransmissionLinePortModel.value" @change="e => project.useTransmissionLinePortModel.set(inputChecked(e))" :disabled="!hasVent"> <ToggleLabel :field="ToggleField.ADV_TLPORTMODEL" />
    </label>
    <label data-field-key="rgAtDriverSide" :title="ToggleField.ADV_RGATDRIVERSIDE.description">
      <input type="checkbox" :checked="project.rgAtDriverSide.value" @change="e => project.rgAtDriverSide.set(inputChecked(e))"> <ToggleLabel :field="ToggleField.ADV_RGATDRIVERSIDE" />
    </label>
    <label data-field-key="splXmaxLimited" :title="ToggleField.ADV_SPLXMAXLIMITED.description">
      <input type="checkbox" :checked="project.splGraphIsXmaxLimited.value" @change="e => project.splGraphIsXmaxLimited.set(inputChecked(e))"> <ToggleLabel :field="ToggleField.ADV_SPLXMAXLIMITED" />
    </label>
  </div>
</template>

<style scoped>
.adv-options { display: flex; flex-direction: column; gap: 4px; }
.adv-options label { display: flex; align-items: center; gap: 6px; cursor: pointer; }
/* Not-applicable (no vent in this box type) — still readable, visibly inactive. */
.adv-options label.na { opacity: 0.45; cursor: default; }
</style>
