<script setup lang="ts">
// The Driver tab's voice-coil wiring row for a multi-coil driver: "My wiring" (the project's own
// choice) and under it the figures for it, with the published ones only where they differ. The
// measured wiring is not shown (John, 2026-11-15, QO941). Display and wiring only: the words and
// the conversion come from packages/design through useDriverCoilWiring().
import UIPickField from './UIPickField.vue';
import {useDriverCoilWiring} from '../../hooks/DriverCoilWiring-hooks.js';

defineProps<{phone?: boolean}>();
const {shown, options, mine, publishedFigures, mineFigures, showPublished, onSelect} = useDriverCoilWiring();
</script>

<template>
  <template v-if="shown && phone">
    <div class="mob-crow">
      <label class="mob-crow-label" for="mob-coil-wiring">My wiring</label>
      <select id="mob-coil-wiring" class="mob-cselect" :value="mine" @change="onSelect">
        <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </div>
    <p class="coil-wiring-note" data-testid="coil-wiring-figures"><template v-if="showPublished">As published: {{ publishedFigures }}<br></template>My wiring: {{ mineFigures }}</p>
  </template>
  <template v-else-if="shown">
    <div class="coil-wiring-caption">This driver's voice coils</div>
    <div class="field-row" style="margin-bottom:4px;">
      <UIPickField class="field" common label="My wiring" input-id="og-coil-wiring">
        <select id="og-coil-wiring" :value="mine" @change="onSelect">
          <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </UIPickField>
    </div>
    <p class="coil-wiring-note" data-testid="coil-wiring-figures"><template v-if="showPublished">As published: {{ publishedFigures }}<br></template>My wiring: {{ mineFigures }}</p>
  </template>
</template>

<style scoped>
.coil-wiring-caption { margin-top: 6px; font-size: 12px; font-weight: 600; color: #555; }
.coil-wiring-note { max-width: 320px; margin: 2px 0 4px; font-size: 12px; line-height: 16px; color: #555; overflow-wrap: anywhere; }
.mob-crow ~ .coil-wiring-note { max-width: none; padding: 4px var(--mob-edge); margin: 0; box-shadow: inset 0 -1px 0 #e6e6e6; font-size: 13px; line-height: 18px; }
</style>
