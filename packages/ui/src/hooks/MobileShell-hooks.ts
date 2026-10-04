/**
 * `MobileShell.vue`'s hook — routing between the Design tabs and the full-screen Graph
 * destination, plus the manual skin switch and the no-project empty state. One hook, one
 * component (`.claude/rules/ui.md`); every ref/computed/write lives here.
 */
import {computed, nextTick, onMounted, onUnmounted, ref, watch} from 'vue';
import {
  addProject, boxTypeIsSimulatable, focusedProject, focusProject, isModified, openProjects, projectChanged,
  projectDisplayName, projectHasUnsavedChanges, removeProject, resetProjectToGround,
} from '../logic/appState.js';
import {isTraceVisible, setTraceVisible, traceVisibilityRevision} from '../logic/traceVisibility.js';
import type {OpenISDProject} from '@openisd/design';
import {cycleTraceColor, presentationState, setSkinOverride, traceColor} from '../logic/presentationState.js';
import {useApp} from '../logic/app.js';
import {inputFrom} from '../logic/domEvents.js';
import {injectSplashModal} from './SplashModal-hooks.js';
import type {TabId} from '../logic/tabId.js';
import {createSelectedBox} from './boxFields.js';
import type {StoredProjectListing} from '@openisd/persistence';

/** The mobile shell's own destinations: the same tab ids the desktop shell's content panel
 *  uses (so a shared field-wiring caller never has to ask "which shell is this"), plus `graph`
 *  — a destination that has no desktop counterpart, because `GraphPanel`'s canvas sets
 *  `touch-action: none` (custom pointer pan/zoom) and would trap vertical scroll if it sat
 *  inline in a form column instead of owning the whole screen. */
export type MobileDestination = Extract<TabId, 'box' | 'driver' | 'signal' | 'filters' | 'enclosure'> | 'graph';

/** The panes the hamburger menu opens as full-screen dialogs over the current destination. */
export type MobilePane = 'project' | 'advanced' | 'drivers';

export interface MobileShellApi {
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
  dismissUpdateBanner: () => void;
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
  /** The "Open project" sheet — previously-SAVED projects (browser storage), distinct from
   *  "Open a file" (`openFromDisk`, a disk import). Desktop's own `openDialogOpen`/
   *  `storedProjects`/`openStoredProject` (OriginalShell-hooks.ts), mobile had no equivalent
   *  (John, 2026-10-02: "the file menu offer no way to save and reopen projects"). */
  openDialogOpen: import('vue').Ref<boolean>;
  storedProjects: import('vue').Ref<StoredProjectListing[]>;
  openProjectDialog: () => void;
  openStoredProject: (id: string) => void;
  /** Every open project, saved or not — the same registry as desktop's Projects panel. */
  openProjectRows: import('vue').ComputedRef<OpenProjectRow[]>;
  selectOpenProject: (row: OpenProjectRow) => void;
  setOpenProjectTraceVisible: (row: OpenProjectRow, visible: boolean) => void;
  cycleOpenProjectColour: (row: OpenProjectRow) => void;
  closeOpenProject: (row: OpenProjectRow) => void;
}

/** One open project in the menu's "Open projects" list. */
export interface OpenProjectRow {
  readonly project: OpenISDProject;
  readonly name: string;
  readonly unsaved: boolean;
  readonly focused: boolean;
  /** Whether this project's trace is drawn on the graphs. */
  readonly traceVisible: boolean;
  /** The colour this project's curves are drawn in. */
  readonly colour: string;
}

