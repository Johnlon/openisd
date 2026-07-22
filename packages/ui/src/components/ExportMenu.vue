<script setup lang="ts">
/**
 * The combined Save-As / Export menu — every project output that isn't the in-place
 * "Save" action, shared by every skin so the four actions stay identical everywhere:
 * Save As (native .openisd.json, via the File System Access API), Save as a WinISD .wpr
 * project, export the driver as .wdr, and copy a share link. Self-contained: styled off
 * the app's shared CSS vars (--panel/--fg/--line/--acc), which each skin overrides on its
 * root, so this adapts automatically without per-skin styling.
 */
import { ref, onMounted, onUnmounted } from 'vue';
import { useDesignIO } from '../composables/useDesignIO.js';

const { saveProjectAs, exportWpr, exportWdr, shareLink } = useDesignIO();
const open = ref(false);
function toggle(): void { open.value = !open.value; }
function close(): void { open.value = false; }
onMounted(() => document.addEventListener('click', close));
onUnmounted(() => document.removeEventListener('click', close));
</script>

<template>
  <div class="export-menu" @click.stop>
    <button type="button" id="btnExportMenu" class="export-menu-trigger" @click="toggle"
            title="Save As / Export — OpenISD project, WinISD project, driver file, or a share link">
      <slot>Save As / Export ▾</slot>
    </button>
    <div v-if="open" class="export-menu-list">
      <button type="button" title="Pick a new file to write the design as an OpenISD .json project" @click="saveProjectAs(); close()">Save as OpenISD project (.json)</button>
      <button type="button" title="Export the full design as a WinISD-compatible .wpr project file" @click="exportWpr(); close()">Save as WinISD project (.wpr)</button>
      <button type="button" title="Export the current driver parameters as a WinISD-compatible .wdr file" @click="exportWdr(); close()">Export driver (.wdr)</button>
      <button type="button" id="btnShare" title="Copy a shareable URL that encodes the current design, skin, and tab" @click="shareLink(); close()">Share link (http:)</button>
    </div>
  </div>
</template>

<style scoped>
.export-menu { position: relative; display: inline-block; }
/* Trigger inherits ambient button styling by default (Modern's plain <button>); a caller
   passing an icon via the default slot (Classic/Original) sizes/positions its own SVG —
   this rule only supplies layout, never overrides a slotted icon's own look. */
.export-menu-trigger { display: inline-flex; align-items: center; }
.export-menu-list {
  position: absolute; top: 100%; left: 0; z-index: 50; margin-top: 2px;
  background: var(--panel); border: 1px solid var(--line); box-shadow: 2px 3px 8px rgba(0,0,0,.25);
  min-width: 240px; padding: 4px 0; display: flex; flex-direction: column;
}
.export-menu-list button {
  all: unset; padding: 6px 14px; cursor: pointer; white-space: nowrap; color: var(--fg); font-size: inherit;
}
.export-menu-list button:hover { background: var(--acc); color: #fff; }
</style>
