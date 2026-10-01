<script setup lang="ts">
// The mobile Signal tab — input power, drive voltage, series resistance. Thin: all state and
// domain reads/writes live in useMobileSignalTab() (src/hooks/MobileSignalTab-hooks.ts).
import {NumberField} from '@openisd/design/fields';
import NumInput from '../../components/NumInput.vue';
import { useMobileSignalTab } from '../../../hooks/MobileSignalTab-hooks.js';

const { driveV, reconcileDriveV, powerLocked, rsOhm, powerDq, voltageDq, power_W, setPower } = useMobileSignalTab();
</script>

<template>
  <div class="mob-panel">
    <div class="mob-panel-head">Signal</div>
    <div class="mob-field-row mob-field-entered" :class="{ 'mob-field-dq': powerDq.dq.length > 0 }">
      <div class="mob-field-main">
        <span class="mob-field-label">System input power</span>
        <span class="mob-field-value">
          <NumInput :field="NumberField.SIGNAL_PIN_W" :readonly="powerLocked" :model-value="power_W" @update:model-value="setPower" :precision="NumberField.SIGNAL_PIN_W.precision" stepper />
        </span>
        <span v-if="powerDq.dq.length" class="mob-field-dq-note">{{ powerDq.dq[0] }}</span>
      </div>
      <span class="mob-unit">W</span>
    </div>

    <div class="mob-field-row mob-field-entered" :class="{ 'mob-field-dq': voltageDq.dq.length > 0 }">
      <div class="mob-field-main">
        <span class="mob-field-label">Driver input voltage (each)</span>
        <span class="mob-field-value">
          <NumInput :field="NumberField.SIGNAL_DRIVEV_V" v-model="driveV" :precision="NumberField.SIGNAL_DRIVEV_V.precision" @blur-notify="reconcileDriveV" stepper />
        </span>
      </div>
      <span class="mob-unit">V</span>
    </div>

    <div class="mob-field-row mob-field-entered">
      <div class="mob-field-main">
        <span class="mob-field-label">Series resistance</span>
        <span class="mob-field-value"><NumInput v-model="rsOhm" :precision="NumberField.SIGNAL_RS_OHM.precision" stepper /></span>
      </div>
      <span class="mob-unit">ohm</span>
    </div>
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
.mob-field-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px 10px 14px;
  min-height: 48px;
  border-left: 3px solid transparent;
  border-top: 1px solid var(--line);
}
.mob-field-row:first-of-type { border-top: none; }
.mob-field-entered { border-left-color: var(--good); }
.mob-field-dq { border-left-color: var(--acc2); }
.mob-field-main { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.mob-field-label { font-size: 13px; color: var(--mut); }
.mob-field-value { font-size: 18px; font-variant-numeric: tabular-nums; display: flex; align-items: center; gap: 6px; }
.mob-field-value :deep(input) {
  border: none;
  background: transparent;
  font: inherit;
  font-size: 18px;
  color: var(--fg);
  padding: 0;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 32px;
}
.mob-field-dq-note { font-size: 12px; color: var(--acc2); }
.mob-unit { font-size: 13px; color: var(--mut); }
</style>
