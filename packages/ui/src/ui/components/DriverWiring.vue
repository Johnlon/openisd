<script setup lang="ts">
// "Driver wiring" on both skins (ticket 519, plan 3.1): how the project's several drivers are wired to the amplifier.
// Placement and Iso-Barik compatibility share this control group on both skins.
import UIPickField from './UIPickField.vue';
import ToggleLabel from './ToggleLabel.vue';
import {EnumField, ToggleField} from '@openisd/design/fields';
import {useDriverWiring} from '../../hooks/DriverWiring-hooks.js';

const help = EnumField.PROJECT_DRIVERWIRING.description;
defineProps<{phone?: boolean}>();
const {shown, mine, options, onSelect, loading, winisdIsobarik, selectLoading, selectWinisdIsobarik, loadingField} = useDriverWiring();
</script>

<template>
  <div :class="phone ? 'mob-crow' : 'radio-group field-row'" :title="loadingField.description">
    <label v-for="option in loadingField.options" :key="option.value">
      <input type="radio" name="driver-placement" :value="option.value" :checked="loading === option.value" @change="selectLoading(option.value)">
      {{ option.label }}
    </label>
  </div>
  <label v-if="loading === 'isobaric'" class="isobarik-switch" :title="ToggleField.PROJECT_WINISDISOBARIK.description">
    <input type="checkbox" :checked="winisdIsobarik" @change="selectWinisdIsobarik">
    <ToggleLabel :field="ToggleField.PROJECT_WINISDISOBARIK" />
  </label>
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

<style scoped>
.isobarik-switch {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-block: 4px;
}
</style>
