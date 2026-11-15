<script setup lang="ts">
// The Driver tab's voice-coil wiring rows for a multi-coil driver: the wiring the maker measured Re
// and BL in (read-only, with where it comes from), "My wiring" (the project's own choice), and the
// published and converted figures. Display and wiring only: the words and the conversion come from
// packages/design through useDriverCoilWiring().
import UIPickField from './UIPickField.vue';
import {useDriverCoilWiring} from '../../hooks/DriverCoilWiring-hooks.js';

defineProps<{phone?: boolean}>();
const {shown, measuredText, measuredTitle, options, mine, disabled, reason, publishedFigures, mineFigures, onSelect} = useDriverCoilWiring();
</script>

<template>
  <template v-if="shown && phone">
    <div class="mob-crow" data-testid="coil-wiring-measured">
      <span class="mob-crow-label">Measured wiring</span>
      <span class="coil-measured-text" :title="measuredTitle">{{ measuredText }}</span>
    </div>
    <div class="mob-crow">
      <label class="mob-crow-label" for="mob-coil-wiring">My wiring</label>
      <select id="mob-coil-wiring" class="mob-cselect" :value="mine" :disabled="disabled" :title="reason" @change="onSelect">
        <option v-if="disabled" value="" disabled>Not available</option>
        <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </div>
    <p v-if="disabled" class="coil-wiring-note" data-testid="coil-wiring-reason">{{ reason }}</p>
    <p v-else class="coil-wiring-note" data-testid="coil-wiring-figures">As published: {{ publishedFigures }}<br>My wiring: {{ mineFigures }}</p>
  </template>
  <template v-else-if="shown">
    <div class="coil-wiring-caption">This driver's voice coils</div>
    <div class="coil-wiring-measured" data-testid="coil-wiring-measured" title="The wiring the maker measured Re and BL in">
      <span class="coil-measured-label">Measured wiring</span>
      <span class="coil-measured-text" :title="measuredTitle">{{ measuredText }}</span>
    </div>
    <div class="field-row" style="margin-bottom:4px;">
      <UIPickField class="field" common label="My wiring" input-id="og-coil-wiring">
        <select id="og-coil-wiring" :value="mine" :disabled="disabled" :title="reason" @change="onSelect">
          <option v-if="disabled" value="" disabled>n/a</option>
          <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </UIPickField>
    </div>
    <p v-if="disabled" class="coil-wiring-note" data-testid="coil-wiring-reason">{{ reason }}</p>
    <p v-else class="coil-wiring-note" data-testid="coil-wiring-figures">As published: {{ publishedFigures }}<br>My wiring: {{ mineFigures }}</p>
  </template>
</template>

<style scoped>
.coil-measured-text { font-size: 13px; }
.coil-wiring-caption { margin-top: 6px; font-size: 12px; font-weight: 600; color: #555; }
.coil-wiring-note { max-width: 320px; margin: 2px 0 4px; font-size: 12px; line-height: 16px; color: #555; overflow-wrap: anywhere; }
.coil-wiring-measured { display: grid; grid-template-columns: var(--label-w, var(--ctl-label-w, 150px)) 1fr; column-gap: 4px; align-items: center; min-height: 22px; margin: 2px 0; }
.mob-crow .coil-measured-text { font-size: 14px; flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }
.mob-crow ~ .coil-wiring-note { max-width: none; padding: 4px var(--mob-edge); margin: 0; box-shadow: inset 0 -1px 0 #e6e6e6; font-size: 13px; line-height: 18px; }
</style>
