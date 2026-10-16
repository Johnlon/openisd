/**
 * `MobileShell.vue`'s hook — routing between the Design tabs and the full-screen Graph
 * destination, plus the manual skin switch and the no-project empty state. One hook, one
 * component (`.claude/rules/ui.md`); every ref/computed/write lives here.
 */
import {type Ref, computed, nextTick, onMounted, onUnmounted, ref, watch} from 'vue';
import type {OpenISDProject} from '@openisd/design';
import {cycleTraceColor} from '../logic/presentationState.js';
import {useApp} from '../logic/app.js';
import {useFeatureUse} from './telemetryContext.js';
import {inputFrom} from '../logic/domEvents.js';
import {visibleViewportHeightPx} from '../logic/visibleViewport.js';
import {injectSplashModal} from './SplashModal-hooks.js';
import type {TabId} from '../logic/tabId.js';
import {createSelectedBox} from './boxFields.js';
import type {BinRow} from './binRows.js';
import type {ProjectListRow} from './projectBinView.js';
import {openStoredProject as openStoredProjectFromStore} from '../logic/storedProjectOpen.js';
import {createProjectBinView} from './projectBinView.js';
import {
  type ConflictCopy,
  type SyncDisplay,
  type SyncTap,
  DriverId,
  ProjectId,
} from '@openisd/design/cloud';
import {
  projectCloudMarks,
  useCloudSync,
  useCloudSyncUi,
} from './CloudSync-hooks.js';

/** The mobile shell's own destinations: the same tab ids the desktop shell's content panel
 *  uses (so a shared field-wiring caller never has to ask "which shell is this"), plus `graph`
 *  — a destination that has no desktop counterpart, because `GraphPanel`'s canvas sets
 *  `touch-action: none` (custom pointer pan/zoom) and would trap vertical scroll if it sat
 *  inline in a form column instead of owning the whole screen. */
export type MobileDestination = Extract<TabId, 'box' | 'driver' | 'signal' | 'filters' | 'enclosure'> | 'graph';

/** The panes the hamburger menu opens as full-screen dialogs over the current destination. */
export type MobilePane = 'project' | 'advanced' | 'drivers' | 'cloudSync';

