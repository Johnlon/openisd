<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue';
import ModernShell from './shells/modern/ModernShell.vue';
import ClassicShell from './shells/classic/ClassicShell.vue';
import OriginalShell from './shells/original/OriginalShell.vue';
import DriverBrowser from './components/DriverBrowser.vue';
import Flash from './components/Flash.vue';
import { state, driverJSON, setDriverFromSerialized, markProjectSaved } from './store.js';
import { serialize, loadFromHash, loadLocal, saveLocal } from './utils/persist.js';
import { runSelfTest } from './utils/selftest.js';
import { resolveSkin } from './skins.js';
import type { SerializedState } from './types.js';

// App.vue is the shell-agnostic root: it owns app lifecycle (persist / hash / self-test)
// and the global overlays, and swaps the presentation shell by resolved skin. The shells
// only arrange the shared components — no lifecycle or logic is duplicated per skin.
const shellComponent = computed(() => {
  const shell = resolveSkin(state.ui.skin);
  if (shell === 'classic') return ClassicShell;
  if (shell === 'original') return OriginalShell;
  return ModernShell;
});

async function handleHashChange() {
  const saved = await loadFromHash();
  if (saved) applyState(saved);
}

function applyState(o: SerializedState) {
  if (o.driver) setDriverFromSerialized(o.driver);
  if (o.box) state.box = o.box;
  if (o.P) Object.assign(state.P, o.P);
  if (Array.isArray(o.graphs) && o.graphs.length) state.graphs = o.graphs;
  if (o.ui) Object.assign(state.ui, o.ui);   // skin + active tab/chart ARE carried by a share link (stateToUrl); only an open editor's uncommitted buffer + unit prefs are stripped there
  if (o.project) Object.assign(state.project, o.project);
  if (o.cursor) {
    state.cursorF = o.cursor.f;
    state.pinnedF = o.cursor.pinnedF;
    state.cursorLocked = o.cursor.locked;
  }
}

let saveReady = false;
watch(
  () => serialize(state, driverJSON.value, state.compare),
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
  runSelfTest();
  window.addEventListener('hashchange', handleHashChange);
});

onUnmounted(() => {
  window.removeEventListener('hashchange', handleHashChange);
});
</script>

<template>
  <component :is="shellComponent" />
  <DriverBrowser />
  <Flash />
</template>
