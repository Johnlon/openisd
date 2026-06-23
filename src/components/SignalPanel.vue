<script setup>
import { computed } from 'vue';
import { state, driver } from '../store.js';

const drv = driver;
const driveV = computed(() => Math.sqrt((state.P.Pin ?? 1) * (drv.value.Z || drv.value.Re || 8)));
</script>

<template>
  <fieldset>
    <legend>Signal &amp; drivers</legend>
    <div class="row">
      <label>Input power</label>
      <input type="number" step="any" :value="state.P.Pin" @input="e => state.P.Pin = parseFloat(e.target.value)||1">
      <span class="u">W</span>
    </div>
    <div class="row">
      <label>Drive voltage @ {{ (drv.Z||drv.Re).toFixed(1) }}Ω</label>
      <span style="width:96px;text-align:right;color:var(--acc2)">{{ driveV.toFixed(2) }} V</span>
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
