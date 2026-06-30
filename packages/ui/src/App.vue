<script setup>
import { onMounted, onUnmounted, watch } from 'vue';
import AppHeader from './components/AppHeader.vue';
import SidePanel from './components/SidePanel.vue';
import GraphArea from './components/GraphArea.vue';
import StatBar from './components/StatBar.vue';
import DriverBrowser from './components/DriverBrowser.vue';
import Flash from './components/Flash.vue';
import { state, driver } from './store.js';
import { serialize, loadFromHash, loadLocal, saveLocal } from './utils/persist.js';
import { runSelfTest } from './utils/selftest.js';

function handleHashChange() {
  const saved = loadFromHash();
  if (saved) applyState(saved);
}

function applyState(o) {
  if (o.driver) state.driverRaw = o.driver;
  if (o.box) state.box = o.box;
  if (o.P) Object.assign(state.P, o.P);
  if (Array.isArray(o.graphs) && o.graphs.length) state.graphs = o.graphs;
}

let saveReady = false;
watch(
  () => serialize(state, driver.value, state.compare),
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
  <AppHeader />
  <div class="layout">
    <div id="side" class="side">
      <SidePanel />
    </div>
    <div class="main">
      <GraphArea />
      <StatBar />
    </div>
  </div>
  <DriverBrowser />
  <Flash />
</template>
