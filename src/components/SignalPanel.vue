<script setup>
import { computed } from 'vue';
import { state, driver } from '../store.js';

const drv = driver;
// WinISD convention: V = sqrt(Pin × Re) — Rs is in the circuit but not the voltage reference
const driveV  = computed(() => Math.sqrt((state.P.Pin ?? 1) * (drv.value.Re || 8)));
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
    <div class="row" title="Input power. Drive voltage = √(Pin × (Re + Rs)), matching WinISD convention.">
      <label>Input power</label>
      <input type="number" step="any" :value="state.P.Pin" @input="e => state.P.Pin = parseFloat(e.target.value)||1">
      <span class="u">W</span>
    </div>
    <div class="row" title="Series resistance (wire, crossover DCR, amplifier output impedance). WinISD default is 0.1 Ω.">
      <label>Series resistance</label>
      <input type="number" step="0.01" min="0" :value="state.P.Rs" @input="e => state.P.Rs = parseFloat(e.target.value)||0">
      <span class="u">Ω</span>
    </div>
    <div class="row" title="Drive voltage applied to the circuit. Matches WinISD's 'Driver input voltage (each)'.">
      <label>Drive voltage</label>
      <span style="width:96px;text-align:right;color:var(--acc2)">{{ driveV.toFixed(3) }} V</span>
      <span class="u"></span>
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
