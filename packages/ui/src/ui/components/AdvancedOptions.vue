<script setup lang="ts">
/**
 * WinISD's Advanced-pane checkbox column — the five simulation-fidelity toggles
 * (docs/winisd/info/view_6_advanced.md). ONE implementation, embedded in the Advanced pane.
 * `inert-control-gate.test.ts` asserts this file binds every modeled toggle
 * in the field registry, so a checkbox here can never go back to being decorative.
 *
 * Each field's full semantics, WinISD cross-reference and assumption status live in the
 * field registry (fields/fieldRegistry.ts, pane 'Advanced'); the tooltips below are the
 * short form of the same text. Design: PLAN_ADVANCED_SIM_OPTIONS.md.
 */
import { computed } from 'vue';
import { state, simVcInductance } from '../../logic/store.js';

/** The transmission-line port model only means anything for a box that HAS a vent. */
const hasVent = computed(() => state.box === 'vented' || state.box === 'bandpass4');
</script>

<template>
  <div class="adv-options">
    <label title="Include voice-coil inductance Le in the acoustic circuit, not just the impedance plot. Off matches WinISD's own circuit (Le shapes impedance only, docs/research/WINISD_PARITY.md §9); on is the full gyrator model. WinISD: Advanced → 'Simulate voice coil inductance'.">
      <input type="checkbox" v-model="simVcInductance"> Simulate voice coil inductance
    </label>
    <label title="Apply the EQ that lifts the whole response to the passband level, and charge its cost to the excursion, port-velocity and max-SPL curves. Boost is capped at 20 dB; a warning names the frequency where the cap binds. WinISD: Advanced → 'Force flat response'.">
      <input type="checkbox" v-model="state.P.forceFlatResponse"> Force flat response
    </label>
    <label
      :class="{ 'na': !hasVent }"
      :title="hasVent
        ? 'Model the vent as an acoustic transmission line rather than a lumped air mass, adding the duct\'s own pipe resonances at c/(2·Leff). The box tuning is unchanged. WinISD: Advanced → \'Use &quot;transmission line&quot;-model for port simulation\'.'
        : 'Only applies to a box with a vent (vented or 4th-order bandpass) — the current box has no port to model.'">
      <input type="checkbox" v-model="state.P.tlPortModel" :disabled="!hasVent"> Use "transmission line"-model for port simulation
    </label>
    <label title="Put the source resistance Rg in series with each driver rather than as a single Rg at the amplifier. Only changes anything with more than one driver: n in parallel see Rg/n at the driver side but a full Rg at the amp side. WinISD: Advanced → 'Rg is at driver side'.">
      <input type="checkbox" v-model="state.P.rgAtDriverSide"> Rg is at driver side
    </label>
    <label title="Plot the SPL chart with the drive backed off wherever the cone would exceed Xmax, shading the limited region. Xmax only — the Maximum SPL chart still applies the Pe thermal limit too. WinISD: Advanced → 'SPL graph is Xmax limited'.">
      <input type="checkbox" v-model="state.P.splXmaxLimited"> SPL graph is Xmax limited
    </label>
    <label title="Derive air density and sound velocity from temperature alone, discarding the relative humidity and air pressure you entered. WinISD stores all three in its project file and reads none of them, so tick this to reproduce its numbers exactly. It costs accuracy: SPL differs by about 0.07 dB at 30 °C.">
      <input type="checkbox" v-model="state.P.ignoreHumidityAndPressure"> Ignore humidity and air pressure (as WinISD does)
    </label>
  </div>
</template>

<style scoped>
.adv-options { display: flex; flex-direction: column; gap: 4px; }
.adv-options label { display: flex; align-items: center; gap: 6px; cursor: pointer; }
/* Not-applicable (no vent in this box type) — still readable, visibly inactive. */
.adv-options label.na { opacity: 0.45; cursor: default; }
</style>
