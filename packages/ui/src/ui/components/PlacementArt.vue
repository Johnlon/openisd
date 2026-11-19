<script setup lang="ts">
/**
 * One driver placement drawing, drivers only: `single` is one driver on a short baffle line, `clamshell` and `tandem` the two
 * Iso-Barik pairs (DriverPairArt). PlacementDiagram and the New Project placement cards both draw with it. Display only.
 */
import DriverPairArt from './DriverPairArt.vue';

defineProps<{ art: 'single' | 'clamshell' | 'tandem' }>();
</script>

<template>
  <svg viewBox="47 45 175 210" height="126" aria-hidden="true">
    <path d="M160,70 L160,110 M160,190 L160,230" fill="none" stroke="#0F4761" stroke-width="4"/>
    <template v-if="art === 'single'">
      <path d="M160,110 L130,130 L130,170 L160,190" fill="#A0B8C6" stroke="#0F4761" stroke-width="3"/>
      <path d="M160,106 L126,136 M160,194 L126,164" fill="none" stroke="#0F4761" stroke-width="2"/>
      <rect x="108" y="138" width="20" height="24" fill="#0F4761"/>
    </template>
    <DriverPairArt v-else :variant="art" :x="160" :y="150" :half="40" :x-scale="1"/>
  </svg>
</template>
