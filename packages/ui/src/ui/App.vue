<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue';
import OriginalShell from './shells/original/OriginalShell.vue';
import DriverBrowserWinisd from './components/DriverBrowserWinisd.vue';
import DriverEditorModal from './components/DriverEditorModal.vue';
import Flash from './components/Flash.vue';
import DiagnosticsModal from './components/DiagnosticsModal.vue';
import {
  focusedProject, requireFocusedProject, projectChanged, OpenISDProject,
  applyState, applyViewSnapshot,
  markProjectSaved,
} from '../logic/appState.js';
import { presentationState } from '../logic/presentationState.js';
import { provideFocusedProject } from '../logic/focusedProjectContext.js';
import { useApp } from '../logic/app.js';

const { diagnostics, projectRepo, viewStateRepo, logging } = useApp();

// App.vue is the shell-agnostic root: it owns app lifecycle (persist / hash / self-test)
// and the global overlays, AND is the app's ONE top-level null gate (PROMPT_RELEASE_
// HARDENING plan) — it reads `focusedProject()` once, renders the explicit empty state when
// it is null, and otherwise provides the guaranteed-non-null project to everything below via
// `provideFocusedProject()`. The shell only arranges the shared components — no lifecycle or
// gating logic lives here twice.
const project = computed(() => focusedProject());
// Only ever `.value`d by a descendant mounted under `v-if="project"` below, so
// `requireFocusedProject()` never actually throws here in practice.
provideFocusedProject(computed(() => requireFocusedProject()));

async function handleHashChange() {
  const saved = await projectRepo.loadFromHash();
  if (Array.isArray(saved)) logging.flash('Could not load shared link: ' + saved.join('; '));
  else if (saved) applyState(saved);
}

let saveReady = false;
// THE AUTOSAVE HOOK — deliberately EMPTY (QO92, John 2026-08-26: "rip out autosave 100% as I
// never designed that"). The trigger point is kept, and so are its integration tests, because
// where persistence plugs in is agreed; WHAT it does is not, and the version that stood here
// was never designed. It persisted committed state on every reactive tick, which is what forced
// `ManagedProject` to hand a whole `OpenISDProject` out to the app purely so the repo could
// serialise it — the one thing the layering doctrine forbids.
//
// A design has to settle which layer is persisted, on what trigger, and whether the domain
// hands over bytes rather than the project object. Until then this fires and does nothing.
watch(projectChanged, () => {
  if (!saveReady) return;
  // no persistence — see above
});

onMounted(async () => {
  const fromUrl = await projectRepo.loadFromHash();
  if (Array.isArray(fromUrl)) {
    logging.flash('Could not load shared link: ' + fromUrl.join('; '));
  } else if (!fromUrl) {
    // No project is restored: autosave is gone, so nothing was written for a reload to find.
    // View/UI preferences are a SEPARATE feature under their own storage key (QO90) and are
    // unaffected.
    const view = viewStateRepo.load();
    if (view) applyViewSnapshot(view);
  } else {
    // A share link still carries the WHOLE session (human ruling 2026-08-14).
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
  <template v-if="project">
    <OriginalShell />
    <DriverBrowserWinisd />
    <!-- The driver editor is global, so a driver picked from the library is always
         reviewed before it reaches the design. -->
    <DriverEditorModal v-if="presentationState.editDriverInfo" @close="presentationState.editDriverInfo = false" />
  </template>
  <!-- The top-level null gate's empty state (PROMPT_RELEASE_HARDENING plan): no project is
       open, so neither the chart views nor the tab section render with empty/default data —
       this message replaces both. The one recovery action opens a fresh blank project
       (`OpenISDProject.builder()`, which self-heals from the empty registry) — every other affordance
       (File → Open, the New Project wizard) lives on `OriginalShell`'s own toolbar, which is
       itself inside the gate and so only reachable once a project is open. -->
  <div v-else class="no-project-open">
    <p>No project is open.</p>
    <button type="button" @click="OpenISDProject.builder()">Start a new project</button>
  </div>
  <Flash />
  <!-- Raises itself on the first uncaught error, rejection or console.error. -->
  <DiagnosticsModal />
</template>

<style scoped>
.no-project-open {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  height: 100vh;
  color: var(--fg, #ccc);
  background: var(--bg, #1e1e1e);
  font-size: 14px;
}
</style>
