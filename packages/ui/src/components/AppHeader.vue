<script setup lang="ts">
import { ref } from 'vue';
import { useDesignIO } from '../composables/useDesignIO.js';
import ExportMenu from './ExportMenu.vue';
import SkinPicker from './SkinPicker.vue';
import OptionsModal from './OptionsModal.vue';

// File I/O is shared with every skin's chrome via one composable — no duplication.
const { saveProject, importFile, about: showAbout } = useDesignIO();
const optionsOpen = ref(false);

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
    <button @click="saveProject" title="Save — write the design as an OpenISD .json project to the file you picked (or pick one now)">Save</button>
    <ExportMenu />
    <button @click="showAbout" title="About OpenISD — version, licence, and contributors">About</button>
    <button @click="optionsOpen = true" title="Options">Options</button>
    <SkinPicker />
    <input ref="fileInput" type="file" accept=".wdr,.json" style="display:none" @change="onFileChange">
    <OptionsModal v-if="optionsOpen" @close="optionsOpen = false" />
  </header>
</template>
