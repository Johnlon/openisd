<script setup lang="ts">
// "Driver wiring" on both skins (ticket 519, plan 3.1): how the project's several drivers are wired to the amplifier.
// Drawn only with 2 or more drivers. Not the Coil wiring (the voice coils inside one driver). Display and wiring only: the options and
// the words come from packages/design through useDriverWiring().
import UIPickField from './UIPickField.vue';
import {EnumField} from '@openisd/design/fields';
import {useDriverWiring} from '../../hooks/DriverWiring-hooks.js';

const help = EnumField.PROJECT_DRIVERWIRING.description;
defineProps<{phone?: boolean}>();
const {shown, mine, options, onSelect} = useDriverWiring();
</script>

<template>
  <template v-if="shown && phone">
    <div class="mob-crow">
      <label class="mob-crow-label" for="mob-driver-wiring">{{ EnumField.PROJECT_DRIVERWIRING.label }}</label>
      <select id="mob-driver-wiring" class="mob-cselect" :value="mine" :title="help" @change="onSelect">
        <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </div>
  </template>
  <template v-else-if="shown">
    <div class="field-row" style="margin-bottom:4px;">
      <UIPickField class="field" common :label="EnumField.PROJECT_DRIVERWIRING.label" input-id="og-driver-wiring" :title="help">
        <select id="og-driver-wiring" :value="mine" :title="help" @change="onSelect">
          <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </UIPickField>
    </div>
  </template>
</template>
