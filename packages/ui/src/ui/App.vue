<script setup lang="ts">
import {computed, onMounted, onUnmounted, watch} from 'vue';
import OriginalShell from './shells/original/OriginalShell.vue';
import OgNewProject from './shells/original/OgNewProject.vue';
import OgTune from './shells/original/OgTune.vue';
import DriverBrowser from './components/DriverBrowser.vue';
import DriverEditorModal from './components/DriverEditorModal.vue';
import Flash from './components/Flash.vue';
import DiagnosticsModal from './components/DiagnosticsModal.vue';
import SplashModal from './components/SplashModal.vue';
import {
  applyLoadedProject,
  applyState,
  applyViewSnapshot,
  currentViewSnapshot,
  focusedProject,
  markProjectSaved,
  openProjects,
  projectChanged,
  requireFocusedProject,
  restoreProjects,
} from '../logic/appState.js';
import {presentationState} from '../logic/presentationState.js';
import {provideFocusedProject} from '../logic/focusedProjectContext.js';
import {useApp} from '../logic/app.js';
import {provideSplashModal} from '../hooks/SplashModal-hooks.js';

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

// One splash for the whole app: it raises itself for a first visitor, and the toolbar's Info
// menu reopens it. Provided here so the shell's menu and the modal share one instance.
provideSplashModal(presentationState);

/** Whether a project is focused right now. The overlays below are project-bound: the shell
 *  renders without one, they must not. */
const projectOpen = computed(() => { void projectChanged.value; return focusedProject() !== null; });

async function handleHashChange() {
  const saved = await projectRepo.loadFromHash();
  if (Array.isArray(saved)) logging.flash('Could not load shared link: ' + saved.join('; '));
  else if (saved) applyState(saved);
}

let saveReady = false;
let viewSaveReady = false;
watch(projectChanged, () => {
  if (!saveReady) return;
  projectRepo.saveOpenProjects(openProjects(), focusedProject());
});
watch(
  () => [openProjects().length, focusedProject()?.uuid() ?? null],
  () => { if (saveReady) projectRepo.saveOpenProjects(openProjects(), focusedProject()); },
);
watch(currentViewSnapshot, snapshot => {
  if (viewSaveReady) viewStateRepo.save(snapshot);
}, { deep: true });

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
  viewSaveReady = true;
  viewStateRepo.save(currentViewSnapshot());
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
  <OgNewProject v-if="presentationState.newProjectOpen" @close="presentationState.newProjectOpen = false" />
  <!-- Both read the focused project, so neither may mount without one — whatever set the
       flag. The shell itself renders with no project; these do not. -->
  <DriverEditorModal v-if="presentationState.editDriverInfo && projectOpen" @close="presentationState.editDriverInfo = false" />
  <OgTune v-if="presentationState.editDriver && projectOpen" />
  <!-- The wizard's step-1 driver picker sits ON TOP of the wizard modal (both z-index 100). -->
  <DriverBrowser />
  <Flash />
  <!-- Raises itself on the first uncaught error, rejection or console.error. -->
  <DiagnosticsModal />
  <!-- What OpenISD is — raised for a first visitor, reopened from Info → About OpenISD. -->
  <SplashModal />
</template>

<style scoped>
/* No-project-open styles removed — the shell renders the placeholders itself now. */
</style>
