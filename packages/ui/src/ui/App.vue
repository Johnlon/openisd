<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue';
import OriginalShell from './shells/original/OriginalShell.vue';
import DriverBrowserWinisd from './components/DriverBrowserWinisd.vue';
import DriverEditorModal from './components/DriverEditorModal.vue';
import Flash from './components/Flash.vue';
import DiagnosticsModal from './components/DiagnosticsModal.vue';
import {
  focusedProject, requireFocusedProject, committedSnapshot, newProject,
  applyState, applyLoadedProject, applyViewSnapshot,
  markProjectSaved, currentViewSnapshot,
} from '../logic/appState.js';
import { presentationState } from '../logic/presentationState.js';
import { provideFocusedProject } from '../logic/focusedProjectContext.js';
import { useApp } from '../logic/app.js';

const { diagnostics, projectRepo, viewStateRepo } = useApp();

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
  if (saved) applyState(saved);
}

let saveReady = false;
// ONE gathered snapshot, TWO autosaves (QO90): `projectRepo.saveLocal` writes only the
// project to the wire (it ignores `s.view` itself — see `projectRepo.ts`); `viewStateRepo`
// persists the view separately, under its own storage key.
// `committedSnapshot` (`appState.ts`), not `currentProject()` (BUG_20260825): this getter
// re-runs on every reactive tick, including edits inside an open what-if. `currentProject()`/
// `projectToPersist()` cancels an active what-if as a side effect — correct for an explicit
// save/export/share action, wrong here, where it silently destroyed an open what-if moments
// after the user opened one. `committedSnapshot` reads committed state without touching it,
// on whichever project is currently focused; null (nothing to autosave) when none is.
watch(
  committedSnapshot,
  (snap) => {
    if (!saveReady || !snap) return;
    projectRepo.saveLocal(snap);
    viewStateRepo.save(currentViewSnapshot());
  },
  { deep: true },
);

onMounted(async () => {
  const fromUrl = await projectRepo.loadFromHash();
  if (!fromUrl) {
    // Project and view load independently (QO90) — each from its own storage key.
    const local = projectRepo.loadLocal();
    if (local) applyLoadedProject(local);
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
       (`newProject()`, which self-heals from the empty registry) — every other affordance
       (File → Open, the New Project wizard) lives on `OriginalShell`'s own toolbar, which is
       itself inside the gate and so only reachable once a project is open. -->
  <div v-else class="no-project-open">
    <p>No project is open.</p>
    <button type="button" @click="newProject()">Start a new project</button>
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
