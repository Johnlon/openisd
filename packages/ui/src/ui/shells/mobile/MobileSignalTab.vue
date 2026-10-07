<script setup lang="ts">
// The mobile Signal tab — input power, drive voltage, series resistance, each a UIField row.
// Thin: domain reads/writes live in useMobileSignalTab() (src/hooks/MobileSignalTab-hooks.ts).
import {NumberField} from '@openisd/design/fields';
import UIField from '../../components/UIField.vue';
import UIFixedField from '../../components/UIFixedField.vue';
import { useMobileSignalTab } from '../../../hooks/MobileSignalTab-hooks.js';

const { project, powerLocked, rsOhm } = useMobileSignalTab();
</script>

<template>
  <div class="mob-panel">
    <div class="mob-panel-head">Signal</div>
    <UIField class="mob-ui-field" :field="NumberField.SIGNAL_PIN_W" :cell="project.powerDrive_W" :readonly="powerLocked" stepper />
    <UIField class="mob-ui-field" :field="NumberField.SIGNAL_DRIVEV_V" :cell="project.driveVoltage_V" stepper />
    <UIFixedField class="mob-ui-field" :field="NumberField.SIGNAL_RS_OHM" :value="rsOhm" stepper @update:value="v => project.Rs_ohm.set(v)" />
  </div>
</template>

<style scoped>
.mob-panel {
  margin: 12px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 4px;
  overflow: hidden;
}
.mob-panel-head {
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--mut);
  border-bottom: 1px solid var(--line);
  background: var(--panel2);
}
</style>
