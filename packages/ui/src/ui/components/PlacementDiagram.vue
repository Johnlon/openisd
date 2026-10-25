<script setup lang="ts">
/**
 * The New project wizard's driver placement drawing: the drivers only, no enclosure (the box type is
 * not chosen yet), in the box pictures' style. Standard: one driver on a short baffle line. Iso-Barik:
 * two drivers cone to cone in a short tunnel on the baffle, magnets outward (clamshell).
 */
defineProps<{ placement: 'standard' | 'iso' }>();
</script>

<template>
  <svg viewBox="47 45 175 210" height="126" aria-hidden="true">
    <path d="M160,70 L160,110 M160,190 L160,230" fill="none" stroke="#0F4761" stroke-width="4"/>
    <template v-if="placement === 'standard'">
      <path d="M160,110 L130,130 L130,170 L160,190" fill="#A0B8C6" stroke="#0F4761" stroke-width="3"/>
      <path d="M160,106 L126,136 M160,194 L126,164" fill="none" stroke="#0F4761" stroke-width="2"/>
      <rect x="108" y="138" width="20" height="24" fill="#0F4761"/>
    </template>
    <template v-else>
      <path d="M160,110 L112,110 M160,190 L112,190" fill="none" stroke="#0F4761" stroke-width="3"/>
      <path d="M160,130 L138,112 L138,188 L160,170 Z" fill="#A0B8C6" stroke="#0F4761" stroke-width="3"/>
      <rect x="161" y="140" width="18" height="20" fill="#0F4761"/>
      <path d="M134,112 L112,130 L112,170 L134,188 Z" fill="#A0B8C6" stroke="#0F4761" stroke-width="3"/>
      <rect x="92" y="140" width="20" height="20" fill="#0F4761"/>
    </template>
  </svg>
</template>
