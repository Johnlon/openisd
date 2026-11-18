<script setup lang="ts">
// "Placement" on both skins (T919, QO953.c38): Standard or Iso-Barik. Desktop: WinISD's two radios. Phone: a select, as in the New project wizard.
// Display and wiring only: the options and the words come from packages/design, the maths from the engine, through useDriverPlacement().
import {PhoneWizardText} from '@openisd/design/fields';
import {useDriverPlacement} from '../../hooks/DriverPlacement-hooks.js';

defineProps<{phone?: boolean}>();
const {mine, options, choose, onSelect} = useDriverPlacement();
</script>

<template>
  <div v-if="phone" class="mob-crow">
    <label class="mob-crow-label" for="mob-driver-placement">{{ PhoneWizardText.PLACEMENT_LABEL }}</label>
    <select id="mob-driver-placement" class="mob-cselect" :value="mine" @change="onSelect">
      <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
  </div>
  <div v-else class="radio-group field-row" style="margin-bottom:4px;">
    <label v-for="o in options" :key="o.value"><input type="radio" name="og-placement" :value="o.value" :checked="mine === o.value" @change="choose(o.value)"> {{ o.label }}</label>
  </div>
</template>
