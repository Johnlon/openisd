/** STATE: the app's live reactive truth — Vue's sense of "store". Not persistence. */
/**
 * `appState.ts` — the app's Vue-reactive state HOLDER, and nothing more.
 *
 * ── What this file MUST NOT do (human ruling 2026-08-18, ARCHITECTURE.md §5) ──
 * It must never CALCULATE a value — not even by correctly calling out to a properly
 * single-sourced formula function. A calculated value is a property or method on the domain
 * object that owns it (`OpenISDDriver`/`ManagedProject`), read by this file, never
 * computed IN this file. If a value this file needs isn't exposed on the owning domain object
 * yet, the fix is adding it there as a getter/method — never computing it here "just this
 * once," however small or well-sourced the calculation looks. This file's only legitimate
 * jobs are: hold Vue-reactive references, delegate reads/writes to the focused project/the
 * project registry, and bridge notifications into Vue's reactivity system.
 */

import {NoTelemetry, type Telemetry} from '../telemetry/telemetry.js';
import type {ProjectSource} from '../telemetry/events.js';
import {computed, reactive, ref, type ComputedRef, type Ref, shallowRef, type ShallowRef, triggerRef, watch, type WritableComputedRef} from 'vue';
import type {
    BoxType, ChartId, DriverError, DriverPrerequisite, MaxCurvesResult, MaxCurvesSolveResult, SweepIssue, SweepResult,
    VentedDesignLimits,
} from '@openisd/design/engine';
import {DEFAULT_ENV_DEFAULTS, DEFAULT_VENTED_DESIGN_LIMITS, type Engine, type EnvDefaults} from '@openisd/design/engine';
import {driverPrerequisiteMessage, sweepIssueMessage} from './sweepIssueMessage.js';
import {SweepScheduler} from './sweepScheduler.js';
import {LatestSweepRunner} from './latestSweepRunner.js';
import {SweepComputer, type SweepReply} from './sweepRequest.js';
import {sweepTransport} from './sweepTransport.js';
import {
    type AppContext,
    type BoxProjectBuilder,
    type DiscardChallenge,
    type DriverSpecFieldName,
    type NumericDriverSpecFieldName,
    type FrequencyGrid,
    type OpenISDDriver,
    OpenISDPassiveRadiatorStandalone,
    OpenISDProject,
    ProjectBuilder,
    realAppContext,
} from '@openisd/design';
import type {YRange} from '../types.js';
import {type PlotParams, TABS} from '@openisd/design/chart';
import {
    type AppSettingsRepo, copyOfName, uniqueName,
    type ViewSnapshot,
} from '@openisd/persistence';
import {assignTraceColor, type PresentationState} from './presentationState.js';
import {BOX_TYPE_OPTIONS, NumberField, parseUnitRotation, type SelectorOption} from '@openisd/design/fields';
import {ventSolveSuspended} from './ventGroup.js';
import {notifyPrChanged} from './prGroup.js';

/** The driver spec fields the app's UI reads/writes by name — the schema's own spec keys.
 *  Derived, never a hand-maintained copy. */
export type SpecField = DriverSpecFieldName;

/** The subset of SpecField that represent numeric quantities (all except non-numeric VCCon).
 *  The domain's own name for them — the exclusion is stated once, where `specField` takes it. */
export type NumSpecField = NumericDriverSpecFieldName;

// appState.ts does not persist — it initialises to defaults, and App.vue applies whatever a
// load door hands over (a share link, or an opened file).

// ---- The project registry: ManagedProject instances, and NOTHING else ---------------------
// ARCHITECTURE.md §"Approved state stores": each ManagedProject holds ALL its own active/
// edit/what-if state. appState does not hold a driver, does not hold a baseline, and does not
// know a what-if exists — a second copy of any of those is a second answer to the same
// question, and the two are free to disagree. Everything below DELEGATES; it holds nothing of
// its own beyond WHICH projects are open and which is focused.
//
// A `ManagedProject`'s framework-free subscribe() is bridged to Vue through `live` (below) —
// a shallow ref that always holds WHICHEVER project is currently focused, re-subscribed on
// every focus change: it fires on every change the facade decides a subscriber should see (a
// what-if overlay fires live), and the computeds below touch `live.value` so they re-derive
// exactly then. @openisd/model stays Vue-free — the arrow points up, never down.

/** How an OPEN project is recognised so that opening it again switches to its tab instead of
 *  adding a second one (BUG_20261009_same-project-opens-many-times). A stored project is known
 *  by the store id it was loaded from; a file-opened project by the exact name and content it
 *  was opened from. Recorded AT OPEN TIME and never recomputed from a project that may since
 *  have been edited (human ruling, John 9 Oct 2026: "the stored project id if it has one, else
 *  the file name + content"). */
export interface StoredProjectIdentity {
  readonly kind: 'stored';
  readonly id: string;
}

export interface FileProjectIdentity {
  readonly kind: 'file';
  readonly name: string;
  readonly content: string;
}

export type OpenProjectIdentity = StoredProjectIdentity | FileProjectIdentity;

/** The built-in band — what an unconfigured app reads and what "Reset to defaults" writes.
 *
 *  Published here, not imported from the engine by whoever needs it: `ui/logic` is the layer
 *  the engine edge is ruled legal on (QO80 matrix, `test/architecture/architecture.test.ts`), and this
 *  module is already the settings seam every hook reads the band through. */
export const FACTORY_VENTED_LIMITS: VentedDesignLimits = DEFAULT_VENTED_DESIGN_LIMITS;

/** The built-in environment — what an unconfigured app reads and what "Reset to defaults" writes. */
export const FACTORY_ENV_DEFAULTS: EnvDefaults = DEFAULT_ENV_DEFAULTS;

/** Whether two identities name the SAME project. */
function sameOpenIdentity(a: OpenProjectIdentity, b: OpenProjectIdentity): boolean {
  if (a.kind === 'stored' && b.kind === 'stored') return a.id === b.id;
  if (a.kind === 'file' && b.kind === 'file') return a.name === b.name && a.content === b.content;
  return false;
}

