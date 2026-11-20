<script setup lang="ts">
/**
 * The New Project dialog's box drawing for the ONE arrangement picked on step 2 (T919): Standard draws the box with one driver,
 * Iso-Barik clamshell or back to front draws the box with that pair only. The Box tab's BoxPlacementDiagram draws both Iso-Barik
 * arrangements because the project does not record which one; the dialog knows, so it draws only the user's choice (the lead,
 * 20 Nov 2026, on the step 4 picture: John objected to a drawing of an arrangement chosen elsewhere). Display only.
 */
import type {BoxType} from '@openisd/design/engine';
import type {PlacementChoice} from '@openisd/design/fields';
import BoxTypeDiagram from './BoxTypeDiagram.vue';
import BoxPairDrawing from './BoxPairDrawing.vue';

defineProps<{ boxType: BoxType; choice: PlacementChoice }>();
</script>

<template>
  <figure class="bad-fig" data-testid="box-arrangement-drawing" :data-art="choice.art">
    <BoxTypeDiagram v-if="choice.art === 'single'" :box-type="boxType" />
    <!-- Keyed by the arrangement: the pair drawing reads its variant once, when it is made. -->
    <BoxPairDrawing v-else :key="choice.art" :box-type="boxType" :variant="choice.art" id-suffix="" />
    <figcaption>{{ choice.label }}</figcaption>
  </figure>
</template>

<style scoped>
.bad-fig { display: flex; flex-direction: column; align-items: center; margin: 0; gap: 2px; }
.bad-fig :deep(svg) { height: var(--bpd-h, 126px); width: auto; flex: none; }
.bad-fig figcaption { font-size: 10px; line-height: 12px; color: #444; text-align: center; }
</style>
