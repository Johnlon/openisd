<script setup lang="ts">
import {computed, onMounted, onUnmounted, watch} from 'vue';
import OriginalShell from './shells/original/OriginalShell.vue';
import MobileShell from './shells/mobile/MobileShell.vue';
import OriginalNewProject from './shells/original/OriginalNewProject.vue';
import MobileNewProject from './shells/mobile/MobileNewProject.vue';
import OriginalWhatIf from './shells/original/OriginalWhatIf.vue';
import DriverBrowser from './components/DriverBrowser.vue';
import DriverEditorModal from './components/DriverEditorModal.vue';
import Flash from './components/Flash.vue';
import DiagnosticsModal from './components/DiagnosticsModal.vue';
import SplashModal from './components/SplashModal.vue';
import WinisdDifferencesModal from './components/WinisdDifferencesModal.vue';
import {
  applyState,
  currentViewSnapshot,
  focusedProject,
  openProjects,
  projectChanged,
  requireFocusedProject,
} from '../logic/appState.js';
import {bootApplication} from '../logic/boot.js';
import {startSessionSync} from '../logic/sessionSync.js';
import {hiddenTraces} from '../logic/traceVisibility.js';
import {presentationState} from '../logic/presentationState.js';
import {provideFocusedProject} from '../logic/focusedProjectContext.js';
import {useApp} from '../logic/app.js';
import {provideSplashModal} from '../hooks/SplashModal-hooks.js';
import {provideWinisdDifferencesModal} from '../hooks/WinisdDifferencesModal-hooks.js';
import {createViewportWatch} from '../logic/viewport.js';

const { projectRepo, viewStateRepo, logging, selection, bundledDrivers, bundledPassiveRadiators } = useApp();

// The automatic half of the skin switch. Read `matchMedia` SYNCHRONOUSLY here — before this
// component's first render — so a phone loads straight into the mobile shell with no
// desktop-then-swap flash, and so the 19 browser specs gated on `.original-root` never race a
// deferred switch. `createViewportWatch()` seeds `narrow.value` synchronously from the current
// `matchMedia().matches`, which is what makes this safe to read immediately rather than waiting
// for `onMounted`. The manual, persisted override (`presentationState.ui.skinOverride`, restored
// by `boot.ts` phase 4) is applied afterward as a correction, in `onMounted` below — it can only
// be known once `viewStateRepo` has been read.
const viewportWatch = createViewportWatch();
presentationState.narrowViewport = viewportWatch.narrow.value;
watch(viewportWatch.narrow, v => { presentationState.narrowViewport = v; });

/** Which shell to render: the manual override wins when set; otherwise follow the viewport. */
const activeSkin = computed(() =>
  presentationState.ui.skinOverride ?? (presentationState.narrowViewport ? 'mobile' : 'original'));

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

// One help page "OpenISD and WinISD differences": the Help menus, the WinISD Compatibility group
// headings and the ≠W cues all open this instance.
provideWinisdDifferencesModal();

/** Whether a project is focused right now. The overlays below are project-bound: the shell
 *  renders without one, they must not. */
const projectOpen = computed(() => { void projectChanged.value; return focusedProject() !== null; });

async function handleHashChange() {
  const saved = await projectRepo.loadFromHash();
  if (Array.isArray(saved)) logging.flash('Could not load shared link: ' + saved.join('; '));
  else if (saved) applyState(saved);
}

let stopSessionSync: () => void = () => {};

onMounted(async () => {
  // ONE ordered restore (`logic/boot.ts`), then persistence. Nothing writes storage while the
  // boot is still reading it, and no phase runs before the one it depends on has returned.
  await bootApplication({
    projectRepo,
    viewStateRepo,
    logging,
    editProjectDriver: () => selection.editProjectDriver(),
  });
  viewStateRepo.save(currentViewSnapshot());
  projectRepo.saveOpenProjects(openProjects(), focusedProject(), hiddenTraces(openProjects()));
  stopSessionSync = startSessionSync({ projectRepo, viewStateRepo });
  window.addEventListener('hashchange', handleHashChange);
});

