<script setup lang="ts">
/**
 * The driver placement drawing: the drivers only, no enclosure (the Box tab draws the box). Standard: one driver on a short baffle
 * line. Iso-Barik: both ways the pair can be mounted, side by side and labelled, because OpenISD models them the same way
 * (John, 19 Nov 2026, QO953.c43, c45): clamshell (cones face to face, magnets outward) and back to front (both face the front,
 * one behind the other). Display only.
 */
import {PhoneWizardText} from '@openisd/design/fields';
import DriverPairArt from './DriverPairArt.vue';

defineProps<{ placement: 'standard' | 'isobaric' }>();
</script>

<template>
  <div v-if="placement === 'standard'" class="pd-pair">
    <figure class="pd-fig" data-testid="placement-single">
    <svg viewBox="47 45 175 210" height="126" aria-hidden="true">
      <path d="M160,70 L160,110 M160,190 L160,230" fill="none" stroke="#0F4761" stroke-width="4"/>
      <path d="M160,110 L130,130 L130,170 L160,190" fill="#A0B8C6" stroke="#0F4761" stroke-width="3"/>
      <path d="M160,106 L126,136 M160,194 L126,164" fill="none" stroke="#0F4761" stroke-width="2"/>
      <rect x="108" y="138" width="20" height="24" fill="#0F4761"/>
    </svg>
      <figcaption>{{ PhoneWizardText.PLACEMENT_STANDARD }}</figcaption>
    </figure>
  </div>
  <div v-else class="pd-pair">
    <figure class="pd-fig" data-testid="placement-clamshell">
      <svg viewBox="47 45 175 210" height="126" aria-hidden="true">
        <path d="M160,70 L160,110 M160,190 L160,230" fill="none" stroke="#0F4761" stroke-width="4"/>
        <DriverPairArt variant="clamshell" :x="160" :y="150" :half="40" :x-scale="1"/>
      </svg>
      <figcaption>{{ PhoneWizardText.ISOBARIK_CLAMSHELL }}</figcaption>
    </figure>
    <figure class="pd-fig" data-testid="placement-tandem">
      <svg viewBox="47 45 175 210" height="126" aria-hidden="true">
        <path d="M160,70 L160,110 M160,190 L160,230" fill="none" stroke="#0F4761" stroke-width="4"/>
        <DriverPairArt variant="tandem" :x="160" :y="150" :half="40" :x-scale="1"/>
      </svg>
      <figcaption>{{ PhoneWizardText.ISOBARIK_TANDEM }}</figcaption>
    </figure>
  </div>
</template>

<style scoped>
.pd-pair { display: flex; justify-content: center; gap: 12px; }
.pd-fig { display: flex; flex-direction: column; align-items: center; margin: 0; gap: 2px; }
.pd-fig figcaption { font-size: 12px; color: #444; text-align: center; max-width: 110px; height: 2.4em; }
</style>