export function useMobileShell(): MobileShellApi {
  const { designIO, projectRepo, releases } = useApp();
  const { saveProject, saveAllProjects } = designIO;
  const { show: about } = injectSplashModal();
  const projectOpen = computed(() => focusedProject() != null);
  const projectTitle = computed(() => { void projectChanged.value; return focusedProject()?.title() ?? ''; });
  const destination = ref<MobileDestination>('box');
  const pane = ref<MobilePane | null>(null);
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

  // "Open project" — previously-SAVED projects (browser storage), not a disk import. Desktop's
  // own openDialogOpen/storedProjects/openStoredProject (OriginalShell-hooks.ts); mobile had no
  // equivalent (John, 2026-10-02: "the file menu offer no way to save and reopen projects").
  const openDialogOpen = ref(false);
  const storedProjects = ref<StoredProjectListing[]>([]);
  function openProjectDialog(): void {
    storedProjects.value = projectRepo.listStoredProjects();
    openDialogOpen.value = true;
    closeMenu();
  }
  function openStoredProject(id: string): void {
    const result = projectRepo.loadStoredProject(id);
    if (Array.isArray(result)) {
      alert('Could not open the saved project: ' + result.join('; '));
      return;
    }
    addProject(result);
    openDialogOpen.value = false;
  }

  // "Open projects" — the registry desktop's Projects panel lists (OriginalShell-hooks.ts), so a
  // project that is open but never saved is reachable here too.
  const openProjectRows = computed<OpenProjectRow[]>(() => {
    const focused = focusedProject();
    void traceVisibilityRevision.value;
    return openProjects().map(project => ({
      project,
      name: projectDisplayName(project),
      unsaved: projectHasUnsavedChanges(project),
      focused: project === focused,
      traceVisible: isTraceVisible(project),
      colour: traceColor(project),
    }));
  });
  // New-version notice: checked on start, whenever the app comes back to the foreground, and every
  // few minutes while it stays open.
  const updateDismissed = ref(false);
  const updateBannerVisible = computed(() => releases.newVersionAvailable.value && !updateDismissed.value);
  const reloadForUpdate = (): Promise<void> => releases.reload();
  function dismissUpdateBanner(): void { updateDismissed.value = true; }
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

  const anyUnsaved = computed(() => openProjectRows.value.some(row => row.unsaved));
  function selectOpenProject(row: OpenProjectRow): void {
    const index = openProjects().indexOf(row.project);
    if (index >= 0) focusProject(index);
    closeMenu();
  }
  function setOpenProjectTraceVisible(row: OpenProjectRow, visible: boolean): void {
    setTraceVisible(row.project, visible);
  }
  function cycleOpenProjectColour(row: OpenProjectRow): void { cycleTraceColor(row.project); }
  function closeOpenProject(row: OpenProjectRow): void {
    if (row.unsaved && !globalThis.confirm(`"${row.name}" has unsaved changes. Close it without saving?`)) return;
    const index = openProjects().indexOf(row.project);
    if (index >= 0) removeProject(index);
  }

  async function confirmDiscard(): Promise<boolean> {
    return globalThis.confirm('Discard all unsaved changes and return to the last saved version?');
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
  // given browser version adds) — a bug John hit live, where the bottom tab bar ended up mostly
  // hidden under one of these. `window.innerHeight` is the one number that is ALWAYS the actual
  // visible height regardless of the cause, and every one of those bars appearing or disappearing
  // fires `resize`, so this stays correct without needing to know what the bar even was.
  const viewportHeightPx = ref(typeof window === 'undefined' ? 0 : window.innerHeight);
  function updateViewportHeight(): void { viewportHeightPx.value = window.innerHeight; }
  onMounted(() => window.addEventListener('resize', updateViewportHeight));
  onUnmounted(() => window.removeEventListener('resize', updateViewportHeight));

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

  return {
    projectOpen, projectTitle, destination, fileInput, openImportedFile, openNewProject, switchToDesktop,
    menuOpen, toggleMenu, closeMenu, openFromDisk, isModified,
    saveProject, saveAllProjects, anyUnsaved, updateBannerVisible, reloadForUpdate, dismissUpdateBanner, revertProject, browseDrivers, optionsOpen, openOptions, about, goToProject,
    contentEl, canScrollUp, canScrollDown, updateScrollEdges, username,
    goToAdvanced, pane, closePane, viewportHeightPx, showEnclosureTab, enclosureNavLabel,
    openDialogOpen, storedProjects, openProjectDialog, openStoredProject,
    openProjectRows, selectOpenProject, setOpenProjectTraceVisible, cycleOpenProjectColour, closeOpenProject,
  };
}
