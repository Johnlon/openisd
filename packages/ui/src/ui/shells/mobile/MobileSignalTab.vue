<script setup lang="ts">
// The mobile Signal tab — input power, drive voltage, series resistance, each a UIField row.
// Thin: domain reads/writes live in useMobileSignalTab() (src/hooks/MobileSignalTab-hooks.ts).
import {NumberField, PhoneHelp, PhoneLabels} from '@openisd/design/fields';
import UIField from '../../components/UIField.vue';
import UIFixedField from '../../components/UIFixedField.vue';
import PhoneBand from './PhoneBand.vue';
import PhoneClassicPage from './PhoneClassicPage.vue';
import { useMobileSignalTab } from '../../../hooks/MobileSignalTab-hooks.js';

const { project, powerLocked, rsOhm } = useMobileSignalTab();
</script>

<template>
  <PhoneClassicPage>
    <PhoneBand :section="PhoneHelp.SIGNAL" />
    <UIField class="mob-ui-field" :field="NumberField.SIGNAL_PIN_W" :label="PhoneLabels.POWER" :cell="project.powerDrive_W" :readonly="powerLocked" stepper />
    <UIField class="mob-ui-field" :field="NumberField.SIGNAL_DRIVEV_V" :label="PhoneLabels.VOLTS" :cell="project.driveVoltage_V" stepper />
    <UIFixedField class="mob-ui-field" :field="NumberField.SIGNAL_RS_OHM" :label="PhoneLabels.RS" :value="rsOhm" stepper @update:value="v => project.Rs_ohm.set(v)" />
  </PhoneClassicPage>
</template>
