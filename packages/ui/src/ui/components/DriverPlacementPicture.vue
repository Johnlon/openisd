<script setup lang="ts">
// The desktop Driver tab's drawing of the chosen placement (T919): one driver for Standard, the clamshell and the back-to-front
// pair for Iso-Barik. Display only; the choice is made in DriverPlacement.vue.
import {useDriverPlacement} from '../../hooks/DriverPlacement-hooks.js';
import PlacementDiagram from './PlacementDiagram.vue';

const {mine} = useDriverPlacement();
</script>

<template>
  <div class="placement-picture" data-testid="placement-diagram" :data-placement="mine">
    <PlacementDiagram :placement="mine" />
  </div>
</template>

<style scoped>
.placement-picture { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; margin-top: 0; }
.placement-picture :deep(svg) { height: 64px; width: auto; }
.placement-picture :deep(figcaption) { font-size: 10px; line-height: 11px; max-width: 90px; }
.placement-picture :deep(.pd-pair) { gap: 8px; }
</style>
