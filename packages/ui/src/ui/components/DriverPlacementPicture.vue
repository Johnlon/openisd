<script setup lang="ts">
// The Driver tab's three arrangement pictures beside the Standard / Iso-Barik choice (T919): Standard, Iso-Barik clamshell, Iso-Barik back
// to front, as on New Project step 2; a click on one picks it (John, 20 Nov 2026: the Iso-Barik pictures go on the Driver tab; "keep the box
// tab as the classic simple box view"). Over them, with Iso-Barik, the pairs line: the driver count is of pairs, so it says how many drivers
// that is. Which Iso-Barik arrangement is picked is this tab's own state (the project records only Standard or Iso-Barik).
// Display and wiring only: the choices and the words come from packages/design, through useDriverPlacement().
import {PhoneWizardText} from '@openisd/design/fields';
import {useDriverPlacement} from '../../hooks/DriverPlacement-hooks.js';
import PlacementArt from './PlacementArt.vue';

defineProps<{phone?: boolean}>();
const {mine, choices, picked, driverCountNote, pick} = useDriverPlacement();
</script>

<template>
  <div class="placement-picture" :class="{'placement-picture-phone': phone}">
    <!-- The pairs line keeps its height for Standard (hidden), so the pictures do not move when the choice changes. -->
    <p class="placement-pair-note" :class="{'placement-pair-note-off': driverCountNote === null}" :aria-hidden="driverCountNote === null"
      data-testid="driver-pair-note">{{ driverCountNote }}</p>
    <div class="placement-pics" role="group" :aria-label="PhoneWizardText.PLACEMENT_LABEL" data-testid="placement-diagram" :data-placement="mine" :data-art="picked.art">
      <button v-for="c in choices" :key="c.value" type="button" class="placement-pic" :class="{'placement-pic-on': picked === c}"
        :aria-pressed="picked === c" :title="c.label" :data-testid="`placement-${c.art}`" @click="pick(c)">
        <PlacementArt :art="c.art" />
        <span class="placement-pic-caption">{{ c.label }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.placement-picture { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
.placement-picture-phone { align-items: center; padding: 4px 0 8px; border-bottom: 1px solid #e6e6e6; }
.placement-pair-note { margin: 0; font-size: 12px; line-height: 16px; color: #666; min-height: 16px; }
.placement-pair-note-off { visibility: hidden; }
.placement-pics { display: flex; gap: 2px; }
/* A picture is a click target; the chosen one is framed, as on New Project step 2. */
.placement-pic { display: flex; flex-direction: column; align-items: center; gap: 2px; width: 74px; padding: 2px; border: 2px solid transparent; border-radius: 4px; background: none; font: inherit; cursor: pointer; }
.placement-pic:hover { border-color: #b8d4f8; }
.placement-pic.placement-pic-on { border-color: #2e7d32; background: #f0f7f0; }
.placement-pic :deep(svg) { height: 52px; width: auto; }
.placement-picture-phone .placement-pic { width: 96px; }
.placement-picture-phone .placement-pic :deep(svg) { height: 72px; }
.placement-pic-caption { font-size: 10px; line-height: 11px; color: #444; text-align: center; }
</style>