onUnmounted(() => {
  stopSessionSync();
  window.removeEventListener('hashchange', handleHashChange);
  viewportWatch.stop();
});
</script>

<template>
  <!-- Every `position: fixed` overlay in the app (the wizards, DriverBrowser, DriverEditorModal,
       OptionsModal, DiagnosticsModal, SplashModal, ...) is a SIBLING of the shell here, not a
       descendant of it — so none of them can be contained by anything the shell itself does.
       `.app-root`'s `transform` (see the style block) makes THIS element the containing block
       for every `position: fixed` descendant in the whole app, per the CSS spec — exactly what
       constrains them to the phone-width pane below when the mobile skin is centered inside a
       full desktop browser window, without editing every overlay component individually. In
       desktop mode this element is unconstrained (full width), so the same rule is a no-op —
       `position: fixed` against a full-viewport containing block behaves identically to `fixed`
       against the real viewport. -->
  <div class="app-root" :class="{ 'app-root-mobile': activeSkin === 'mobile' }">
    <!-- The shell renders WITH or WITHOUT a project — with none it shows the toolbar plus the
         empty placeholders, and the toolbar's global actions stay reachable. All overlays
         self-gate on their own presentationState booleans. Which shell mounts is `activeSkin`:
         the manual override when set, else the live viewport. -->
    <MobileShell v-if="activeSkin === 'mobile'" />
    <OriginalShell v-else />
    <!-- Global overlays — each self-gates internally and is safe with no project open. -->
    <MobileNewProject v-if="presentationState.newProjectOpen && activeSkin === 'mobile'" @close="presentationState.newProjectOpen = false" />
    <OriginalNewProject v-else-if="presentationState.newProjectOpen" @close="presentationState.newProjectOpen = false" />
    <!-- Both read the focused project, so neither may mount without one — whatever set the
         flag. The shell itself renders with no project; these do not. -->
    <DriverEditorModal v-if="presentationState.editDriverInfo && projectOpen" @close="presentationState.editDriverInfo = false" />
    <OriginalWhatIf v-if="presentationState.editDriver && projectOpen" />
    <!-- The wizard's step-1 driver picker sits ON TOP of the wizard modal (both z-index 100). -->
    <DriverBrowser />
    <Flash />
    <!-- Raises itself on the first uncaught error, rejection or console.error. -->
    <DiagnosticsModal />
    <!-- What OpenISD is — raised for a first visitor, reopened from Info → About OpenISD. -->
    <SplashModal />
    <!-- Help → "OpenISD and WinISD differences"; also opened by the group headings and ≠W cues. -->
    <WinisdDifferencesModal />
  </div>
</template>

<style scoped>
.app-root-mobile {
  max-width: 480px;
  margin: 0 auto;
  /* No explicit height here on purpose: MobileShell.vue's .mobile-root sets its OWN height from
     a JS-measured window.innerHeight (more robust than any CSS vh/dvh — see its own comment).
     Every other child of this element is position:fixed (out of normal flow), so with no height
     of its own, this element's auto height just matches .mobile-root's exactly — no risk of the
     two disagreeing and one clipping or gapping past the other. */
  box-shadow: 0 0 0 1px #C7CDCB;
  /* Establishes the containing block for every position:fixed descendant app-wide — see the
     template comment above. The exact transform doesn't matter (translateZ(0) is a common,
     visually inert choice); only that one is present. */
  transform: translateZ(0);
  overflow-x: hidden;
}
/* Bug (John, live on his phone, 2026-09-29): "openisd button should just open the splash as full
   width scrolling it as a popup, popup is ok in the main app" — SplashModal.vue already scrolls
   its own content (.sp's overflow:auto), the complaint is the 24px backdrop padding + centred
   width cap leaving visible grey margins on a phone. Scoped to mobile only — SplashModal.vue
   itself is shared with desktop, where the centred/padded look is unchanged. */
