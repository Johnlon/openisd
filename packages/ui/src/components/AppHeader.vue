<script setup lang="ts">
import { ref } from 'vue';
import { useDesignIO } from '../composables/useDesignIO.js';
import SkinPicker from './SkinPicker.vue';

// File I/O is shared with the classic skin's toolbar via one composable — no duplication.
const { shareLink, exportDesign, exportWdr, importFile, about: showAbout } = useDesignIO();

const fileInput = ref<HTMLInputElement | null>(null);
function importClick() { fileInput.value!.click(); }
function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0];
  if (f) importFile(f);
  input.value = '';
}
</script>

<template>
  <header>
    <img class="logo" src="/icon.svg" alt="OpenISD" width="28" height="28">
    <h1>OpenISD<span style="color:var(--acc)"> ~</span> &nbsp;
      <small>open loudspeaker enclosure simulator · community-owned · runs anywhere</small>
    </h1>
    <div class="sp"></div>
    <button @click="importClick" title="Import a WinISD .wdr driver file or an OpenISD .json project file">Import .wdr / project</button>
    <button @click="exportWdr" title="Export the current driver parameters as a WinISD-compatible .wdr file">Export driver .wdr</button>
    <button id="btnShare" @click="shareLink" title="Copy a shareable URL that encodes the current design — paste into a forum or send to a colleague">Share link</button>
    <button @click="exportDesign" title="Export the full design (driver + box + settings) as an OpenISD .json project file">Export design</button>
    <button @click="showAbout" title="About OpenISD — version, licence, and contributors">About</button>
    <SkinPicker />
    <input ref="fileInput" type="file" accept=".wdr,.json" style="display:none" @change="onFileChange">
  </header>
</template>