/** Thrown by `requireFocusedProject()` when no project is open. A small, deliberate,
 *  named exception — not a wrapper/Null Object of any kind (human ruling, PROMPT_RELEASE_
 *  HARDENING plan) — so a caller asserting "a project must be focused right now" gets a
 *  specific, catchable type instead of a bare null-dereference `TypeError`. */
export class NoFocusedProjectError extends Error {
  constructor() { super('no project is focused'); }
}

// Dedupe by field+message: `sweep` and `maxCurves` report the same driver-completeness issue
// (`maxCurves` forwards whatever `sweep` itself returned), so a naive concat shows every issue
// twice. Projected through `sweepIssueMessage` first — the engine's `SweepIssue` (QO142) is
// structured (`CalculationIssue<Q>`), not the `DriverError` shape this channel already renders.
function sweepIssueMessages(issues: readonly SweepIssue[], prerequisites: readonly DriverPrerequisite[]): DriverError[] {
  return [...new Map(
    [...issues.map(issue => sweepIssueMessage(issue)), ...prerequisites.map(driverPrerequisiteMessage)]
      .map(e => [`${e.field ?? ''}|${e.message}`, e]),
  ).values()];
}

/** The New Project wizard's starting choices — name, box type, and its starting volume(s) in
 *  LITRES (the wizard's own display unit; converted to SI here, the one place that owns the
 *  litres↔m³ factor, rather than the wizard hand-rolling `/1000`). `frontVolumeL` only applies
 *  to a dual-chamber box (bandpass4). The driver comes separately — the wizard collects this
 *  spec, then the driver picker chooses the driver, and only then is the project built. */
export interface NewProjectSpec {
  name: string;
  box: BoxType;
  volumeL: number;
  frontVolumeL?: number;
}

/** A sealed box's starting volume, litres — the New Project wizard's own default, and the
 *  volume a project opened straight from a bare `.wdr`/`.owdr` driver file starts at (the user
 *  refines it on the Box tab). */
export const DEFAULT_SEALED_VOLUME_L = 6;


/** What `createAppState` is built over. */
export interface AppStateDeps {
  /** The one engine. It reads the plausibility band and environment from `appSettings`, so the
   *  composition root builds the engine over the same repo. */
  engine: Engine;
  appSettings: AppSettingsRepo;
  presentation: PresentationState;
  /** Where usage events go; omitted means none are recorded. */
  telemetry?: Telemetry;
}

/** The app's live reactive state: the open-project registry, the focused project's sweep curves
 *  and issues, and the application settings. Built once by the composition root, reached by
 *  components through `useApp().appState`. */
export interface AppState {
  /** The WinISD difference markers (≠W) show (Options → General). Reactive. */
  differenceCuesShown(): boolean;
  /** Show or hide every ≠W marker. A UI preference: no project recalls. */
  setDifferenceCuesShown(shown: boolean): void;
  /** The band designed vented boxes are judged against. */
  ventedLimits(): VentedDesignLimits;
  /** Change the band, then recall every open project so its marks match the new one. */
  setVentedLimits(limits: VentedDesignLimits): void;
  /** The environment a project reads for any of temperature/humidity/pressure it has not entered. */
  envDefaults(): EnvDefaults;
  /** Change the environment, then recall every open project so its calculated air repaints. */
  setEnvDefaults(defaults: EnvDefaults): void;
  readonly engine: Engine;
  /** The domain's ambient facts, with `platformUser` reading the app's Username setting. */
  readonly appContext: AppContext;
  openProjects(): OpenISDProject[];
  focusedProject(): OpenISDProject | null;
  focusProject(index: number): void;
  removeProject(index: number): void;
  addProject(project: OpenISDProject): void;
  openProjectByIdentity(identity: OpenProjectIdentity): OpenISDProject | null;
  openProjectOnce(project: OpenISDProject, identity: OpenProjectIdentity): OpenISDProject;
  restoreProjects(restored: OpenISDProject[], requestedFocus: number, traceHidden: ReadonlySet<OpenISDProject>): void;
  requireFocusedProject(): OpenISDProject;
  duplicateFocusedProject(newName: string): void;
  readonly driverName: ComputedRef<string>;
  projectDisplayName(p: OpenISDProject): string;
  projectHasUnsavedChanges(p: OpenISDProject): boolean;
  openDriverPicker(): void;
  readonly syncedP: ComputedRef<PlotParams>;
  readonly curvesData: Ref<SweepResult | null>;
  readonly maxData: Ref<MaxCurvesResult | null>;
  readonly paramIssues: ComputedRef<DriverError[]>;
  readonly allIssues: ComputedRef<DriverError[]>;
  readonly isModified: ComputedRef<boolean>;
  markProjectSaved(): void;
  resetProjectToGround(confirm: DiscardChallenge): Promise<boolean>;
  newProject(): OpenISDProject;
  boxTypeIsSimulatable(boxType: BoxType): boolean;
  readonly IMPLEMENTED_BOX_TYPES: readonly BoxType[];
  newProjectBoxTypeOptions(): readonly SelectorOption<BoxType>[];
  definePassiveRadiator(): void;
  createProject(driver: OpenISDDriver, box: (b: ProjectBuilder) => BoxProjectBuilder): OpenISDProject;
  openProjectFromDriver(driver: OpenISDDriver, name: string): void;
  readonly newProjectDriver: ShallowRef<OpenISDDriver | null>;
  copyProjectName(taken: readonly string[]): string;
  readonly projectChanged: ComputedRef<number>;
  currentViewSnapshot(): ViewSnapshot;
  applyLoadedProject(project: OpenISDProject): void;
  applyViewSnapshot(v: ViewSnapshot): void;
  applyState(o: { project: OpenISDProject; view: ViewSnapshot }): void;
  readonly simVcInductance: WritableComputedRef<boolean>;
  /** Read by computeds that depend on `isTraceVisible`; bumped by every `setTraceVisible`. */
  readonly traceVisibilityRevision: Ref<number>;
  /** Whether `p`'s trace is drawn on the graphs. */
  isTraceVisible(p: OpenISDProject): boolean;
  setTraceVisible(p: OpenISDProject, visible: boolean): void;
  /** Which of `projects` have their trace hidden — what the open-project session saves. */
  hiddenTraces(projects: readonly OpenISDProject[]): Set<OpenISDProject>;
}