export interface MobileShellApi {
  storeLabel: string;
  projectOpen: import('vue').ComputedRef<boolean>;
  /** The focused project's title for the top bar; '' with no project open. */
  projectTitle: import('vue').ComputedRef<string>;
  destination: import('vue').Ref<MobileDestination>;
  fileInput: import('vue').Ref<HTMLInputElement | null>;
  openImportedFile: (e: Event) => void;
  openNewProject: () => void;
  switchToDesktop: () => void;
  menuOpen: import('vue').Ref<boolean>;
  toggleMenu: () => void;
  closeMenu: () => void;
  exportProjectsArchive: () => void;
  openFromDisk: () => void;
  isModified: import('vue').ComputedRef<boolean>;
  saveProject: () => Promise<unknown>;
  /** Save every open project with unsaved edits. */
  saveAllProjects: () => Promise<number>;
  /** Some open project, focused or not, has unsaved edits — Save all has work to do. */
  anyUnsaved: import('vue').ComputedRef<boolean>;
  /** A newer build is published and the user has not dismissed the notice for it. */
  updateBannerVisible: import('vue').ComputedRef<boolean>;
  /** Reload onto the newer build. */
  reloadForUpdate: () => Promise<void>;
  /** Hide the notice until the next visit. */
  dismissUpdateBanner: () => Promise<void>;
  revertProject: () => void;
  browseDrivers: () => void;
  optionsOpen: import('vue').Ref<boolean>;
  openOptions: () => void;
  about: () => void;
  pane: import('vue').Ref<MobilePane | null>;
  closePane: () => void;
  goToProject: () => void;
  goToAdvanced: () => void;
  /** The real, currently-visible viewport height in px — see the field's own comment. */
  viewportHeightPx: import('vue').Ref<number>;
  /** Mirrors desktop's own nav gate: sealed has no Enclosure destination (Volume + Fsc live only
   *  on the Box tab). */
  showEnclosureTab: import('vue').ComputedRef<boolean>;
  /** The Enclosure tab bar label, matching desktop's `enclosureNavLabel`. */
  enclosureNavLabel: import('vue').ComputedRef<string>;
  /** Bound to `.mob-content` so its scroll position/height can be read. */
  contentEl: import('vue').Ref<HTMLElement | null>;
  /** True while there is unscrolled content ABOVE the current view — shows as a shadow under
   *  the top bar (John, 2026-10-02: "a visual indicator that there's something to scroll ...
   *  up to"). */
  canScrollUp: import('vue').Ref<boolean>;
  /** Same, for content BELOW the current view — shows as a shadow above the tab bar. */
  canScrollDown: import('vue').Ref<boolean>;
  /** Recompute both of the above from `contentEl`'s live scroll position. Bound to the
   *  content pane's own `scroll` event for immediate feedback; also re-run after anything that
   *  can change its height without the user scrolling (mount, a tab switch, a window resize,
   *  or the mounted tab's own content growing/shrinking). */
  updateScrollEdges: () => void;
  /** The menu drawer's identity line — null until the user sets one (Options → Username). */
  username: import('vue').ComputedRef<string | null>;
  /** The version of the running build, shown in the menu; '' on a dev server. */
  appVersion: import('vue').Ref<string>;
  /** Full-screen Projects pane. */
  projectsPaneOpen: import('vue').Ref<boolean>;
  openProjectsPane: () => void;
  closeProjectsPane: () => void;
  projectRows: import('vue').ComputedRef<ProjectListRow[]>;
  shownProjects: import('vue').ComputedRef<ProjectListRow[]>;
  /** "35 projects · 770 KB · 2 open". */
  projectsFooter: import('vue').ComputedRef<string>;
  searchOffered: import('vue').ComputedRef<boolean>;
  projectQuery: import('vue').Ref<string>;
  projectOrder: import('vue').Ref<import('@openisd/design/fields').ProjectRowOrder>;
  projectOrders: readonly import('@openisd/design/fields').ProjectRowOrder[];
  /** Opens a saved project, or makes an open one active. */
  chooseProject: (row: ProjectListRow) => void;
  setProjectTraceVisible: (row: ProjectListRow, visible: boolean) => void;
  cycleProjectColour: (row: ProjectListRow) => void;
  closeProjectRow: (row: ProjectListRow) => Promise<void>;
  duplicateProjectRow: (row: ProjectListRow) => void;
  exportProjectRow: (row: ProjectListRow) => Promise<void>;
  /** Makes the row's project active and opens the Project pane, whose Name field renames it. */
  renameProjectRow: (row: ProjectListRow) => void;
  /** A conflict copy: the Cloud sync pane, which lists the conflicts. */
  resolveProjectRow: (row: ProjectListRow) => void;
  /** The Bin view inside the Projects pane (projectBinView.ts). */
  binRows: import('vue').Ref<BinRow[]>;
  binTotal: import('vue').Ref<string>;
  binOpen: import('vue').Ref<boolean>;
  binLabel: import('vue').ComputedRef<string>;
  moveToBin: (row: ProjectListRow) => Promise<void>;
  restoreFromBin: (row: BinRow) => void;
  deleteForever: (row: BinRow) => Promise<void>;
  emptyBin: () => Promise<void>;
  cloudEnabled: Readonly<Ref<boolean>>;
  cloudSyncDisplay: Readonly<Ref<SyncDisplay>>;
  handleSyncTap: (action: SyncTap) => void;
  onSyncPointerDown: () => void;
  onSyncPointerUp: () => void;
  onSyncPointerCancel: () => void;
  openCloudSync: () => void;
  reconnectCloud: () => void;
  openConflictNotice: () => void;
  turnOnHint: () => void;
  dismissHint: () => void;
  connectCloud: () => void;
  syncNowCloud: () => void;
  disconnectCloud: () => Promise<void>;
  openConflict: (id: ConflictCopy['id']) => void;
}

