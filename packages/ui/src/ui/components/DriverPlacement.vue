<script setup lang="ts">
// "Placement" on both skins (T919, QO953.c38): Standard or Iso-Barik. Desktop: WinISD's two radios. Phone: a select, as in the New project wizard.
// The drawing beside it shows the chosen placement (WinISD's Box tab drawing stays one driver for both; its wizard draws the pair).
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
    <div class="placement-pic" data-testid="placement-diagram" :data-placement="mine"><PlacementDiagram :placement="mine" /></div>
  </div>
</template>

<style scoped>
.placement-pic { display: flex; justify-content: center; align-items: center; }
.placement-pic-phone { padding: 8px 0; border-bottom: 1px solid #e6e6e6; }
.placement-pic svg { height: 100px; }
</style>
