<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue';
import ModernShell from './shells/modern/ModernShell.vue';
import ClassicShell from './shells/classic/ClassicShell.vue';
import OriginalShell from './shells/original/OriginalShell.vue';
import DriverBrowserMd from './components/DriverBrowserMd.vue';
import DriverBrowserWinisd from './components/DriverBrowserWinisd.vue';
import DriverEditorModal from './components/DriverEditorModal.vue';
import Flash from './components/Flash.vue';
import { flash } from '../logging/flash.js';
import { state, driverJSON, applyState, markProjectSaved } from '../logic/store.js';
import { serialize, loadFromHash, loadLocal, saveLocal } from '../logic/persist.js';
import { runSelfTest } from '../diagnostics/selftest.js';
import { resolveSkin } from './skins.js';

// App.vue is the shell-agnostic root: it owns app lifecycle (persist / hash / self-test)
// and the global overlays, and swaps the presentation shell by resolved skin. The shells
// only arrange the shared components — no lifecycle or logic is duplicated per skin.
const shellComponent = computed(() => {
  const shell = resolveSkin(state.ui.skin);
  if (shell === 'classic') return ClassicShell;
  if (shell === 'original') return OriginalShell;
  return ModernShell;
});

const isTest = typeof window !== 'undefined' && window.location.port === '4100';

const browserComponent = computed(() => {
  const shell = resolveSkin(state.ui.skin);
  if (shell === 'original' || shell === 'classic') return DriverBrowserWinisd;
  return DriverBrowserMd;
});

watch(
  () => resolveSkin(state.ui.skin),
  (newSkin) => {
    if (!isTest && newSkin !== 'original') {
      flash(`Warning: The ${newSkin} skin is unfinished work.`);
    }
  }
);

async function handleHashChange() {
  const saved = await loadFromHash();
  if (saved) applyState(saved);
}

let saveReady = false;
watch(
  () => serialize(state, driverJSON.value),
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
  <div :class="'skin-' + resolveSkin(state.ui.skin)" style="display: contents;">
    <div v-if="!isTest && resolveSkin(state.ui.skin) !== 'original'" class="unfinished-warning-banner" style="background: #fff3cd; color: #856404; border-bottom: 1px solid #ffeeba; padding: 10px; text-align: center; font-weight: bold; position: relative; z-index: 9999; font-family: sans-serif; font-size: 14px; flex-shrink: 0; width: 100%; box-sizing: border-box;">
      WARNING: The {{ resolveSkin(state.ui.skin) }} skin is unfinished work.
    </div>
    <component :is="shellComponent" />
    <component :is="browserComponent" />
    <!-- The driver editor is global: every skin gets the same dialog, so a driver picked
         from the library is always reviewed before it reaches the design. -->
    <DriverEditorModal v-if="state.editDriverInfo" @close="state.editDriverInfo = false" />
    <Flash />
  </div>
</template>
