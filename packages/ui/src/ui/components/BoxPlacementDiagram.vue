<script setup lang="ts">
/**
 * The Box tab's drawing for the project's driver placement (T919; John, 19 Nov 2026, QO953.c43: "for iso show two diagrams
 * clamshells and back to front so user knows that the model applies to both"; "keep image same size"). Standard: the box with one
 * driver. Iso-Barik: the same box twice, with the clamshell pair and with the back-to-front pair. Every drawing is the same size and
 * has a caption row, so the drawing area is the same height in both placements and nothing moves when Placement changes. Display only.
 */
import type {BoxType} from '@openisd/design/engine';
import {PhoneWizardText} from '@openisd/design/fields';
import BoxTypeDiagram from './BoxTypeDiagram.vue';
import BoxPairDrawing from './BoxPairDrawing.vue';

defineProps<{ boxType: BoxType; loading: 'standard' | 'isobaric' }>();
</script>

<template>
  <div class="bpd-pair" data-testid="box-placement-drawings" :data-loading="loading">
    <template v-if="loading === 'standard'">
      <figure class="bpd-fig" data-testid="box-standard">
        <BoxTypeDiagram :box-type="boxType" />
        <figcaption>{{ PhoneWizardText.PLACEMENT_STANDARD }}</figcaption>
      </figure>
    </template>
    <template v-else>
      <figure class="bpd-fig" data-testid="box-clamshell">
        <BoxPairDrawing :box-type="boxType" variant="clamshell" id-suffix="" />
        <figcaption>{{ PhoneWizardText.ISOBARIK_CLAMSHELL }}</figcaption>
      </figure>
      <figure class="bpd-fig" data-testid="box-tandem">
        <BoxPairDrawing :box-type="boxType" variant="tandem" id-suffix="-tandem" />
        <figcaption>{{ PhoneWizardText.ISOBARIK_TANDEM }}</figcaption>
      </figure>
    </template>
  </div>
</template>

<style scoped>
.bpd-pair { display: flex; justify-content: center; gap: 4px; }
.bpd-fig { display: flex; flex-direction: column; align-items: center; margin: 0; gap: 2px; }
.bpd-fig :deep(svg) { height: 126px; width: auto; flex: none; }
.bpd-fig figcaption { font-size: 10px; line-height: 12px; height: 24px; color: #444; text-align: center; max-width: 100px; }
</style>
