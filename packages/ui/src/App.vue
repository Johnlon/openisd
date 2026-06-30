<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import AppHeader from './components/AppHeader.vue';
import SidePanel from './components/SidePanel.vue';
import GraphArea from './components/GraphArea.vue';
import StatBar from './components/StatBar.vue';
import DriverBrowser from './components/DriverBrowser.vue';
import Flash from './components/Flash.vue';
import { state, driver } from './store.js';
import { serialize, loadFromHash, loadLocal, saveLocal } from './utils/persist.js';
import { runSelfTest } from './utils/selftest.js';

const mobileTab = ref('graphs');
const isMobile = ref(false);
const MQ = typeof window !== 'undefined' ? window.matchMedia('(max-width: 720px)') : null;
function onMqChange(e) { isMobile.value = e.matches; }

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
  if (MQ) { isMobile.value = MQ.matches; MQ.addEventListener('change', onMqChange); }
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
  if (MQ) MQ.removeEventListener('change', onMqChange);
  window.removeEventListener('hashchange', handleHashChange);
});
</script>

<template>
  <AppHeader />
  <div v-if="isMobile" class="mob-tabs">
    <button :class="{ active: mobileTab === 'controls' }" title="Show driver and box controls" @click="mobileTab = 'controls'">Controls</button>
    <button :class="{ active: mobileTab === 'graphs' }" title="Show simulation graphs" @click="mobileTab = 'graphs'">Graphs</button>
  </div>
  <div class="layout">
    <div id="side" class="side" :class="{ 'mob-hidden': isMobile && mobileTab !== 'controls' }">
      <SidePanel />
    </div>
    <div class="main" :class="{ 'mob-hidden': isMobile && mobileTab !== 'graphs' }">
      <GraphArea />
      <StatBar />
    </div>
  </div>
  <DriverBrowser />
  <Flash />
</template>
