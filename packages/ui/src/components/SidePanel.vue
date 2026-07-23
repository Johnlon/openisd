<script setup lang="ts">
import DriverPanel from './DriverPanel.vue';
import BoxPanel from './BoxPanel.vue';
import SignalPanel from './SignalPanel.vue';
import FiltersPanel from './FiltersPanel.vue';
import AdvancedOptions from './AdvancedOptions.vue';
</script>

<template>
  <DriverPanel />
  <BoxPanel />
  <SignalPanel />
  <FiltersPanel />
  <fieldset>
    <legend>Advanced</legend>
    <AdvancedOptions />
  </fieldset>
  <div class="hint" style="padding:4px 4px 2px">
    Engine validated vs closed-form sealed (&lt;0.03 dB), driver sensitivity, and vented 24 dB/oct.
    Lumped electro-acoustical circuit, half-space.
  </div>
</template>
