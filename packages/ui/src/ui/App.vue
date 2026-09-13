<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue';
import OriginalShell from './shells/original/OriginalShell.vue';
import OgNewProject from './shells/original/OgNewProject.vue';
import OgTune from './shells/original/OgTune.vue';
import DriverBrowser from './components/DriverBrowser.vue';
import DriverEditorModal from './components/DriverEditorModal.vue';
import Flash from './components/Flash.vue';
import DiagnosticsModal from './components/DiagnosticsModal.vue';
import {
  requireFocusedProject, projectChanged, openProjects, focusedProject, restoreProjects,
  applyState, applyLoadedProject, applyViewSnapshot,
  markProjectSaved,
} from '../logic/appState.js';
import { presentationState } from '../logic/presentationState.js';
import { provideFocusedProject } from '../logic/focusedProjectContext.js';
import { useApp } from '../logic/app.js';

const { projectRepo, viewStateRepo, logging } = useApp();

// App.vue is the shell-agnostic root: it owns app lifecycle (persist / hash) and the global
// overlays. The shell renders WITH or WITHOUT a project — with none it shows the toolbar plus
// the empty placeholders, and the toolbar's global actions (New / Open / Options / Drivers /
// Info) stay reachable. The shell's own `projectOpen` gate keeps every project-bound panel out
// of the DOM until a project exists.
//
// The focused project is provided NON-NULL `computed(() => requireFocusedProject())`, exactly
// as the gate version did: only a descendant mounted inside the shell's `projectOpen` gate may
// read it — that gate guarantees a project exists, so the throw can never fire there.
provideFocusedProject(computed(() => requireFocusedProject()));

async function handleHashChange() {
  const saved = await projectRepo.loadFromHash();
  if (Array.isArray(saved)) logging.flash('Could not load shared link: ' + saved.join('; '));
  else if (saved) applyState(saved);
}

let saveReady = false;
watch(projectChanged, () => {
  if (!saveReady) return;
  projectRepo.saveOpenProjects(openProjects(), focusedProject());
});
watch(
  () => [openProjects().length, focusedProject()?.uuid() ?? null],
  () => { if (saveReady) projectRepo.saveOpenProjects(openProjects(), focusedProject()); },
);

onMounted(async () => {
  const fromUrl = await projectRepo.loadFromHash();
  if (Array.isArray(fromUrl)) {
    logging.flash('Could not load shared link: ' + fromUrl.join('; '));
  } else if (fromUrl) {
    // A share link still carries the WHOLE session (human ruling 2026-08-14).
    applyState(fromUrl);
  } else {
    // No share link: restore every project that was open at refresh, preserving focus. Fall back
    // to the last project SAVED to browser storage for older sessions.
    const session = projectRepo.loadOpenProjects();
    if (Array.isArray(session)) {
      logging.flash('Could not restore open projects: ' + session.join('; '));
    } else if (session) {
      restoreProjects(session.projects, session.focusedIndex);
    } else {
    // Fall back to the last project saved to browser storage for older sessions, else boot with
    // no-project placeholders. View/UI preferences are a SEPARATE feature under their own
    // storage key (QO90) and are restored either way.
    const stored = projectRepo.loadFromStorage();
    if (Array.isArray(stored)) {
      logging.flash('Could not restore the saved project: ' + stored.join('; '));
    } else if (stored) {
      applyLoadedProject(stored);
    }
    }
    const view = viewStateRepo.load();
    if (view) applyViewSnapshot(view);
  }
  markProjectSaved();   // the just-loaded design is the ground state (clean, not modified)
  saveReady = true;
  projectRepo.saveOpenProjects(openProjects(), focusedProject());
  window.addEventListener('hashchange', handleHashChange);
});

onUnmounted(() => {
  window.removeEventListener('hashchange', handleHashChange);
});
</script>

<template>
  <!-- The shell renders WITH or WITHOUT a project — with none it shows the toolbar plus the
       empty placeholders, and the toolbar's global actions stay reachable. All overlays
       self-gate on their own presentationState booleans. -->
  <OriginalShell />
  <!-- Global overlays — each self-gates internally and is safe with no project open. -->
  <DriverBrowser />
  <DriverEditorModal v-if="presentationState.editDriverInfo" @close="presentationState.editDriverInfo = false" />
  <OgTune v-if="presentationState.editDriver" />
  <OgNewProject v-if="presentationState.newProjectOpen" @close="presentationState.newProjectOpen = false" />
  <Flash />
  <!-- Raises itself on the first uncaught error, rejection or console.error. -->
  <DiagnosticsModal />
</template>

<style scoped>
/* No-project-open styles removed — the shell renders the placeholders itself now. */
</style>
