<script setup>
import { onMounted, onUnmounted } from 'vue';
import AppHeader from './components/AppHeader.vue';
import SidePanel from './components/SidePanel.vue';
import GraphArea from './components/GraphArea.vue';
import StatBar from './components/StatBar.vue';
import DriverBrowser from './components/DriverBrowser.vue';
import Flash from './components/Flash.vue';
import { state } from './store.js';
import { loadFromHash, loadLocal } from './utils/persist.js';
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

onMounted(() => {
  const fromUrl = loadFromHash();
  if (!fromUrl) {
    const local = loadLocal();
    if (local) applyState(local);
  } else {
    applyState(fromUrl);
  }
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
