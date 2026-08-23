<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue';
import OriginalShell from './shells/original/OriginalShell.vue';
import DriverBrowserWinisd from './components/DriverBrowserWinisd.vue';
import DriverEditorModal from './components/DriverEditorModal.vue';
import Flash from './components/Flash.vue';
import DiagnosticsModal from './components/DiagnosticsModal.vue';
import { managedProject, applyState, markProjectSaved, currentProjectWrite } from '../logic/appState.js';
import { presentationState } from '../logic/presentationState.js';
import { createLiveRef } from '../logic/liveProject.js';
import { useApp } from '../logic/app.js';

const { diagnostics, projectRepo } = useApp();

// App.vue is the shell-agnostic root: it owns app lifecycle (persist / hash / self-test)
// and the global overlays. The shell only arranges the shared components — no lifecycle or
// logic lives here twice.

async function handleHashChange() {
  const saved = await projectRepo.loadFromHash();
  if (saved) applyState(saved);
}

let saveReady = false;
// `managedProject.toUiParams()` — never `syncedP.value` (`SyncedParams = UiParams & {eg, Sp,
// Leff}`): the persisted/shared wire field is `UiParams` alone, and a second shape carrying
// DERIVED values (`eg`/`Sp`/`Leff`, recomputed from the rest on load) would be a second
// answer to the same question the moment either drifted from the other on restore.
const { live } = createLiveRef(managedProject);
watch(
  () => { void live.value; return currentProjectWrite(); },
  (s) => { if (saveReady) projectRepo.saveLocal(s); },
  { deep: true },
);

onMounted(async () => {
  const fromUrl = await projectRepo.loadFromHash();
  if (!fromUrl) {
    const local = projectRepo.loadLocal();
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
  <DriverEditorModal v-if="presentationState.editDriverInfo" @close="presentationState.editDriverInfo = false" />
  <Flash />
  <!-- Raises itself on the first uncaught error, rejection or console.error. -->
  <DiagnosticsModal />
</template>