.app-root-mobile :deep(.sp-backdrop) {
  padding: 0;
}
.app-root-mobile :deep(.wd-overlay) {
  padding: 0;
}
.app-root-mobile :deep(.wd-modal) {
  width: 100%;
  height: 100%;
  max-height: 100%;
  border-radius: 0;
  border: none;
}
.app-root-mobile :deep(.sp) {
  width: 100%;
  max-height: 100%;
  border-radius: 0;
}

/* Bug (John, live on his phone, 2026-09-29, screenshot): Driver Editor's Parameters tab rendered
   with labels and inputs overlapping/garbled, illegibly. DriverEditorModal.vue's own CSS builds
   ONE whole-tab grid sized for "4 field-slots per row" at a 770px desktop width (.de-params'
   own comment) — on a phone that grid has nowhere near the room, and the fixed-width modal
   (.de-modal, 770px) only had a weak max-width:96vw safety net, not an actually responsive
   layout. Collapsing to one field-slot's worth of tracks (4, not 16) makes every .de-fld — which
   already spans exactly 4 tracks — stack one per row with no changes needed there. `!important`
   to outrank the component's own `!important` rules (its own comments explain why IT needs
   those, against a different collision than the one this fixes). */
.app-root-mobile :deep(.de-modal) {
  width: 100% !important;
  max-width: none !important;
  height: 100% !important;
  max-height: none !important;
  min-height: 0 !important;
  border-radius: 0 !important;
}
/* Bug (John, live on his phone, 2026-10-05: "that screen is really broken due to the bottom
   bar"): the footer's legend and seven buttons, the tab row and long DQ formulas did not wrap,
   so their width pushed the editor past both screen edges. On a phone the editor is the screen's
   width: tabs scroll sideways inside it, the legend is one item per line above the buttons, the
   buttons wrap, and long formulas break. */
.app-root-mobile :deep(.de-modal) { min-width: 0 !important; }
.app-root-mobile :deep(.de-modal > *) { min-width: 0; }
.app-root-mobile :deep(.de-tabs) { overflow-x: auto; flex-shrink: 0; }
.app-root-mobile :deep(.de-tab) { white-space: nowrap; flex-shrink: 0; }
.app-root-mobile :deep(.de-toolbar) { flex-wrap: wrap; row-gap: 6px; }
.app-root-mobile :deep(.de-incomplete) { overflow-wrap: anywhere; }
.app-root-mobile :deep(.de-footer) { align-items: flex-start; padding-left: 10px; padding-right: 10px; }
.app-root-mobile :deep(.de-legend2) { flex: none; flex-direction: column; align-items: flex-start; gap: 4px; margin-top: 0; }
.app-root-mobile :deep(.de-btns) { flex: 1 1 0; min-width: 0; flex-direction: column; align-items: flex-end; gap: 6px; }
.app-root-mobile :deep(.de-btn-row) { display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end; }
.app-root-mobile :deep(.de-btn-row > button) { order: 0; padding-left: 6px; padding-right: 6px; }
.app-root-mobile :deep(.de-params) {
  grid-template-columns: minmax(0, max-content) minmax(0, max-content) 34px 16px !important;
}
.app-root-mobile :deep(.de-dims) {
  flex-direction: column !important;
}
.app-root-mobile :deep(.de-dimlist) {
  width: 100% !important;
}

/* Bug (John, 2026-10-02: "something is eclipsing the bottom of the Use and Cancel buttons when
   picking driver"): DriverBrowser.vue's own .wb-modal is fixed at 770x535 (a weak max-width/
   max-height safety net, same gap DriverEditorModal's .de-modal had before its own override
   above) — on a phone whose actual viewport is shorter than ~630px (535px / the 85vh cap), the
   modal's real height clamps below what DriverLibrary.vue's list+preview+footer need, and
   nothing in that fixed-height box was scrollable enough to compensate. Full-screen removes the
   ceiling entirely, the same fix as .de-modal just above. */
.app-root-mobile :deep(.wb-modal) {
  width: 100% !important;
  max-width: none !important;
  height: 100% !important;
  max-height: none !important;
  border-radius: 0 !important;
}
</style>
