<script setup lang="ts">
// The "Reset to WinISD" button, in both shells. The default slot is the panel's title, shown on
// the same line.
import {useResetToWinisd} from '../../hooks/ResetToWinisd-hooks.js';

const {label, tooltip, reset} = useResetToWinisd();
</script>

<template>
  <div class="compat-reset">
    <slot />
    <button type="button" class="compat-reset-btn" :title="tooltip" @click="reset">{{ label }}</button>
  </div>
</template>

<style>
.compat-reset { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 3px; }
.compat-reset-btn { font: inherit; font-size: 11px; padding: 1px 6px; cursor: pointer; }
</style>
