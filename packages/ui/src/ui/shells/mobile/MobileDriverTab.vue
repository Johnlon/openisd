<script setup lang="ts">
// The mobile Driver tab — identity, driver count, voice-coil wiring and the driver's key figures.
// Thin: all state and domain reads/writes live in useMobileDriverTab() (src/hooks/MobileDriverTab-hooks.ts).
import {NumberField, PhoneHelp, PhoneLabels} from '@openisd/design/fields';
import UIFixedField from '../../components/UIFixedField.vue';
import PhoneButton from './PhoneButton.vue';
import PhoneBand from './PhoneBand.vue';
import PhoneClassicPage from './PhoneClassicPage.vue';
import { useMobileDriverTab } from '../../../hooks/MobileDriverTab-hooks.js';

const { project, fullName, keyFigures, browseDrivers, editDriver, showDriverInfo, N_DRIVERS_OPTIONS, ARRAY_WIRING_OPTIONS, selectedOption } = useMobileDriverTab();
</script>

<template>
  <PhoneClassicPage>
    <div class="mob-crow">
      <button type="button" class="mob-cname mob-cname-button" @click="browseDrivers">{{ fullName || 'No driver selected' }}</button>
    </div>
    <div class="mob-cbtns">
      <button type="button" class="mob-btn mob-btn-primary" @click="browseDrivers">Select driver</button>
      <PhoneButton class="mob-btn-secondary mob-driver-info" title="View information about this project’s driver" @click="showDriverInfo">Info</PhoneButton>
      <button type="button" class="mob-btn mob-btn-secondary" @click="editDriver">Edit</button>
    </div>
    <PhoneBand :section="PhoneHelp.DRIVER" />
    <div class="mob-crow">
      <label class="mob-crow-label" for="mob-n-drivers">{{ PhoneLabels.DRIVERS }}</label>
      <select id="mob-n-drivers" class="mob-cselect" :value="project.nDrivers.value"
              @change="e => { const n = selectedOption(e, N_DRIVERS_OPTIONS); if (n !== null) project.nDrivers.set(n); }">
        <option v-for="o in N_DRIVERS_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </div>
    <div class="mob-crow">
      <label class="mob-crow-label" for="mob-wiring">{{ PhoneLabels.CONNECTION }}</label>
      <select id="mob-wiring" class="mob-cselect" :value="project.wiring.value"
              @change="e => { const w = selectedOption(e, ARRAY_WIRING_OPTIONS); if (w !== null) project.wiring.set(w); }">
        <option v-for="o in ARRAY_WIRING_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </div>

    <PhoneBand :section="PhoneHelp.KEY_FIGURES" />
    <!-- Tapping a key figure opens the driver editor (the mock's Key figures help: "Tap one to edit the driver."). -->
    <UIFixedField class="mob-ui-field mob-ui-field-tap" @click="editDriver" @keydown.enter="editDriver" :field="NumberField.FS_HZ" label="Fs" :value="keyFigures.Fs" readonly plain />
    <UIFixedField class="mob-ui-field mob-ui-field-tap" @click="editDriver" @keydown.enter="editDriver" :field="NumberField.QTS" label="Qts" :value="keyFigures.Qts" readonly plain />
    <UIFixedField class="mob-ui-field mob-ui-field-tap" @click="editDriver" @keydown.enter="editDriver" :field="NumberField.VAS_M3" label="Vas" :value="keyFigures.Vas" readonly plain />
    <UIFixedField class="mob-ui-field mob-ui-field-tap" @click="editDriver" @keydown.enter="editDriver" :field="NumberField.RE_OHM" label="Re" :value="keyFigures.Re" readonly plain />
    <UIFixedField class="mob-ui-field mob-ui-field-tap" @click="editDriver" @keydown.enter="editDriver" :field="NumberField.XMAX_M" label="Xmax" :value="keyFigures.Xmax" readonly plain />
  </PhoneClassicPage>
</template>

<style scoped>
.mob-driver-info { flex: 0 0 var(--mob-button-h); padding: 0; }
</style>
