<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue';
import OriginalShell from './shells/original/OriginalShell.vue';
import DriverBrowserWinisd from './components/DriverBrowserWinisd.vue';
import DriverEditorModal from './components/DriverEditorModal.vue';
import Flash from './components/Flash.vue';
import { state, driverRecord, applyState, markProjectSaved } from '../logic/store.js';
import { serialize, loadFromHash, loadLocal, saveLocal } from '../logic/persist.js';
import { useApp } from '../logic/app.js';

const { diagnostics } = useApp();

// App.vue is the shell-agnostic root: it owns app lifecycle (persist / hash / self-test)
// and the global overlays. The shell only arranges the shared components — no lifecycle or
// logic lives here twice.

async function handleHashChange() {
  const saved = await loadFromHash();
  if (saved) applyState(saved);
}

let saveReady = false;
watch(
  () => serialize(state, driverRecord.value),
  (s) => { if (saveReady) saveLocal(s); },
  { deep: true },
);

onMounted(async () => {
  const fromUrl = await loadFromHash();
  if (!fromUrl) {
    const local = loadLocal();
    if (local) applyState(local);
  } else {
    applyState(fromUrl);
  }
  markProjectSaved();   // the just-loaded design is the ground state (clean, not modified)
  saveReady = true;
  diagnostics.run();
  window.addEventListener('hashchange', handleHashChange);
});

onUnmounted(() => {
  window.removeEventListener('hashchange', handleHashChange);
});
</script>

<template>
  <OriginalShell />
  <DriverBrowserWinisd />
  <!-- The driver editor is global, so a driver picked from the library is always
       reviewed before it reaches the design. -->
  <DriverEditorModal v-if="state.editDriverInfo" @close="state.editDriverInfo = false" />
  <Flash />
</template>