export function useMobileShell(): MobileShellApi {
  const { appState, presentation: presentationState } = useApp();
  const { setTraceVisible, boxTypeIsSimulatable, focusedProject, focusProject, isModified, openProjects, projectChanged, projectDisplayName, projectHasUnsavedChanges, removeProject, resetProjectToGround } = appState;
  const { setSkinOverride } = presentationState;
  const { designIO, projectRepo, projectBin, releases, appVersion, confirmPort, logging } = useApp();
  const { saveProject, saveAllProjects } = designIO;
  const { show: about } = injectSplashModal();
  const projectOpen = computed(() => focusedProject() != null);
  const projectTitle = computed(() => { void projectChanged.value; return focusedProject()?.title() ?? ''; });
  const destination = ref<MobileDestination>('box');
  const pane = ref<MobilePane | null>(null);
  const featureUse = useFeatureUse();
  watch(destination, d => {
    if (d === 'filters') featureUse.feature('filters');
    if (d === 'enclosure') featureUse.feature('vents');
  }, { immediate: true });
  watch(pane, p => { if (p === 'drivers') featureUse.feature('driver_db'); });
  watch(() => presentationState.browseOpen, open => { if (open) featureUse.feature('driver_db'); });
  // The menu drawer's own identity line (John, 2026-10-02: "get my name in there somewhere") —
  // the same free-text app-level preference the Options dialog's "Username" field edits
  // (OptionsModal.vue), not a new setting of its own.
  const username = computed(() => presentationState.ui.username || null);

  // Mirrors desktop's own nav gate (OriginalShell-hooks.ts) — its own selectedBox instance, kept
  // synced to the project the same way (see createSelectedBox's own comment).
  const { showEnclosureTab, enclosureNavLabel } =
    createSelectedBox({ focusedProject, projectChanged, isSimulatable: boxTypeIsSimulatable });



  const fileInput = ref<HTMLInputElement | null>(null);
  function openImportedFile(e: Event): void {
    const input = inputFrom(e);
    if (input === null) return;
    const f = input.files?.[0];
    if (f) designIO.importFile(f);
    input.value = '';
  }
  function openNewProject(): void {
    presentationState.newProjectOpen = true;
    closeMenu();
  }
  function openFromDisk(): void {
    void designIO.openFromDisk(() => fileInput.value?.click());
    closeMenu();
  }

  // Projects pane — previously-SAVED projects (browser storage) and open projects.
  const projectsPaneOpen = ref(false);
  const cloudSyncForProjects = useCloudSync();
  const binView = createProjectBinView({
    appState, projectRepo, projectBin, confirm: confirmPort.port,
    unitTokens: () => presentationState.ui.unitTokens ?? {}, alert: text => alert(text),
    cloudMarks: () => projectCloudMarks(cloudSyncForProjects),
  });
  const {projectRows, shownProjects, projectsFooter, searchOffered, binRows, binTotal, binOpen, binLabel} = binView;
  const {query: projectQuery, order: projectOrder, orders: projectOrders} = binView;
  function openProjectsPane(): void {
    binView.refresh();
    binOpen.value = false;
    projectsPaneOpen.value = true;
    closeMenu();
  }
  function closeProjectsPane(): void {
    projectsPaneOpen.value = false;
  }
  function openStoredProject(id: string): void {
    const result = openStoredProjectFromStore(appState, projectRepo, id);
    if (result.kind === 'refused') {
      alert('Could not open the saved project: ' + result.errors.join('; '));
      return;
    }
    projectsPaneOpen.value = false;
  }
  /** A saved project opens (or, when open, becomes active); an open one never saved becomes active. */
  function chooseProject(row: ProjectListRow): void {
    const handle = row.handle;
    if (handle.kind === 'saved') {
      openStoredProject(handle.id);
      return;
    }
    appState.focusProject(appState.openProjects().indexOf(handle.project));
    projectsPaneOpen.value = false;
  }

  function projectOfRow(row: ProjectListRow): OpenISDProject | null {
    const handle = row.handle;
    return handle.kind === 'notSaved' ? handle.project : handle.open;
  }

  function setProjectTraceVisible(row: ProjectListRow, visible: boolean): void {
    const project = projectOfRow(row);
    if (project !== null) setTraceVisible(project, visible);
  }

  function cycleProjectColour(row: ProjectListRow): void {
    const project = projectOfRow(row);
    if (project !== null) cycleTraceColor(project);
  }

  async function closeProjectRow(row: ProjectListRow): Promise<void> {
    const project = projectOfRow(row);
    if (project === null) return;
    if (projectHasUnsavedChanges(project)) {
      const name = projectDisplayName(project);
      const confirmed = await confirmPort.port.ask({
        title: 'Close project?',
        message: `"${name}" has unsaved changes. Close it without saving?`,
        confirmLabel: 'Close',
        cancelLabel: 'Cancel',
      });
      if (!confirmed) return;
    }
    const index = openProjects().indexOf(project);
    if (index >= 0) removeProject(index);
  }

  /** Makes the row's project the focused one, opening it first if it is only saved. False when it
   *  could not be opened (the user was told). */
  function focusRow(row: ProjectListRow): boolean {
    const project = projectOfRow(row);
    if (project !== null) {
      const index = openProjects().indexOf(project);
      if (index >= 0) focusProject(index);
      return true;
    }
    if (row.handle.kind !== 'saved') return false;
    const result = openStoredProjectFromStore(appState, projectRepo, row.handle.id);
    if (result.kind === 'refused') {
      alert('Could not open the saved project: ' + result.errors.join('; '));
      return false;
    }
    return true;
  }

  function duplicateProjectRow(row: ProjectListRow): void {
    if (!focusRow(row)) return;
    const taken = openProjects().map(projectDisplayName);
    appState.duplicateFocusedProject(appState.copyProjectName(taken));
  }

  function renameProjectRow(row: ProjectListRow): void {
    if (!focusRow(row)) return;
    projectsPaneOpen.value = false;
    goToProject();
  }

  function resolveProjectRow(_row: ProjectListRow): void {
    projectsPaneOpen.value = false;
    openCloudSync();
  }

  async function exportProjectRow(row: ProjectListRow): Promise<void> {
    if (!focusRow(row)) return;
    await designIO.saveProjectAs();
  }

  // New-version notice: checked on start, whenever the app comes back to the foreground, and every
  // few minutes while it stays open.
  const updateBannerVisible = computed(() => releases.newVersionAvailable.value);
  const reloadForUpdate = (): Promise<void> => releases.reload();
  const dismissUpdateBanner = (): Promise<void> => releases.dismiss();
  const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;
  let updateTimer: ReturnType<typeof setInterval> | undefined;
  function checkForUpdate(): void { if (document.visibilityState === 'visible') void releases.check(); }
  onMounted(() => {
    checkForUpdate();
    document.addEventListener('visibilitychange', checkForUpdate);
    updateTimer = setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
  });
  onUnmounted(() => {
    document.removeEventListener('visibilitychange', checkForUpdate);
    clearInterval(updateTimer);
  });

  const anyUnsaved = computed(() => openProjects().some(p => projectHasUnsavedChanges(p)));

  async function confirmDiscard(): Promise<boolean> {
    return confirmPort.port.ask({
      title: 'Discard changes?',
      message: 'Discard all unsaved changes and return to the last saved version?',
      confirmLabel: 'Discard',
      cancelLabel: 'Keep',
    });
  }
  function revertProject(): void {
    if (isModified.value) resetProjectToGround(confirmDiscard);
    closeMenu();
  }

  // Bug (John, live on his phone, 2026-09-29): "manage drivers appears as an overlay pop-up...
  // should be a regular pane." A destination, not the global DriverBrowser overlay (which stays
  // reachable, unchanged, from the Driver tab's own "Select driver" — MobileDriverTab-hooks.ts's
  // own browseDrivers, a different function).
  function browseDrivers(): void {
    pane.value = 'drivers';
    closeMenu();
  }

  const optionsOpen = ref(false);
  watch(optionsOpen, open => { if (open) featureUse.feature('options'); });
  function openOptions(): void { optionsOpen.value = true; closeMenu(); }
  function goToProject(): void { pane.value = 'project'; closeMenu(); }
  function goToAdvanced(): void { pane.value = 'advanced'; closeMenu(); }
  function closePane(): void { pane.value = null; }

  // The hamburger menu — the mobile shell's stand-in for the desktop toolbar, since there's
  // no room for individual icons at phone width. Everything it opens (Options, Driver browser,
  // the New Project wizard, Export) is the SAME modal/state the desktop toolbar drives; this
  // just gives mobile a way to reach it.
  const menuOpen = ref(false);
  function toggleMenu(): void { menuOpen.value = !menuOpen.value; }
  function closeMenu(): void { menuOpen.value = false; }

  // The Info menu's manual skin switch — the auto-by-viewport half lives in `App.vue`'s
  // `activeSkin` (`presentationState.narrowViewport`), which this override beats. Symmetric with
  // `OriginalShell-hooks.ts`'s `switchToMobile`.
  function switchToDesktop(): void { setSkinOverride('original'); closeMenu(); }

  // CSS `100vh`/`100dvh` is not enough on its own: real browsers vary in whether/when they
  // shrink it for their own chrome (a mobile address bar, a download shelf, any other bar a
  // given browser version adds). The shell takes its height from a JS measurement instead —
  // `visibleViewportHeightPx` says which number and why — re-read on every event any browser
  // fires when such a bar appears or disappears.
  const viewportHeightPx = ref(typeof window === 'undefined' ? 0 : visibleViewportHeightPx(window));
  function updateViewportHeight(): void { viewportHeightPx.value = visibleViewportHeightPx(window); }
  // DuckDuckGo fires neither a window nor a visualViewport resize when it hides its address bar,
  // and the bar's animation ends after the touch does: these events re-measure now and once more
  // on the next frame.
  function remeasureSoon(): void { updateViewportHeight(); requestAnimationFrame(updateViewportHeight); }
  onMounted(() => {
    window.addEventListener('resize', updateViewportHeight);
    window.visualViewport?.addEventListener('resize', updateViewportHeight);
    window.visualViewport?.addEventListener('scroll', updateViewportHeight);
    window.addEventListener('scroll', remeasureSoon);
    window.addEventListener('touchend', remeasureSoon);
    window.addEventListener('orientationchange', remeasureSoon);
    updateViewportHeight();
  });
  onUnmounted(() => {
    window.removeEventListener('resize', updateViewportHeight);
    window.visualViewport?.removeEventListener('resize', updateViewportHeight);
    window.visualViewport?.removeEventListener('scroll', updateViewportHeight);
    window.removeEventListener('scroll', remeasureSoon);
    window.removeEventListener('touchend', remeasureSoon);
    window.removeEventListener('orientationchange', remeasureSoon);
  });

  // Scroll affordance (John, 2026-10-02: "a visual indicator that there's something to scroll
  // down [or] up to") — a shadow under the top bar / above the tab bar, driven by the content
  // pane's own live scroll position rather than a CSS-only trick: `.mob-content`'s children are
  // opaque `.mob-panel` blocks that fill it edge to edge, so a background-gradient-based
  // indicator on `.mob-content` itself would sit entirely behind them and never be seen — the
  // shadow has to live on the ALWAYS-VISIBLE, never-covered top/tab bars instead.
  const contentEl = ref<HTMLElement | null>(null);
  const canScrollUp = ref(false);
  const canScrollDown = ref(false);
  function updateScrollEdges(): void {
    const el = contentEl.value;
    if (el === null) { canScrollUp.value = false; canScrollDown.value = false; return; }
    canScrollUp.value = el.scrollTop > 1;
    canScrollDown.value = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
  }
  // Catches content height changes the user didn't cause by scrolling (switching box type,
  // editing a field that shows/hides a hint row, …) without a per-field wiring: watches the
  // CURRENTLY MOUNTED tab's own root element, re-subscribed whenever the tab itself changes.
  let contentResizeObserver: ResizeObserver | null = null;
  function observeContentSize(): void {
    contentResizeObserver?.disconnect();
    contentResizeObserver = null;
    const child = contentEl.value?.firstElementChild;
    if (!child) return;
    contentResizeObserver = new ResizeObserver(updateScrollEdges);
    contentResizeObserver.observe(child);
  }
  function refreshScrollTracking(): void {
    void nextTick().then(() => {
      updateScrollEdges();
      observeContentSize();
    });
  }
  watch(destination, refreshScrollTracking);
  onMounted(() => {
    window.addEventListener('resize', updateScrollEdges);
    refreshScrollTracking();
  });
  onUnmounted(() => {
    window.removeEventListener('resize', updateScrollEdges);
    contentResizeObserver?.disconnect();
  });

  const cloudSyncUi = useCloudSyncUi(updateBannerVisible, () => {
    pane.value = 'cloudSync';
  });

  let longPressTimer: ReturnType<typeof setTimeout> | undefined;
  let didLongPress = false;

  function onSyncPointerDown(): void {
    didLongPress = false;
    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
      didLongPress = true;
      logging.flash(cloudSyncUi.display.value.tooltip);
    }, 500);
  }

  function onSyncPointerUp(): void {
    clearTimeout(longPressTimer);
  }

  function onSyncPointerCancel(): void {
    clearTimeout(longPressTimer);
  }

  onUnmounted(() => {
    clearTimeout(longPressTimer);
  });

  function handleSyncTap(action: SyncTap): void {
    if (didLongPress) {
      didLongPress = false;
      return;
    }
    cloudSyncUi.tap(action);
  }

  function openCloudSync(): void {
    pane.value = 'cloudSync';
    closeMenu();
  }

  function openConflict(id: ConflictCopy['id']): void {
    cloudSyncUi.openConflict(id);
    if (id instanceof ProjectId) {
      openStoredProject(id.text);
    } else if (id instanceof DriverId) {
      browseDrivers();
    }
  }

  return {
    projectOpen, projectTitle, destination, fileInput, openImportedFile, openNewProject, switchToDesktop,
    menuOpen, toggleMenu, closeMenu, exportProjectsArchive: () => designIO.exportProjectsArchive(), openFromDisk, isModified,
    saveProject, saveAllProjects, anyUnsaved, updateBannerVisible, reloadForUpdate, dismissUpdateBanner, revertProject, browseDrivers, optionsOpen, openOptions, about, goToProject,
    contentEl, canScrollUp, canScrollDown, updateScrollEdges, username, appVersion: appVersion.label,
    goToAdvanced, pane, closePane, viewportHeightPx, showEnclosureTab, enclosureNavLabel,
    projectsPaneOpen, openProjectsPane, closeProjectsPane,
    projectRows, shownProjects, projectsFooter, searchOffered, projectQuery, projectOrder, projectOrders, storeLabel: projectRepo.storeLabel, chooseProject,
    setProjectTraceVisible, cycleProjectColour, closeProjectRow, duplicateProjectRow, exportProjectRow, renameProjectRow, resolveProjectRow,
    binRows, binTotal, binOpen, binLabel, moveToBin: binView.moveToBin, restoreFromBin: binView.restoreFromBin, deleteForever: binView.deleteForever, emptyBin: binView.emptyBin,
    cloudEnabled: cloudSyncUi.available, cloudSyncDisplay: cloudSyncUi.display, handleSyncTap,
    onSyncPointerDown, onSyncPointerUp, onSyncPointerCancel, openCloudSync,
    reconnectCloud: cloudSyncUi.reconnect, openConflictNotice: cloudSyncUi.viewConflicts,
    turnOnHint: cloudSyncUi.hintTurnOn, dismissHint: cloudSyncUi.hintDismiss, connectCloud: cloudSyncUi.connect,
    syncNowCloud: cloudSyncUi.syncNow, disconnectCloud: cloudSyncUi.disconnect, openConflict,
  };
}
