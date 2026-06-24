<script setup>
import { computed } from 'vue';
import { state, driver } from '../store.js';

const drv = driver;

const driveV = computed(() => Math.sqrt((state.P.Pin ?? 1) * (drv.value.Re || 8)));

function onVoltageInput(e) {
  const v = parseFloat(e.target.value);
  if (isFinite(v) && v > 0) state.P.Pin = (v * v) / (drv.value.Re || 8);
}

function setIEC() {
  state.P.Pin = (2.83 * 2.83) / (drv.value.Re || 8);
}
</script>

<template>
  <fieldset>
    <legend>Signal &amp; drivers</legend>
    <div class="row" title="WinISD: Le excluded from acoustic circuit — matches WinISD output exactly. Full gyrator: Le included in acoustic drive — physically more complete but diverges slightly from WinISD.">
      <label>Circuit model</label>
      <select v-model="state.P.circuitModel" style="flex:1">
        <option value="winisd">WinISD (Le acoustic-only)</option>
        <option value="gyrator">Full gyrator (Le everywhere)</option>
      </select>
    </div>
    <div class="row" title="Input power. Changing this updates the drive voltage below.">
      <label>Input power</label>
      <input type="number" step="any" min="0" :value="state.P.Pin" @input="e => state.P.Pin = parseFloat(e.target.value)||1">
      <span class="u">W</span>
    </div>
    <div class="row" title="Drive voltage = √(Pin × Re). Edit directly to set an exact voltage — input power updates automatically. Use 2.83V for IEC 60268-5 sensitivity reference (1W into 8Ω).">
      <label>Drive voltage</label>
      <input class="v-input" type="number" step="0.01" min="0"
             :value="driveV.toFixed(3)"
             @change="onVoltageInput">
      <span class="u">V</span>
      <button class="iec-btn" @click="setIEC" title="Set to 2.83V — IEC 60268-5 sensitivity standard">2.83V</button>
    </div>
    <div class="row" title="Series resistance (wire, crossover DCR, amplifier output impedance). WinISD default is 0.1 Ω.">
      <label>Series resistance</label>
      <input type="number" step="0.01" min="0" :value="state.P.Rs" @input="e => state.P.Rs = parseFloat(e.target.value)||0">
      <span class="u">Ω</span>
    </div>
    <div class="row">
      <label>No. of drivers</label>
      <input type="number" step="1" :value="state.P.nDrivers" @input="e => state.P.nDrivers = parseInt(e.target.value)||1">
      <span class="u"></span>
    </div>
    <div class="row">
      <label>Wiring</label>
      <select v-model="state.P.wiring" style="flex:1">
        <option value="parallel">Parallel</option>
        <option value="series">Series</option>
      </select>
    </div>
  </fieldset>
</template>

<style scoped>
.v-input {
  flex: 1;
  min-width: 0;
}
.iec-btn {
  font-size: 11px;
  padding: 1px 6px;
  margin-left: 3px;
  background: none;
  border: 1px solid var(--mut);
  border-radius: 3px;
  color: var(--mut);
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}
.iec-btn:hover { color: var(--acc); border-color: var(--acc); }
</style>
