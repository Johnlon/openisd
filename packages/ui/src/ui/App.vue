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
  applyState,
  currentViewSnapshot,
  focusedProject,
  openProjects,
  projectChanged,
  requireFocusedProject,
} from '../logic/appState.js';
import {bootApplication} from '../logic/boot.js';
import {presentationState} from '../logic/presentationState.js';
import {provideFocusedProject} from '../logic/focusedProjectContext.js';
import {useApp} from '../logic/app.js';
import {provideSplashModal} from '../hooks/SplashModal-hooks.js';

const { projectRepo, viewStateRepo, logging, selection, bundledDrivers, bundledPassiveRadiators } = useApp();

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
// menu reopens it. Provided here so the shell's menu and the modal share one instance. The
// catalogue counts it shows are the bundled indexes' own lengths, fetched only once the splash
// is actually on screen.
provideSplashModal(presentationState, {
  driverCount: async () => (await bundledDrivers.index()).length,
  passiveRadiatorCount: async () => (await bundledPassiveRadiators.index()).length,
});

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
  // ONE ordered restore (`logic/boot.ts`), then persistence. Nothing writes storage while the
  // boot is still reading it, and no phase runs before the one it depends on has returned.
  await bootApplication({
    projectRepo,
    viewStateRepo,
    logging,
    editProjectDriver: () => selection.editProjectDriver(),
  });
  viewSaveReady = true;
  saveReady = true;
  viewStateRepo.save(currentViewSnapshot());
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