export function createAppState(deps: AppStateDeps): AppState {
  const telemetry: Telemetry = deps.telemetry ?? new NoTelemetry();
  const recordOpen = (source: ProjectSource, p: OpenISDProject): void =>
    telemetry.record({kind: 'project_open', source, box: p.box.boxType.value});
  // ---- Application settings: what the user set for the APP, not for a project ---------------
  // The band that decides which designed values get a DQ mark is one of these (John 2026-09-22:
  // "we can make the limits application level limit settings in a new settings tab").
  //
  // The repo is a dependency: the composition root hands in the browser-backed one, a test hands in
  // an in-memory one. `engine` was built over the same repo, so its plausibility band and this
  // module's `ventedLimits()` answer from one store.
  const appSettings: AppSettingsRepo = deps.appSettings;
  const presentation: PresentationState = deps.presentation;
  const engine: Engine = deps.engine;
  /** Bumped on every write of a UI-only app setting, so a computed reading it re-derives. */
  const appSettingsTick = ref(0);

  // Whether each open project's trace is drawn on the graphs (the Projects list's show/hide
  // checkbox, shared by both skins). Never saved in a project file; the open-project session
  // stores it (`hiddenTraces`), so a reload restores it. `traceVisibilityRevision` is the
  // dependency computeds read: a reactive WeakMap's key operations are not reliably trackable
  // inside a computed, while a plain ref always fires.
  const visibleOf = reactive(new WeakMap<OpenISDProject, boolean>());
  const traceVisibilityRevision = ref(0);
  function isTraceVisible(p: OpenISDProject): boolean {
    return visibleOf.get(p) ?? true;
  }
  function setTraceVisible(p: OpenISDProject, visible: boolean): void {
    visibleOf.set(p, visible);
    traceVisibilityRevision.value++;
  }
  function hiddenTraces(projects: readonly OpenISDProject[]): Set<OpenISDProject> {
    return new Set(projects.filter(p => !isTraceVisible(p)));
  }

  /** The WinISD difference markers (≠W) show (Options → General). Reactive. */
  function differenceCuesShown(): boolean {
    void appSettingsTick.value;
    return appSettings.differenceCuesShown();
  }

  /** Show or hide every ≠W marker. A UI preference: no project recalls. */
  function setDifferenceCuesShown(shown: boolean): void {
    appSettings.setDifferenceCuesShown(shown);
    appSettingsTick.value++;
  }


  /** The band designed vented boxes are judged against. */
  function ventedLimits(): VentedDesignLimits {
    return appSettings.ventedLimits();
  }

  /** Change the band, then recall EVERY open project so its marks match the new one.
   *
   *  Every open project, not just the focused one: a background tab's stored marks would
   *  otherwise stay as the old band left them until something else happened to edit it. The
   *  recall re-resolves and notifies without marking a project edited — a settings change is not
   *  a design change — and the notification is what `live`'s subscriber turns into a repaint. */
  function setVentedLimits(limits: VentedDesignLimits): void {
    appSettings.setVentedLimits(limits);
    for (const project of projects.value) project.appSettingsChanged();
  }


  /** The environment a project reads for any of temperature/humidity/pressure it has not entered
   *  (Options → General → Environment). */
  function envDefaults(): EnvDefaults {
    return appSettings.envDefaults();
  }

  /** Change the environment, then recall EVERY open project so its calculated air repaints —
   *  the same recall as `setVentedLimits`, for the same reason. */
  function setEnvDefaults(defaults: EnvDefaults): void {
    appSettings.setEnvDefaults(defaults);
    for (const project of projects.value) project.appSettingsChanged();
  }

  /** The domain's ambient facts, with `platformUser` overridden to read the app's own Username
   *  setting (Options → General, `presentation.ui.username`) — the one place a new
   *  project/driver/PR's `creator`/`providedBy` default comes from. Detached once stamped: this
   *  is read only at construction time, so a later change to the Username setting never rewrites
   *  an already-created record. */
  const appContext: AppContext = Object.freeze({
    ...realAppContext,
    platformUser: (): string | null => presentation.ui.username || null,
  });

  /**
   * The multi-project registry (human ruling, 2026-08-18) — replaces `workspace.ts`'s ad-hoc
   * `WorkspaceEntry`/`OpenProject` and `OriginalShell.vue`'s own former local `openProjects`/
   * `activeProjectId` reimplementation as the ONE place "which projects are open, which is
   * focused" lives.
   *
   * Starts EMPTY — the app has no project until one is opened or created (John, 2026-09-08:
   * "there is either selected project or not selected project"). `App.vue`'s top-level
   * `v-if="project"` gate renders the empty state while `focusedProject()` is null.
   */
  const projects = shallowRef<OpenISDProject[]>([]);
  const focusedIndex = ref(0);
  const openIdentities = new WeakMap<OpenISDProject, OpenProjectIdentity>();

  /** Every open project. Empty array if none are open. */
  function openProjects(): OpenISDProject[] { return projects.value; }

  /** The project currently focused in the UI's project list, or null if none are open. */
  function focusedProject(): OpenISDProject | null {
    return projects.value[focusedIndex.value] ?? null;
  }

  /** Move focus to the project at `index` — called when the user changes the active project in
   *  the UI's project list. Out-of-range indices are ignored.
   *
   *  Closes What-if? and the Driver Editor modal on the project being left, BEFORE moving focus
   *  (`presentation.editDriver = false`/`editDriverInfo = false`) — same "any focus-
   *  changing action closes what was open" pattern as `openDriverPicker()` above. */
  function focusProject(index: number): void {
    if (index < 0 || index >= projects.value.length || index === focusedIndex.value) return;
    projects.value[focusedIndex.value]?.cancelWhatIf();
    presentation.editDriver = false;
    presentation.editDriverInfo = false;
    focusedIndex.value = index;
  }

  /** Remove the project at `index` from the registry. If the focused index is now past the end,
   *  it clamps to the new last project; if the registry is now empty, the index is left alone —
   *  `focusedProject()` already answers null for an out-of-range index, nothing to noop around. */
  function removeProject(index: number): void {
    if (index < 0 || index >= projects.value.length) return;
    projects.value[index]?.cancelWhatIf();
    // shallowRef: reassign a new array rather than splice in place, or the removal wouldn't
    // trigger reactivity — shallowRef only tracks .value replacement, not in-place mutation.
    const next = projects.value.slice();
    next.splice(index, 1);
    projects.value = next;
    if (next.length > 0 && focusedIndex.value >= next.length) {
      focusedIndex.value = next.length - 1;
    }
  }

  /** Add a newly-created or re-imported project to the registry and focus it. */
  function addProject(project: OpenISDProject): void {
    assignTraceColor(project, projects.value);
    projects.value = [...projects.value, project];
    focusedIndex.value = projects.value.length - 1;
  }


  /** The open project carrying `identity`, or null. Registry bookkeeping — the identity was
   *  recorded when the project was opened, never derived from its (possibly edited) contents now. */
  function openProjectByIdentity(identity: OpenProjectIdentity): OpenISDProject | null {
    return projects.value.find(project => {
      const recorded = openIdentities.get(project);
      return recorded !== undefined && sameOpenIdentity(recorded, identity);
    }) ?? null;
  }

  /** Open `project` — the ONE door the stored-project dialog and the file import go through, so a
   *  project that is already open is never opened a second time. When a project with `identity` is
   *  already open, focus that one and discard `project` (the freshly loaded duplicate); otherwise
   *  record `identity`, add `project` and focus it. New projects, copies, share links and session
   *  restores call `addProject` directly: they have no existing identity to collide with. */
  function openProjectOnce(project: OpenISDProject, identity: OpenProjectIdentity): OpenISDProject {
    const existing = openProjectByIdentity(identity);
    if (existing) {
      focusProject(projects.value.indexOf(existing));
      return existing;
    }
    openIdentities.set(project, identity);
    addProject(project);
    recordOpen(identity.kind, project);
    return project;
  }

  /** Replace the open-project registry with a refresh-restored session; `traceHidden` are the
   *  restored projects whose trace the session had hidden. */
  function restoreProjects(restored: OpenISDProject[], requestedFocus: number, traceHidden: ReadonlySet<OpenISDProject>): void {
    for (const p of restored) {
      assignTraceColor(p, restored);
      setTraceVisible(p, !traceHidden.has(p));
    }
    projects.value = restored.slice();
    focusedIndex.value = restored.length === 0 ? 0 : Math.min(Math.max(requestedFocus, 0), restored.length - 1);
  }


  /** Assert a project is focused right now and return it. Throws `NoFocusedProjectError`
   *  when `focusedProject()` is null — a defensive boundary check for code that must run with
   *  a real project (the gate's own provide, or any write path only ever reached from inside
   *  the gate). The gate's own null-check for deciding whether to render the empty state stays
   *  `focusedProject() === null` — that path is expected, not an error. */
  function requireFocusedProject(): OpenISDProject {
    const p = focusedProject();
    if (!p) throw new NoFocusedProjectError();
    return p;
  }

  /** Duplicate the FOCUSED project's own design into a brand-new, independent tab under
   *  `newName`, and focus it. Round-trips through the project's own `.owpr` text — the same
   *  serialised form every persistence door carries — so the copy is a genuinely separate
   *  `OpenISDProject` with its own edit layer, never a second reference to the source's, and
   *  `fromOwprText` mints it a fresh identity rather than inheriting the source's. */
  function duplicateFocusedProject(newName: string): void {
    const source = requireFocusedProject();
    const loaded = OpenISDProject.fromOwprText(source.toOwprText(), engine);
    if (Array.isArray(loaded)) {
      throw new Error(`duplicateFocusedProject: round trip refused its own project: ${loaded.join('; ')}`);
    }
    addProject(loaded);
    loaded.name.set(newName);
    loaded.save();
  }

  // The one Vue bridge onto WHICHEVER project is currently focused. Re-subscribes on every
  // focus change or open/close of a project (the `watch([projects, focusedIndex], ...)` inside
  // the initializer below), so every reader touching `live.value` sees the newly focused
  // project and re-fires on its own mutations. `live.value` is null exactly when
  // `focusedProject()` is null.
  // The tick counter behind `projectChanged` (see its export below). Bumped at the SAME two
  // sites that make `live` re-fire, because those are exactly the events the hook must hear.
  // It is a counter, not a derived value: a `computed` only notifies when its VALUE changes, so
  // anything derived from current state goes quiet the moment two consecutive edits leave that
  // derivation equal — which for a change signal is always.
  const changeTicks: Ref<number> = ref(0);

  const live: ShallowRef<OpenISDProject | null> = (() => {
    const liveRef = shallowRef<OpenISDProject | null>(null);
    let disposeCurrent: (() => void) | null = null;
    function resubscribe(): void {
      if (disposeCurrent) { disposeCurrent(); disposeCurrent = null; }
      const p = projects.value[focusedIndex.value] ?? null;
      liveRef.value = p;
      changeTicks.value++;
      if (p) disposeCurrent = p.subscribe(() => { triggerRef(liveRef); changeTicks.value++; });
    }
    watch([projects, focusedIndex], resubscribe, { flush: 'sync' });
    resubscribe();
    return liveRef;
  })();


  // ---- Vent group ------------------------------------------------------------------------------
  // No watch: the domain solves the tuning ↔ vent-length pair synchronously inside every write
  // (`OpenISDProject#resolve()`), so a store-side re-solve adds only a redundant second solve.
  //
  // `solvingVent` / `ventSolveSuspended()` guard the PR watch below the same way: the solver's own
  // write must not re-enter the watcher, and a restore assigns a whole persisted snapshot that must
  // be adopted verbatim (docs/design/STATE_MODEL.md rule 3, "Cancel means byte-identical").
  // `live` is a shallow ref whose `.value` is the SAME focused-project reference on every
  // notification, so a watch passes `live` itself, never a getter that reads `live.value` — a
  // getter source is gated on Vue's `hasChanged(newValue, oldValue)`, which an invariant
  // reference always fails, so the callback would never run
  // (`BUG_20260822_pr_group_auto_solve_watch_never_fires_after_the_live_repoint.md`).
  let solvingVent = false;

  // ---- PR tuning group: added mass ↔ system tuning -----------------------------------------
  // Shares the vent group's suspension flag and the same `live` dependency.
  watch(
    live,
    () => {
      if (solvingVent || ventSolveSuspended()) return;
      const p = live.value;
      if (!p) return;
      solvingVent = true;
      try { notifyPrChanged(p); } finally { solvingVent = false; }
    },
    { flush: 'sync', immediate: true },
  );

  /** What this driver is CALLED — brand and model as the record states them, from the FOCUSED
   *  project's driver. '' when nothing names it (no driver chosen, or no project focused), so a
   *  caller can fall back. */
  const driverName = computed<string>(() => {
    void live.value;
    if (!live.value) return '';
    return [live.value.driver.brand.value, live.value.driver.model.value]
      .filter((x): x is string => !!x && x.length > 0).join(' ').trim();
  });

  /** A project's display name in any project list — its own `name`, falling back to its driver's
   *  brand and model. Any open project, not only the focused one. */
  function projectDisplayName(p: OpenISDProject): string {
    void projectChanged.value; void live.value;
    const name = p.name.value;
    if (name) return name;
    return [p.driver.brand.value, p.driver.model.value].filter(x => x.length > 0).join(' ').trim();
  }

  /** Whether `p` has unsaved edits — any open project, not only the focused one. A background
   *  project cannot be edited, so its answer only changes on focus, save or open. */
  function projectHasUnsavedChanges(p: OpenISDProject): boolean {
    void projectChanged.value; void live.value;
    return p.isModified();
  }

  /**
   * Open the driver picker — the ONE governed entry point. Every "Select Driver"/"Browse…"
   * trigger calls this, never a raw `presentation.browseOpen = true`. No-ops when no
   * project is focused — there is nothing to pick a driver for.
   */
  function openDriverPicker(): void {
    if (!focusedProject()) return;
    presentation.browseOpen = true;
  }

  /** The chart panels' shared X-axis range plus the display-only flags `series.ts` reads —
   *  everything a `Design.P` needs. `fmin`/`fmax` come from `presentation.sweepRange` —
   *  global across every open project (John 2026-09-24), not a per-project saved value — so the
   *  Options dialog and the axis-drag zoom (`GraphPanel.vue`) share the one range regardless of
   *  which project is focused. */
  const syncedP = computed<PlotParams>(() => {
    const p = live.value;
    if (!p) return {fmin: presentation.sweepRange.min, fmax: presentation.sweepRange.max};
    const box = p.box.boxType.value;
    const prXmax = box === 'box-passive-radiator'
      ? (p.box.passiveRadiator.radiator.spec.Xmax_m.value ?? undefined)
      : undefined;
    return {
      fmin: presentation.sweepRange.min,
      fmax: presentation.sweepRange.max,
      splXmaxLimited: p.splGraphIsXmaxLimited.value,
      prXmax,
      portVelocityLimit_m_per_s: p.portVelocityLimit_m_per_s.value,
    };
  });

  const curves = ref<SweepResult | null>(null);
  const max = ref<MaxCurvesResult | null>(null);
  // The value-only refs above DISCARD the sweep's own errors. A driver that cannot be simulated
  // (no Qms/BL/Rms to split the Q group) makes `curves` null with an error in `sweep().errors` that
  // `allIssues` would otherwise never see — a silently blank chart. Captured here for the issue
  // channel so GraphPanel's "Can't plot / Fix the driver parameters" state actually fires.
  const sweepErrors = ref<DriverError[]>([]);
  // The last max-curves solve, kept for the issue channel while burst steps skip max curves
  // (`SweepScheduler`); the settle run replaces it.
  const lastMax = shallowRef<MaxCurvesSolveResult | null>(null);

  function showNoCurves(errors: DriverError[]): void {
    sweepRunner.cancel();
    lastMax.value = null;
    curves.value = null;
    max.value = null;
    sweepErrors.value = errors;
  }


  /** The worker's answer for the focused project. A step without max curves keeps the last ones. */
  function showSweep(reply: SweepReply): void {
    const mx = reply.max ?? lastMax.value;
    lastMax.value = mx;
    curves.value = reply.sweep.values;
    max.value = mx?.values ?? null;
    sweepErrors.value = sweepIssueMessages(
      [...reply.sweep.issues, ...(mx?.issues ?? [])], mx?.driverPrerequisites ?? []);
  }

  // The sweep runs in a Web Worker so a held spinner never blocks the page: one request in
  // flight, only the newest waiting, a reply for a project no longer focused dropped.
  const sweepRunner = new LatestSweepRunner<OpenISDProject>(
    sweepTransport(new SweepComputer(engine.simulation), reply => sweepRunner.replied(reply)),
    (_project, reply) => showSweep(reply),
  );

  const doSweep = (withMax = true) => {
    const p = live.value;
    if (!p) {
      showNoCurves([]);
      return;
    }
    const boxType = p.box.boxType.value;
    if (!boxTypeIsSimulatable(boxType)) {
      // `sweep()`/`maxCurves()` answer `{values: null, issues: []}` for a topology the engine has
      // no circuit for (bandpass6, abc) — an empty issue list, so nothing downstream ever named
      // the reason the chart is blank (S3/T4, QO145). Named here instead of in the domain: the
      // domain's null already IS the correct "not yet implemented" answer for those types: it is
      // this presentation-layer channel that was dropping it on the floor.
      showNoCurves([{level: 'error', field: 'boxType', message: `Not yet implemented — ${boxType}`}]);
      return;
    }
    // The chart axis and the sweep read one range: the project's, or WinISD's 10 Hz–20 kHz Plot
    // Window default when it stores none (`syncedP`). A grid of the store's own left the axis at
    // 1 Hz and the curves starting at 10 Hz.
    const grid: FrequencyGrid = { fmin: syncedP.value.fmin, fmax: syncedP.value.fmax };
    const plan = p.sweepPlan(grid);
    if (plan.kind === 'blocked') {
      showNoCurves(sweepIssueMessages(plan.issues, []));
      return;
    }
    sweepRunner.run(p, plan.job, withMax || lastMax.value === null);
  };
  doSweep();
  // The chart curves redraw DURING a held/rapid spinner drag, not only after release: the first
  // change runs at once, then at most once per SWEEP_MS (~30 fps) while changes keep coming, with a
  // trailing run for the final value. Max curves only run per step while a chart that draws them is
  // open; otherwise once the changes settle (`SweepScheduler`).
  const SWEEP_MS = 32;
  const SETTLE_MS = 150;
  const MAX_CHARTS: readonly ChartId[] = ['MaxSPL', 'MaxPwr'];
  const sweepScheduler = new SweepScheduler(
    doSweep,
    () => live.value?.openCharts.value.some(c => MAX_CHARTS.includes(c)) ?? false,
    {
      now: () => performance.now(),
      schedule: (fn, ms) => { const h = setTimeout(fn, ms); return () => clearTimeout(h); },
    },
    SWEEP_MS,
    SETTLE_MS,
  );
  watch(live, () => sweepScheduler.changed());

  // Postcondition (hardening): a valid driver can still yield a non-finite sweep at
  // some frequency (a numerical singularity the input guards can't foresee). Classify
  // the sweep output so it's never a silently blank chart — surfaced through the same
  // issue channel as the project's own errors. Empty when the driver is invalid (no sweep)
  // or the sweep is clean.
  const curveIssues = computed<DriverError[]>(() => {
    const sw = curves.value, mx = max.value;
    const p = live.value;
    if (!sw || !p) return [];
    // classifyFinite: a singularity made the curve undrawable. classifyMaxFinite: the same
    // question asked of the Max-SPL/Max-power pair, which is computed after the sweep and can
    // be non-finite while every sweep array is fine. classifyFlatClamp: force-flat ran out of
    // allowed boost, so the "flat" response is not flat below some frequency — a truncated
    // inverse filter must never look like a design that flattens for free.
    return [...p.classifyFiniteIssues(sw), mx ? p.classifyMaxFinite(mx) : null, p.classifyFlatClamp(sw)]
      .filter((e): e is DriverError => e !== null);
  });

  // Precondition (hardening, CODE_REVIEW.md §18): the enclosure parameters the circuit
  // divides by — Vb everywhere, Sp/Vf/PR per box type. The postcondition above does catch
  // the resulting garbage, but only as "no usable values"; this names the field to change.
  // Validated at the same boundary, on the same project the sweep is actually run on.
  const paramIssues = computed<DriverError[]>(() => {
    void live.value;
    return live.value ? live.value.boxParamsIssues().map(issue => sweepIssueMessage(issue)) : [];
  });

  // The full issue list the UI shows: box-parameter issues + sweep/max-curve finiteness issues.
  // `sweep(grid).errors`/`maxCurves(grid).errors` would duplicate `paramIssues` (both come from
  // the same `solveBoxParams` call inside the project's own sweep/maxCurves), so this reads only
  // the postcondition classifications on top of it.
  const allIssues = computed<DriverError[]>(
    () => {
      const params = paramIssues.value;
      const hasBlockingParam = params.some(issue => issue.level === 'error');
      const outputIssues = hasBlockingParam
        ? curveIssues.value.filter(issue => issue.field !== 'sweep' && issue.field !== 'maxCurves')
        : curveIssues.value;
      return [...sweepErrors.value, ...params, ...outputIssues];
    });

  /** True when the focused project has unsaved changes (`OpenISDProject.isModified()`). False
   *  when no project is focused — nothing is "modified" if nothing is open. */
  const isModified = computed<boolean>(() => {
    void live.value;
    return live.value?.isModified() ?? false;
  });
  /** Commit the focused project's edits (`OpenISDProject.save()`). No-op when no project is
   *  focused. */
  function markProjectSaved(): void {
    focusedProject()?.save();
  }
  /** Discard unsaved changes: revert the focused project to its last saved state
   *  (`OpenISDProject.cancel()`). `confirm` is the caller's own "are you sure" dialog — `cancel()`
   *  is async and asks it before discarding anything. No-op (resolves false) when no project is
   *  focused. */
  function resetProjectToGround(confirm: DiscardChallenge): Promise<boolean> {
    const p = focusedProject();
    return p ? p.cancel(confirm) : Promise.resolve(false);
  }

  /**
   * A new project with nothing chosen yet — added to the registry, focused, and RETURNED so the
   * caller can fill it in.
   *
   * The New Project wizard EDITS this rather than collecting a spec and building at the end
   * (QO125, John 2026-09-08: "The new project starts with all sections filled out with defaults -
   * including the driver and pr"), so a project exists from the first step and every later choice —
   * name, box type, volume, the driver, the radiator — is a write to a live project.
   *
   * The defaults are the DOMAIN's (`OpenISDProject.empty`), which states no physical value of its
   * own: the driver and the radiator are blank, and the wizard repopulates them from what the user
   * picks. This function only puts the result in the registry, which is the store's own job — the
   * store is the only module licensed to construct an `OpenISDProject` (`architecture.test.ts`).
   */
  function newProject(): OpenISDProject {
    presentation.yRanges = {};
    // A new project opens on one chart, as WinISD does (`OpenISDProject.openCharts`).
    const p = ProjectBuilder.empty(engine, appContext);
    addProject(p);
    recordOpen('new', p);
    return p;
  }

  /** Whether the circuit models this enclosure type. The DOMAIN's answer, asked here rather than
   *  re-enumerated in a view: a second list of "types that work" is what let a UI-only box type
   *  reach the solver as an assertion. */
  function boxTypeIsSimulatable(boxType: BoxType): boolean {
    return engine.box.simulatableBoxType(boxType) !== null;
  }

  /** The enclosure types OpenISD has finished — the domain's answer, per type. The box-type pickers
   *  dim an unfinished type's row but still let it be picked. */
  const IMPLEMENTED_BOX_TYPES: readonly BoxType[] =
    Object.freeze(BOX_TYPE_OPTIONS.map(o => o.value).filter(b => engine.box.implemented(b)));

  /** The enclosure types the New Project wizard offers: the registry's list (`box_Type`),
   *  narrowed to what the solver models, so the wizard never starts a project it cannot run. */
  function newProjectBoxTypeOptions(): readonly SelectorOption<BoxType>[] {
    return BOX_TYPE_OPTIONS.filter(o => boxTypeIsSimulatable(o.value));
  }

  /** Put a brand-new, blank passive radiator in the focused project's box — what "Define new PR"
   *  does. A blank one rather than a form of its own: the editor that fills in an existing
   *  radiator is the same editor, and a second form stating the same fields would be a second
   *  place to keep them right. */
  function definePassiveRadiator(): void {
    requireFocusedProject().box.passiveRadiator.configurePR(
      OpenISDPassiveRadiatorStandalone.empty(appContext));
  }

  /** A new project around `driver`, its box chosen through the domain's builder — the wizard's
   *  and File → Open's way in. `box` picks the builder for the type and states what the user
   *  chose; everything unstated gets the type's starting values (`OpenISDBox.applyStartingValues`).
   *  Registered and focused, like `newProject()`. */
  function createProject(driver: OpenISDDriver, box: (b: ProjectBuilder) => BoxProjectBuilder): OpenISDProject {
    return buildProject('wizard', driver, box);
  }

  function buildProject(source: ProjectSource, driver: OpenISDDriver, box: (b: ProjectBuilder) => BoxProjectBuilder): OpenISDProject {
    presentation.yRanges = {};
    const p = box(new ProjectBuilder(driver, engine, appContext)).build();
    addProject(p);
    recordOpen(source, p);
    return p;
  }

  /** Open a driver file (`.wdr`/`.owdr`) as a project of its own — a default sealed box around
   *  `driver`, focused, with `name` for the tab. Used by File → Open when no project is focused;
   *  when one IS focused the caller swaps the driver in place instead (`loadDriver`). */
  function openProjectFromDriver(driver: OpenISDDriver, name: string): void {
    const p = buildProject('driver', driver, (b) => b.sealed().volume_m3(NumberField.BOX_VB_L.toSI(DEFAULT_SEALED_VOLUME_L)));
    p.name.set(name);
  }

  // A driver pre-loaded into the New Project wizard — a `.wdr`/`.owdr` opened from disk when no
  // project is open. The wizard builds the project from it instead of the driver picker, and clears
  // it on completion (BUG_20260912: a driver file must start the wizard, not a default sealed box).
  const newProjectDriver = shallowRef<OpenISDDriver | null>(null);

  /** The name for a copy of the open project — "Copy of <name>", made unique among `taken`.
   *  Falls back to the driver's name when the project has none, same as the project list rows. */
  function copyProjectName(taken: readonly string[]): string {
    return uniqueName(copyOfName(requireFocusedProject().name.value || driverName.value), taken);
  }

  /** A CHANGE SIGNAL for App.vue's persistence hook — a counter that increments on every change
   *  to the FOCUSED project and on every focus/open/close, and hands over nothing (QO92).
   *
   *  It replaced `committedSnapshot`, which returned the focused project's committed state as an
   *  `OpenISDProject`. A copy, so a watcher could not mutate the layer — but every value in it
   *  escaped, and the app ended up holding the domain object the layering doctrine says it must
   *  never hold, purely so the repo could serialise it. A design for autosave has to hand over
   *  bytes or a record instead; until then the hook needs to know only THAT something changed.
   *
   *  UNFOCUSED PROJECTS ARE SILENT, and any persistence design must fix that rather than lean on
   *  this: `live` subscribes to the focused project alone, so an open-but-unfocused project's
   *  edits reach nothing here (QO92 records this as one of the two defects that sank the removed
   *  autosave). A per-project signal is what a real design needs. */
  const projectChanged = computed<number>(() => changeTicks.value);

  /** The live presentation state as the repo's view shape — read directly by the share-link
   *  doors and by the view-state autosave (QO90 — view/UI preferences persist under their own
   *  storage key, independent of the project). `graphs` moved onto the focused
   *  project (QO130) and travel inside its own `.owpr` text instead; the cursor moved there too,
   *  but QO168 keeps it out of every saved record, this snapshot included. */
  function currentViewSnapshot(): ViewSnapshot {
    const yRanges: Record<string, YRange> = {};
    for (const [chart, r] of Object.entries(presentation.yRanges)) if (r) yRanges[chart] = {min: r.min, max: r.max};
    return {
      ui: presentation.ui,
      chart: {sweepRange: {min: presentation.sweepRange.min, max: presentation.sweepRange.max}, yRanges},
    };
  }

  /**
   * Adopt a freshly loaded project as the WHOLE design — driver, box, vents, PR, environment,
   * signal, filters, entered set and meta together, in one coherent operation
   * (`ManagedProject.load()`). The pure-project load door (`readProjectText`,
   * QO90) call this; the view is restored separately, from its own storage key, by
   * `applyViewSnapshot()`.
   *
   * Old-schema repair (a pre-vent-group save with no `ventShape`/`ventW`/`ventH`/`entered`) and
   * driver-record conformance checking (a bad record refused rather than crashing the whole
   * load, quarantined so an autosave cannot overwrite the evidence) already happened at the repo
   * boundary (`@openisd/persistence`'s `projectRepo.ts`) that produced `project` — this only
   * adopts the result.
   *
   * Every load path lands the WHOLE project — `project` already carries params, box, driver and
   * meta together (it came back from `@openisd/persistence`'s `ProjectRepo`, which reconstructs an
   * `OpenISDProject` from its own validated record), so there is no per-field copy to get wrong.
   */
  function applyLoadedProject(project: OpenISDProject): void {
    // A loaded project is a distinct `OpenISDProject` instance, not a patch onto the focused one
    // (`OpenISDProject` exposes no "replace my own record" method — swapping the registry entry is
    // the whole operation). Lands on WHICHEVER project is currently focused — every load-path
    // caller (`App.vue`'s hash/local restore, `OriginalShell.vue`'s File → Open, which opens a
    // fresh tab first) already ensures a project is focused before calling this.
    if (!focusedProject()) {
      addProject(project);
      return;
    }
    projects.value = projects.value.map((existing, i) => (i === focusedIndex.value ? project : existing));
  }

  /** Restore view/UI preferences — panel/unit preferences and layout — from a `ViewSnapshot`
   *  loaded independently of the project (QO90). Also the view-restoring half of a full-session
   *  apply (`applyState()` below), for the share-link doors that still carry project and view
   *  together (human ruling 2026-08-14). Loss-model choice, open charts and the graph cursor
   *  moved onto the project itself (QO130/QO168) — restored automatically as part of the project
   *  text, not through this door. */
  function applyViewSnapshot(v: ViewSnapshot): void {
    if (v.ui) {
      Object.assign(presentation.ui, v.ui);   // the whole view context is carried by a share link (stateToUrl, human ruling 2026-08-14) — nothing in it is stripped
      presentation.ui.unitTokens = {...parseUnitRotation(v.ui.unitTokens)};   // an older save's short-named unit choices move to their field
    }
    if (v.chart) {
      presentation.sweepRange = {min: v.chart.sweepRange.min, max: v.chart.sweepRange.max};
      const yRanges: Partial<Record<ChartId, YRange>> = {};
      // A stored id the chart set no longer declares is dropped, not mapped to a default chart.
      for (const [key, r] of Object.entries(v.chart.yRanges)) {
        const id = TABS.find(t => t.id === key)?.id;
        if (id !== undefined) yRanges[id] = {min: r.min, max: r.max};
      }
      presentation.yRanges = yRanges;
    }
  }

  /** Restore a FULL session — project and view together — for the share-link doors
   *  (`stateToUrl`/`loadFromHash`), which still carry both (human ruling 2026-08-14). The
   *  pure-project door (`readProjectText`) calls `applyLoadedProject()` alone. */
  function applyState(o: { project: OpenISDProject; view: ViewSnapshot }): void {
    applyLoadedProject(o.project);
    applyViewSnapshot(o.view);
  }

  // A comparison overlay is stored WITHOUT its curves (they are derived, and bulk out every
  // save and share link), so restoring one means re-running its sweep — a row without curves
  // draws nothing, which is the same "loaded but invisible" failure at the overlay level.

  /**
   * WinISD's "Simulate voice coil inductance" (Advanced pane, `.wpr` VCInd) — an alias over
   * `circuitModel`, NOT a second stored flag. Le in the acoustic circuit is exactly what the
   * WinISD/gyrator circuit-model switch already selects (docs/research/WINISD_PARITY.md §9), so the Advanced
   * checkbox and SignalPanel's circuit-model select are two wordings of one setting; storing
   * it twice is how the two would drift apart.
   *
   * ⚠ Assumption — NOT directly verified: with the box unchecked WinISD is presumed to keep Le
   * in the IMPEDANCE plot and drop it only from the acoustic path (OpenISD's historic and
   * current behaviour). Every `.wpr` in the corpus has VCInd=0, so no observation settles it.
   */
  const simVcInductance = computed<boolean>({
    get: () => { void live.value; const m = live.value?.circuitModel.value; return m !== undefined && m !== 'winisd'; },
    set: (on) => { focusedProject()?.circuitModel.set(on ? 'gyrator' : 'winisd'); },
  });

  return {
    differenceCuesShown, setDifferenceCuesShown, ventedLimits, setVentedLimits, envDefaults, setEnvDefaults,
    engine, appContext,
    openProjects, focusedProject, focusProject, removeProject, addProject, openProjectByIdentity,
    openProjectOnce, restoreProjects, requireFocusedProject, duplicateFocusedProject,
    driverName, projectDisplayName, projectHasUnsavedChanges, openDriverPicker, syncedP,
    curvesData: curves, maxData: max, paramIssues, allIssues, isModified, markProjectSaved,
    resetProjectToGround, newProject, boxTypeIsSimulatable, IMPLEMENTED_BOX_TYPES,
    newProjectBoxTypeOptions, definePassiveRadiator, createProject, openProjectFromDriver,
    newProjectDriver, copyProjectName, projectChanged, currentViewSnapshot, applyLoadedProject,
    applyViewSnapshot, applyState, simVcInductance,
    traceVisibilityRevision, isTraceVisible, setTraceVisible, hiddenTraces,
  };

}
