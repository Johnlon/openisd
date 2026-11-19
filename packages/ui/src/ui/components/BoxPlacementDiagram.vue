<script setup lang="ts">
/**
 * The Box tab's drawing for the project's driver placement (T919; John, 19 Nov 2026, QO953.c43: "for iso show two diagrams
 * clamshells and back to front so user knows that the model applies to both"). Standard: the box with one driver. Iso-Barik: the
 * same box twice, with the clamshell pair and with the back-to-front pair, labelled. Display only.
 */
import type {BoxType} from '@openisd/design/engine';
import {PhoneWizardText} from '@openisd/design/fields';
import BoxTypeDiagram from './BoxTypeDiagram.vue';

defineProps<{ boxType: BoxType; loading: 'standard' | 'isobaric' }>();
</script>

<template>
  <BoxTypeDiagram v-if="loading === 'standard'" :box-type="boxType" variant="single" />
  <div v-else class="bpd-pair" data-testid="box-placement-pair">
    <figure class="bpd-fig" data-testid="box-clamshell">
      <BoxTypeDiagram :box-type="boxType" variant="clamshell" />
      <figcaption>{{ PhoneWizardText.ISOBARIK_CLAMSHELL }}</figcaption>
    </figure>
    <figure class="bpd-fig" data-testid="box-tandem">
      <BoxTypeDiagram :box-type="boxType" variant="tandem" />
      <figcaption>{{ PhoneWizardText.ISOBARIK_TANDEM }}</figcaption>
    </figure>
  </div>
</template>

<style scoped>
.bpd-pair { display: flex; justify-content: center; gap: 4px; }
.bpd-fig { display: flex; flex-direction: column; align-items: center; margin: 0; gap: 2px; }
.bpd-fig :deep(svg) { height: var(--bpd-h); width: auto; }
.bpd-fig figcaption { font-size: 10px; line-height: 11px; color: #444; text-align: center; max-width: 80px; }
</style>
