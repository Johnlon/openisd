<script setup lang="ts">
/**
 * Skin picker — one shared control mounted in each shell's own chrome (the modern
 * header, the classic toolbar). Writes the local-only `state.ui.skin`; App.vue swaps
 * the shell in response. Never duplicated per skin.
 */
import { state } from '../store.js';
import { SKIN_IDS, SKIN_LABELS } from '../skins.js';
</script>

<template>
  <label class="skin-picker"
         title="Interface style, remembered on this device only. Auto adapts to your screen; Classic recreates the WinISD 0.7 desktop window; Modern is the standard OpenISD layout.">
    <span class="skin-lbl">Skin</span>
    <select v-model="state.ui.skin"
            title="Switch the interface style — Auto, Classic (WinISD), or Modern. Saved locally, not part of a shared design link.">
      <option v-for="id in SKIN_IDS" :key="id" :value="id">{{ SKIN_LABELS[id] }}</option>
    </select>
  </label>
</template>

<style scoped>
.skin-picker { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: var(--mut); }
.skin-lbl { text-transform: uppercase; letter-spacing: .06em; }
.skin-picker select {
  font: inherit; font-size: 11px; padding: 2px 5px;
  background: var(--panel2); color: var(--fg);
  border: 1px solid var(--line); border-radius: 4px; cursor: pointer;
}
.skin-picker select:focus { outline: none; border-color: var(--acc); }
</style>
