<script setup lang="ts">
// The WinISD Compatibility presets, in both shells: one button per preset and the preset the
// project matches now (or "Custom"). The presets and what each sets live in the design package
// (`CompatPreset`); this component only renders them. The default slot is the panel's title, shown
// on the same line as the match.
import {useCompatPresets} from '../../hooks/CompatPresets-hooks.js';

const {presets, current, currentLabel, apply} = useCompatPresets();
</script>

<template>
  <div class="compat-presets">
    <div class="compat-presets-head"><slot /><span class="compat-preset-match">Now: <span class="compat-preset-match-label">{{ currentLabel }}</span></span></div>
    <div class="compat-preset-buttons" role="group" aria-label="WinISD compatibility presets">
      <button v-for="p in presets" :key="p.label" type="button" class="compat-preset-btn"
              :class="{ 'compat-preset-current': current === p }" :aria-pressed="current === p"
              :title="p.description" @click="apply(p)">{{ p.label }}</button>
    </div>
  </div>
</template>

<style>
.compat-presets { display: flex; flex-direction: column; gap: 2px; margin-bottom: 3px; }
.compat-presets-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.compat-preset-buttons { display: flex; flex-wrap: wrap; gap: 3px; }
.compat-preset-btn { font: inherit; font-size: 11px; padding: 1px 6px; cursor: pointer; }
.compat-preset-btn.compat-preset-current { font-weight: 600; outline: 1px solid #3a6fb0; }
.compat-preset-match { font-size: 11px; font-weight: normal; color: #555; }
.compat-preset-match-label { font-weight: 600; }
</style>
