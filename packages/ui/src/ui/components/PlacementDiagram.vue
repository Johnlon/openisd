<script setup lang="ts">
/**
 * The driver placement drawing: the drivers only, no enclosure (the Box tab draws the box). Standard: one driver on a short baffle
 * line. Iso-Barik: both ways the pair can be mounted, side by side and labelled, because OpenISD models them the same way
 * (John, 19 Nov 2026, QO953.c43, c45): clamshell (cones face to face, magnets outward) and back to front (both face the front,
 * one behind the other). Display only.
 */
import {PhoneWizardText} from '@openisd/design/fields';
import PlacementArt from './PlacementArt.vue';

defineProps<{ placement: 'standard' | 'isobaric' }>();
</script>

<template>
  <div v-if="placement === 'standard'" class="pd-pair">
    <figure class="pd-fig" data-testid="placement-single">
      <PlacementArt art="single" />
      <figcaption>{{ PhoneWizardText.PLACEMENT_STANDARD }}</figcaption>
    </figure>
  </div>
  <div v-else class="pd-pair">
    <figure class="pd-fig" data-testid="placement-clamshell">
      <PlacementArt art="clamshell" />
      <figcaption>{{ PhoneWizardText.ISOBARIK_CLAMSHELL }}</figcaption>
    </figure>
    <figure class="pd-fig" data-testid="placement-tandem">
      <PlacementArt art="tandem" />
      <figcaption>{{ PhoneWizardText.ISOBARIK_TANDEM }}</figcaption>
    </figure>
  </div>
</template>

<style scoped>
.pd-pair { display: flex; justify-content: center; gap: 12px; }
.pd-fig { display: flex; flex-direction: column; align-items: center; margin: 0; gap: 2px; }
.pd-fig figcaption { font-size: 12px; color: #444; text-align: center; max-width: 110px; height: 2.4em; }
</style>
