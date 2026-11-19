<script setup lang="ts">
// "Placement" on both skins (T919, QO953.c38): Standard or Iso-Barik. Desktop: WinISD's two radios. Phone: a select, as in the New project wizard.
// On the phone the drawing of the chosen placement sits under the select; on desktop DriverPlacementPicture draws it in the free space of the Advanced options column.
// Display and wiring only: the options and the words come from packages/design, the maths from the engine, through useDriverPlacement().
import {PhoneWizardText} from '@openisd/design/fields';
import {useDriverPlacement} from '../../hooks/DriverPlacement-hooks.js';
import PlacementDiagram from './PlacementDiagram.vue';

defineProps<{phone?: boolean}>();
const {mine, options, choose, onSelect} = useDriverPlacement();
</script>

<template>
  <template v-if="phone">
    <div class="mob-crow">
      <label class="mob-crow-label" for="mob-driver-placement">{{ PhoneWizardText.PLACEMENT_LABEL }}</label>
      <select id="mob-driver-placement" class="mob-cselect" :value="mine" @change="onSelect">
        <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </div>
    <div class="placement-pic placement-pic-phone" data-testid="placement-diagram" :data-placement="mine"><PlacementDiagram :placement="mine" /></div>
  </template>
  <div v-else class="placement-desktop">
    <div class="radio-group field-row" style="margin-bottom:4px;">
      <label v-for="o in options" :key="o.value"><input type="radio" name="og-placement" :value="o.value" :checked="mine === o.value" @change="choose(o.value)"> {{ o.label }}</label>
    </div>
  </div>
</template>

<style scoped>
.placement-pic { display: flex; justify-content: center; align-items: center; }
.placement-pic-phone { padding: 16px 0 12px; border-bottom: 1px solid #e6e6e6; }
.placement-pic-phone :deep(svg) { height: 80px; width: auto; }
.placement-pic-phone :deep(figcaption) { font-size: 10px; line-height: 11px; max-width: 90px; }
</style>
