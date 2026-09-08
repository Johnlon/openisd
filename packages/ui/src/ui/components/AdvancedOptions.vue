<script setup lang="ts">
/**
 * WinISD's Advanced-pane checkbox column — the simulation-fidelity toggles
 * (docs/winisd_screenshots/info/view_6_advanced.md). ONE implementation, embedded in the Advanced pane.
 * `inert-control-gate.test.ts` asserts this file binds every modeled toggle
 * in the field registry, so a checkbox here can never go back to being decorative.
 *
 * Each field's full semantics, WinISD cross-reference and assumption status live in the
 * field registry (fields/fieldRegistry.ts, pane 'Advanced'); the tooltips below are the
 * short form of the same text. Design: PLAN_ADVANCED_SIM_OPTIONS.md.
 */
import { computed } from 'vue';
import { simVcInductance } from '../../logic/appState.js';
import { useFocusedProject } from '../../logic/focusedProjectContext.js';
import { fieldHelp } from '../../logic/fields/fieldRegistry.js';
import { inputChecked } from '../../logic/domEvents.js';

// No per-toggle computed wrapper (`docs/design/REACTIVITY.md`): each checkbox below reads the
// focused project's own getter directly, reactive via `project`, and writes through its own
// setter directly on `@change` — `simVcInductance` above is the one exception, a store-level
// alias over `circuitModel` (two WORDINGS of one setting, not a per-field mirror of it).
const project = useFocusedProject();

/** The transmission-line port model only means anything for a box that HAS a vent. */
const hasVent = computed(() => {
  const b = project.value.box.boxType.get();
  return b === 'vented' || b === 'bandpass4';
});
</script>

<template>
  <div class="adv-options">
    <label title="Include voice-coil inductance Le in the acoustic circuit, not just the impedance plot. Off matches WinISD's own circuit (Le shapes impedance only, docs/research/WINISD_PARITY.md §9); on is the full gyrator model. WinISD: Advanced → 'Simulate voice coil inductance'.">
      <input type="checkbox" v-model="simVcInductance"> Simulate voice coil inductance
    </label>
    <label data-field-key="forceFlatResponse" :title="fieldHelp('forceFlatResponse')">
      <input type="checkbox" :checked="project.forceFlatResponse.get()" @change="e => project.forceFlatResponse.set(inputChecked(e))"> Force flat response
    </label>
    <label data-field-key="tlPortModel" :title="fieldHelp('tlPortModel')"
      :class="{ 'na': !hasVent }">
      <input type="checkbox" :checked="project.useTransmissionLinePortModel.get()" @change="e => project.useTransmissionLinePortModel.set(inputChecked(e))" :disabled="!hasVent"> Use "transmission line"-model for port simulation
    </label>
    <label data-field-key="rgAtDriverSide" :title="fieldHelp('rgAtDriverSide')">
      <input type="checkbox" :checked="project.rgAtDriverSide.get()" @change="e => project.rgAtDriverSide.set(inputChecked(e))"> Rg is at driver side
    </label>
    <label data-field-key="splXmaxLimited" :title="fieldHelp('splXmaxLimited')">
      <input type="checkbox" :checked="project.splGraphIsXmaxLimited.get()" @change="e => project.splGraphIsXmaxLimited.set(inputChecked(e))"> SPL graph is Xmax limited
    </label>
    <label data-field-key="useWinisdAirModel" :title="fieldHelp('useWinisdAirModel')">
      <input type="checkbox" :checked="project.envUseWinisdAirModel()" @change="e => project.setEnvUseWinisdAirModel(inputChecked(e))"> Use WinISD air model
    </label>
  </div>
</template>

<style scoped>
.adv-options { display: flex; flex-direction: column; gap: 4px; }
.adv-options label { display: flex; align-items: center; gap: 6px; cursor: pointer; }
/* Not-applicable (no vent in this box type) — still readable, visibly inactive. */
.adv-options label.na { opacity: 0.45; cursor: default; }
</style>
