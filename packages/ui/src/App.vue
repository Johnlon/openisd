<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue';
import ModernShell from './shells/modern/ModernShell.vue';
import ClassicShell from './shells/classic/ClassicShell.vue';
import DriverBrowser from './components/DriverBrowser.vue';
import Flash from './components/Flash.vue';
import { state, driverJSON, setDriverFromSerialized } from './store.js';
import { serialize, loadFromHash, loadLocal, saveLocal } from './utils/persist.js';
import { runSelfTest } from './utils/selftest.js';
import { resolveSkin } from './skins.js';
import type { SerializedState } from './types.js';

// App.vue is the shell-agnostic root: it owns app lifecycle (persist / hash / self-test)
// and the global overlays, and swaps the presentation shell by resolved skin. The shells
// only arrange the shared components — no lifecycle or logic is duplicated per skin.
const shellComponent = computed(() =>
  resolveSkin(state.ui.skin) === 'classic' ? ClassicShell : ModernShell,
);

function handleHashChange() {
  const saved = loadFromHash();
  if (saved) applyState(saved);
}

function applyState(o: SerializedState) {
  if (o.driver) setDriverFromSerialized(o.driver);
  if (o.box) state.box = o.box;
  if (o.P) Object.assign(state.P, o.P);
  if (Array.isArray(o.graphs) && o.graphs.length) state.graphs = o.graphs;
  if (o.ui) Object.assign(state.ui, o.ui);   // local-only prefs: skin + classic tab state (never from a shared URL — stripped there)
  if (o.project) Object.assign(state.project, o.project);
}

let saveReady = false;
watch(
  () => serialize(state, driverJSON.value, state.compare),
  (s) => { if (saveReady) saveLocal(s); },
  { deep: true },
);

onMounted(() => {
  const fromUrl = loadFromHash();
  if (!fromUrl) {
    const local = loadLocal();
    if (local) applyState(local);
  } else {
    applyState(fromUrl);
  }
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
