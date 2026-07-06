<script setup lang="ts">
/**
 * Modern shell — today's OpenISD layout: header + side panel + multi-graph grid +
 * stat bar, with the narrow-screen Controls|Graphs toggle. Extracted verbatim from
 * App.vue when skins were introduced; behaviour is unchanged. Owns only presentation
 * (the responsive/collapse state); app lifecycle (persist/hash/self-test) stays in
 * App.vue above every shell, and the DriverBrowser/Flash overlays are global there.
 */
import { ref, onMounted, onUnmounted } from 'vue';
import AppHeader from '../../components/AppHeader.vue';
import SidePanel from '../../components/SidePanel.vue';
import GraphArea from '../../components/GraphArea.vue';
import StatBar from '../../components/StatBar.vue';

const mobileTab = ref('graphs');
const isMobile = ref(false);
const sideCollapsed = ref(false);
const MQ = typeof window !== 'undefined' ? window.matchMedia('(max-width: 720px)') : null;
function onMqChange(e: MediaQueryListEvent) { isMobile.value = e.matches; }

onMounted(() => {
  if (MQ) { isMobile.value = MQ.matches; MQ.addEventListener('change', onMqChange); }
});
onUnmounted(() => {
  if (MQ) MQ.removeEventListener('change', onMqChange);
});
</script>

<template>
  <AppHeader />
  <div v-if="isMobile" class="mob-tabs">
    <button :class="{ active: mobileTab === 'controls' }" title="Show driver and box controls" @click="mobileTab = 'controls'">Controls</button>
    <button :class="{ active: mobileTab === 'graphs' }" title="Show simulation graphs" @click="mobileTab = 'graphs'">Graphs</button>
  </div>
  <div class="layout">
    <div id="side" class="side" :class="{ 'side--collapsed': sideCollapsed, 'mob-hidden': isMobile && mobileTab !== 'controls' }">
      <button class="side-toggle"
              @click="sideCollapsed = !sideCollapsed"
              :title="sideCollapsed ? 'Expand controls panel' : 'Collapse controls panel'">
        {{ sideCollapsed ? '› expand' : '‹‹ collapse' }}
      </button>
      <div class="side-body" v-show="!sideCollapsed">
        <SidePanel />
      </div>
    </div>
    <div class="main" :class="{ 'mob-hidden': isMobile && mobileTab !== 'graphs' }">
      <GraphArea />
      <StatBar />
    </div>
  </div>
</template>
