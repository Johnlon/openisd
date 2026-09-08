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
/* eslint-disable @typescript-eslint/no-explicit-any */
import { reactive, computed, ref, shallowRef, triggerRef, watch, type Ref, type ShallowRef } from 'vue';
import { Engine } from '@openisd/design/engine';
import type { DriverError, SweepResult, MaxCurvesResult, BoxType } from '@openisd/design/engine';
import {
  OpenISDDriver, projectRepo,
  OpenISDProject, type RecordStore, type RecordStoreFactory, type DiscardChallenge,
  type FrequencyGrid,
} from '@openisd/design';
import {type AppState, AppStateImpl, type ProjectMeta, type PlotParams} from '../types.js';
import { copyOfName, uniqueName, type ViewSnapshot } from '@openisd/persistence';

/** The 53 driver spec fields the app's UI reads/writes by name — the driver editor's own field
 *  table. Matches `DriverSpec`'s field names in `@openisd/design`, without their unit suffixes. */
export type SpecField =
  | 'Fs' | 'Re' | 'Le' | 'fLe' | 'KLe' | 'Znom' | 'Qts' | 'Qes' | 'Qms' | 'Vas' | 'Sd' | 'BL'
  | 'Mms' | 'Cms' | 'Rms' | 'Xmax' | 'Xlim' | 'SPL' | 'Pe' | 'Dd' | 'EBP' | 'numVC' | 'VCCon'
  | 'Dia' | 'Vd' | 'no' | 'SPLmax' | 'SPLmaxLF' | 'USPL' | 'alfaVC' | 'Rt' | 'Ct' | 'gamma'
  | 'Rme' | 'Mpow' | 'Mcost' | 'Gloss' | 'c' | 'roo' | 'Vcd' | 'Hg' | 'Hc' | 'freq_low_hz'
  | 'freq_high_hz' | 'power_peak_W' | 'weight_kg' | 'Thick' | 'Depth' | 'MagDepth' | 'Magnet'
  | 'Basket' | 'Outer' | 'OuterX' | 'OuterY' | 'DVol';
import { presentationState, unitToken } from './presentationState.js';
import { parseChartTabId } from './series.js';
import { toDisplay, fromDisplay, displayPrecision, type UnitGroup } from './fields/units.js';
import { getOrInit, hmrSlots } from './hmrSingleton.js';
import {
  solveVentGroup, ventSolveSuspended,
} from './useVentGroup.js';
import { solvePrGroup } from './usePrGroup.js';
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

/** This module's hot-reload-surviving singletons, one typed member each (`hmrSingleton.ts`).
 *  Each member's declared type is what its `getOrInit` call site gets back. */
interface AppStateSingletons {
  engine: Engine;
  seedProject: OpenISDProject;
  projects: ShallowRef<OpenISDProject[]>;
  focusedIndex: Ref<number>;
  changeTicks: Ref<number>;
  live: ShallowRef<OpenISDProject | null>;
  state: AppState;
  curves: Ref<SweepResult | null>;
  max: Ref<MaxCurvesResult | null>;
}
declare global {
  var __openisd_appState: Partial<AppStateSingletons> | undefined;
}
const slots = hmrSlots<AppStateSingletons>(
  () => globalThis.__openisd_appState,
  s => { globalThis.__openisd_appState = s; },
);

/**
 * A driver record with no readings on any spec field — every field's `Field<T>.get()` answers
 * `not-available`. `@openisd/design` has no `OpenISDDriver.empty()`/`OpenISDProject.empty()`
 * yet (flagged to John as a design-side gap, `docs/plans/PLAN_DELETE_PACKAGES_MODEL.md` §4b);
 * this is the stopgap until one exists — a genuinely blank, schema-conforming record built the
 * same way any untrusted record is validated, rather than a second construction path.
 */
function blankDriverRecord(): unknown {
  return {
    uuid: { value: crypto.randomUUID() },
    quality: {
      confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
    manufacturer: { value: '' }, brand: { value: '' }, model: { value: '' },
    sku: { value: '', grounds: [{ origin: 'entered', reading: '' }] },
    driver_type: { value: 'woofer' },
    data_sources: { value: {} },
    authoritative: { value: '' },
    specs: { woofer: {} },
  };
}

/** A brand-new, empty sealed project around a blank driver — the store's one seed/reset
 *  construction path. `newProject.js` (`@openisd/design`) refuses to build without a driver
 *  and a box type, so a blank driver always comes first. */
function createEmptyProject(engine: Engine): OpenISDProject {
  const driver = OpenISDDriver.fromConformingRecord(blankDriverRecord(), engine);
  if (Array.isArray(driver)) {
    throw new Error(`blankDriverRecord() does not conform: ${driver.join('; ')}`);
  }
  return OpenISDProject.builder(driver, engine).sealed().volume_m3(0.02).build();
}

export const engine = getOrInit(slots, 'engine', () => new Engine());

/**
 * `OpenISDProject` (`@openisd/design`) is the domain object for ONE project in the registry
 * below, owning its own ground/edited layers (`isModified()`/`save()`/`cancel()`) and its own
 * driver, box, params and meta together.
 *
 * `seedProject` is the one always seeded into the registry below at module load — the app
 * never starts with zero projects open — and is otherwise indistinguishable from any project
 * opened later; nothing about it is special once the app is running.
 */
const seedProject: OpenISDProject = getOrInit(slots, 'seedProject', () => {
  return createEmptyProject(engine);
});

/**
 * The multi-project registry (human ruling, 2026-08-18) — replaces `workspace.ts`'s ad-hoc
 * `WorkspaceEntry`/`OpenProject` and `OriginalShell.vue`'s own former local `openProjects`/
 * `activeProjectId` reimplementation as the ONE place "which projects are open, which is
 * focused" lives. `projects[0]` starts as `seedProject` — one project open, matching the
 * app's starting state.
 */
const projects = getOrInit(slots, 'projects', () => shallowRef<OpenISDProject[]>([seedProject]));
const focusedIndex = getOrInit(slots, 'focusedIndex', () => ref(0));

/** Every open project. Empty array if none are open. */
export function openProjects(): OpenISDProject[] { return projects.value; }

/** The project currently focused in the UI's project list, or null if none are open. */
export function focusedProject(): OpenISDProject | null {
  return projects.value[focusedIndex.value] ?? null;
}

/** Move focus to the project at `index` — called when the user changes the active project in
 *  the UI's project list. Out-of-range indices are ignored.
 *
 *  Closes Tune and the Driver Editor modal on the project being left, BEFORE moving focus
 *  (`presentationState.editDriver = false`/`editDriverInfo = false`) — same "any focus-
 *  changing action closes what was open" pattern as `openDriverPicker()` above. */
export function focusProject(index: number): void {
  if (index < 0 || index >= projects.value.length || index === focusedIndex.value) return;
  presentationState.editDriver = false;
  presentationState.editDriverInfo = false;
  focusedIndex.value = index;
}

/** Remove the project at `index` from the registry. If the focused index is now past the end,
 *  it clamps to the new last project; if the registry is now empty, the index is left alone —
 *  `focusedProject()` already answers null for an out-of-range index, nothing to noop around. */
export function removeProject(index: number): void {
  if (index < 0 || index >= projects.value.length) return;
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
export function addProject(project: OpenISDProject): void {
  projects.value = [...projects.value, project];
  focusedIndex.value = projects.value.length - 1;
}

/** Thrown by `requireFocusedProject()` when no project is open. A small, deliberate,
 *  named exception — not a wrapper/Null Object of any kind (human ruling, PROMPT_RELEASE_
 *  HARDENING plan) — so a caller asserting "a project must be focused right now" gets a
 *  specific, catchable type instead of a bare null-dereference `TypeError`. */
export class NoFocusedProjectError extends Error {
  constructor() { super('no project is focused'); }
}

/** Assert a project is focused right now and return it. Throws `NoFocusedProjectError`
 *  when `focusedProject()` is null — a defensive boundary check for code that must run with
 *  a real project (the gate's own provide, or any write path only ever reached from inside
 *  the gate). The gate's own null-check for deciding whether to render the empty state stays
 *  `focusedProject() === null` — that path is expected, not an error. */
export function requireFocusedProject(): OpenISDProject {
  const p = focusedProject();
  if (!p) throw new NoFocusedProjectError();
  return p;
}

/** Open a brand-new, blank, independent project tab and focus it — the store is the ONE
 *  logic module licensed to construct an `OpenISDProject`
 *  (`architecture.test.ts` "the store is the only logic module that holds the project
 *  instance"), so a UI file that wants a new tab calls this rather than importing the domain
 *  package itself. */
export function openBlankProject(): void {
  addProject(createEmptyProject(engine));
}

/** A store holding exactly the one record most recently `put()` — lets this file borrow
 *  `projectRepo()`'s own save/load round trip to clone a project without ever touching
 *  `OpenISDProject.cloneSavedProject()`, which is `@internal` to `packages/design`. Same pattern
 *  as `@openisd/persistence`'s `projectRepo.ts` `singleSlotStore()`. */
function singleSlotStore<R>(): RecordStore<R> & { current(): R | null } {
  let held: R | null = null;
  return {
    put(_id, record) { held = record; },
    get(_id) { return held; },
    list() { return []; },
    remove() { /* nothing to remove: no listing exists through this door */ },
    current: () => held,
  };
}

/** Duplicate the FOCUSED project's own design into a brand-new, independent tab under
 *  `newName`, and focus it. Round-trips through `projectRepo().save()`/`.load()` over a
 *  throwaway single-slot store — the public save/validate/reconstruct path every persistence
 *  door already uses — so the copy is a genuinely separate `OpenISDProject` with its own edit
 *  layer, never a second reference to the source's. */
export function duplicateFocusedProject(newName: string): void {
  const source = requireFocusedProject();
  const slot = singleSlotStore<unknown>();
  const make: RecordStoreFactory = <R,>() => slot as unknown as RecordStore<R>;
  const repo = projectRepo(make, engine);
  repo.save(source);
  // `load(id)` adopts `id` as the loaded project's own identity (its doc comment: "ADOPTS `id`
  // AS THE PROJECT'S IDENTITY") — this store is single-slot and ignores the id it is `put`
  // with, so loading under a freshly minted id (rather than `source.uuid()`) gives the copy a
  // genuinely new identity instead of the source's.
  const loaded = repo.load(crypto.randomUUID());
  if (Array.isArray(loaded)) {
    throw new Error(`duplicateFocusedProject: round trip refused its own project: ${loaded.join('; ')}`);
  }
  addProject(loaded);
  loaded.name.set(newName);
  loaded.save();
}

/** A private, read-only source of safe defaults for the handful of module-scope reactive
 *  computeds below (`state.box`, `syncedP`, the sweep scheduler's watch sources) that Vue
 *  evaluates unconditionally on every reactive flush regardless of whether any project is
 *  focused — e.g. right after the last open project is closed. Never registered in
 *  `projects`, never mutated, never exposed: nothing downstream ever reads its values for
 *  real, because the gated UI that would is unmounted whenever `focusedProject()` is null. */
const EMPTY_PROJECT_DEFAULTS: OpenISDProject = createEmptyProject(engine);

// The one Vue bridge onto WHICHEVER project is currently focused. Re-subscribes on every
// focus change or open/close of a project (the `watch([projects, focusedIndex], ...)` inside
// the initializer below), so every reader touching `live.value` sees the newly focused
// project and re-fires on its own mutations. `live.value` is null exactly when
// `focusedProject()` is null.
// HMR-singleton, same reasoning as the registry itself: the whole subscription+watch setup is
// built once inside the `getOrInit` initializer so hot-reload does not create a second,
// leaked watcher alongside the one that survives via `getOrInit`'s cache.
// The tick counter behind `projectChanged` (see its export below). Bumped at the SAME two
// sites that make `live` re-fire, because those are exactly the events the hook must hear.
// It is a counter, not a derived value: a `computed` only notifies when its VALUE changes, so
// anything derived from current state goes quiet the moment two consecutive edits leave that
// derivation equal — which for a change signal is always.
const changeTicks: Ref<number> = getOrInit(slots, 'changeTicks', () => ref(0));

const live: ShallowRef<OpenISDProject | null> = getOrInit(slots, 'live', () => {
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
});

// `state.project`'s five fields, each an accessor onto the FOCUSED project's own meta field —
// never an independent copy. A plain mutable mirror (this file's earlier shape) went stale the
// instant focus moved to a DIFFERENT already-open project via `focusProject()` alone (no load
// call to refresh it), so the Project tab and titlebar kept showing whichever project was
// focused BEFORE the switch — found and fixed while wiring the multi-project registry
// (PROMPT_RELEASE_HARDENING plan). Reads fall back to `EMPTY_PROJECT_DEFAULTS` when nothing is
// focused; writes no-op then (defensive — the gated UI that could write is unmounted).
const PROJECT_META_FIELDS = ['name', 'creator', 'created', 'modified', 'description'] as const;
function buildProjectMetaAccessor(): ProjectMeta {
  const obj = {} as ProjectMeta;
  for (const key of PROJECT_META_FIELDS) {
    Object.defineProperty(obj, key, {
      enumerable: true, configurable: true,
      get: () => (focusedProject() ?? EMPTY_PROJECT_DEFAULTS)[key].get(),
      set: (v: string) => { focusedProject()?.[key].set(v); },
    });
  }
  return obj;
}

function buildState(): AppState {
  const p = (focusedProject() ?? EMPTY_PROJECT_DEFAULTS);
  return new AppStateImpl(p.box.boxType.get(), buildProjectMetaAccessor());
}

export const state: AppState = getOrInit(slots, 'state', () => reactive(buildState()));

// ---- Vent group: keep the calculated member solved while the user edits ------------------
// `live` (above) already fires on every focused-project mutation — box/vent/PR fields
// included — so it is the one reactive dependency this needs; the group itself decides,
// field by field, whether there is anything to solve (`ventDerivable`). Two guards:
//   solvingVent  — the solver's own write must not re-enter the watcher: `live` firing
//                   again from inside `solveVentGroup`'s own mutation would otherwise recurse.
//   ventSolveSuspended() — a restore assigns a whole persisted snapshot and must be adopted
//                   verbatim (docs/design/STATE_MODEL.md rule 3, "Cancel means byte-identical").
// `live` is a shallow ref whose `.value` is the SAME focused-project reference on every
// notification, so both watches below pass `live` itself (or inside the sources array), never
// a getter that reads `live.value` — a getter source is gated on Vue's
// `hasChanged(newValue, oldValue)`, which an invariant reference always fails, so the
// callback would never run. Passing the ref directly sets `forceTrigger`, which fires on every
// `triggerRef` unconditionally, matching the "run on every notification" intent
// (`BUG_20260822_pr_group_auto_solve_watch_never_fires_after_the_live_repoint.md`).
let solvingVent = false;
watch(
  [live, () => state.box],
  () => {
    if (solvingVent || ventSolveSuspended()) return;
    const p = live.value;
    if (!p) return;
    solvingVent = true;
    try { solveVentGroup(p); } finally { solvingVent = false; }
  },
  // flush:'sync' is REQUIRED, not a preference. Vue's default 'pre' defers the callback to
  // the next tick, by which time suspendVentSolve() has already returned and cleared its
  // flag — the suspension would be a no-op and a restore would still be re-solved (and so
  // still drift). Synchronous flush makes the guard actually cover the assignment. The
  // callback is a few arithmetic ops; the expensive re-sweep is throttled separately.
  { flush: 'sync' },
);

// ---- PR tuning group: added mass ↔ system tuning -----------------------------------------
// Shares the vent group's suspension flag and the same `live` dependency.
watch(
  live,
  () => {
    if (solvingVent || ventSolveSuspended()) return;
    const p = live.value;
    if (!p) return;
    solvingVent = true;
    try { solvePrGroup(p); } finally { solvingVent = false; }
  },
  { flush: 'sync', immediate: true },
);

/** What this driver is CALLED — brand and model as the record states them, from the FOCUSED
 *  project's driver. '' when nothing names it (no driver chosen, or no project focused), so a
 *  caller can fall back. */
export const driverName = computed<string>(() => {
  void live.value;
  if (!live.value) return '';
  return [live.value.driver.brand.get().value, live.value.driver.model.get().value]
    .filter((x): x is string => !!x && x.length > 0).join(' ').trim();
});

/**
 * Open the driver picker — the ONE governed entry point. Every "Select Driver"/"Browse…"
 * trigger calls this, never a raw `presentationState.browseOpen = true`. No-ops when no
 * project is focused — there is nothing to pick a driver for.
 */
export function openDriverPicker(): void {
  if (!focusedProject()) return;
  presentationState.browseOpen = true;
}

// A single, empty grid — sweep()/maxCurves()/validateParams() fall back to the FOCUSED
// PROJECT's own stored fmin/fmax/N (`OpenISDProject.sweepFmin_hz` etc.), or the engine's
// defaults when the project has none either (sweep.ts: `P.fmin || 10, P.fmax || 1000,
// P.N || 400`) — so this file never re-states or overrides either set of defaults itself.
const GRID: FrequencyGrid = {};

/** The chart panels' shared X-axis range plus the display-only flags `series.ts` reads —
 *  everything a `Design.P` needs, resolved from the FOCUSED project. `fmin`/`fmax` are the
 *  project's own saved range (`sweepFmin_hz`/`sweepFmax_hz`) rather than the engine's internal
 *  defaults, so the Options dialog and the axis-drag zoom (`GraphPanel.vue`) have a real value
 *  to read and write — `undefined` here means "use the engine default", not "no project". */
export const syncedP = computed<PlotParams>(() => {
  const p = live.value;
  if (!p) return {fmin: 10, fmax: 1000};
  const box = p.box.boxType.get();
  const prXmax = box === 'box-passive-radiator'
    ? (p.box.passiveRadiator.radiator.spec.Xmax_m.get().value ?? undefined)
    : undefined;
  return {
    fmin: p.sweepFmin_hz.get() ?? 10,
    fmax: p.sweepFmax_hz.get() ?? 1000,
    splXmaxLimited: p.splGraphIsXmaxLimited.get(),
    prXmax,
  };
});

const curves = getOrInit(slots, 'curves', () => ref<SweepResult | null>(null));
const max    = getOrInit(slots, 'max', () => ref<MaxCurvesResult | null>(null));
const doSweep = () => {
  const p = live.value;
  curves.value = p ? p.sweep(GRID).value : null;
  max.value    = p ? p.maxCurves(GRID).value : null;
};
doSweep();
// Leading-edge throttle (was a pure trailing debounce): the chart curves must
// redraw DURING a held/rapid spinner drag, not only after release. A pure
// `setTimeout(doSweep, 80)` cleared on every change starves the sweep while the
// value keeps changing faster than 80ms, so the graph froze until you let go
// (the bottom stat numbers, which read `driver`/`syncedP` directly, stayed live —
// that mismatch was the tell). Here the first change runs immediately, then at
// most once per SWEEP_MS while changes keep coming, with a trailing run to catch
// the final value.
const SWEEP_MS = 32;   // ~30 fps — live-feeling without resweeping every event
// Whatever handle this platform's setTimeout hands back — a number in the browser, an object in Node.
let sweepTimer: ReturnType<typeof setTimeout> | null = null;
let lastSweep = 0;
function scheduleSweep(): void {
  const now = performance.now();
  const wait = SWEEP_MS - (now - lastSweep);
  if (wait <= 0) {
    if (sweepTimer) { clearTimeout(sweepTimer); sweepTimer = null; }
    lastSweep = now;
    doSweep();
  } else if (sweepTimer === null) {
    sweepTimer = setTimeout(() => {
      sweepTimer = null;
      lastSweep = performance.now();
      doSweep();
    }, wait);
  }
}
watch(live, scheduleSweep);
export const curvesData = curves;
export const maxData    = max;

// Postcondition (hardening): a valid driver can still yield a non-finite sweep at
// some frequency (a numerical singularity the input guards can't foresee). Classify
// the sweep output so it's never a silently blank chart — surfaced through the same
// issue channel as the project's own errors. Empty when the driver is invalid (no sweep)
// or the sweep is clean.
const curveIssues = computed<DriverError[]>(() => {
  const sw = curves.value, mx = max.value;
  if (!sw) return [];
  // classifyFinite: a singularity made the curve undrawable. classifyMaxFinite: the same
  // question asked of the Max-SPL/Max-power pair, which is computed after the sweep and can
  // be non-finite while every sweep array is fine. classifyFlatClamp: force-flat ran out of
  // allowed boost, so the "flat" response is not flat below some frequency — a truncated
  // inverse filter must never look like a design that flattens for free.
  const eng = new Engine();
  return [eng.classifyFinite(sw), mx ? eng.classifyMaxFinite(mx) : null, eng.classifyFlatClamp(sw)]
    .filter((e): e is DriverError => e !== null);
});

// Precondition (hardening, CODE_REVIEW.md §18): the enclosure parameters the circuit
// divides by — Vb everywhere, Sp/Vf/PR per box type. The postcondition above does catch
// the resulting garbage, but only as "no usable values"; this names the field to change.
// Validated at the same boundary, on the same project the sweep is actually run on.
export const paramIssues = computed<DriverError[]>(() => {
  void live.value;
  return live.value ? live.value.validateParams(GRID) : [];
});

// The full issue list the UI shows: box-parameter issues + sweep/max-curve finiteness issues.
// `sweep(GRID).errors`/`maxCurves(GRID).errors` would duplicate `paramIssues` (both come from
// the same `validateParams` call inside the project's own sweep/maxCurves), so this reads only
// the postcondition classifications on top of it.
export const allIssues = computed<DriverError[]>(
  () => [...paramIssues.value, ...curveIssues.value]);

/** True when the focused project has unsaved changes (`OpenISDProject.isModified()`). False
 *  when no project is focused — nothing is "modified" if nothing is open. */
export const isModified = computed<boolean>(() => {
  void live.value;
  return live.value?.isModified() ?? false;
});
/** Commit the focused project's edits (`OpenISDProject.save()`). No-op when no project is
 *  focused. */
export function markProjectSaved(): void {
  focusedProject()?.save();
}
/** Discard unsaved changes: revert the focused project to its last saved state
 *  (`OpenISDProject.cancel()`). `confirm` is the caller's own "are you sure" dialog — `cancel()`
 *  is async and asks it before discarding anything. No-op (resolves false) when no project is
 *  focused. */
export function resetProjectToGround(confirm: DiscardChallenge): Promise<boolean> {
  const p = focusedProject();
  return p ? p.cancel(confirm) : Promise.resolve(false);
}
/** The New Project wizard's starting choices — name, box type, and its starting volume(s) in
 *  LITRES (the wizard's own display unit; converted to SI here, the one place that owns the
 *  litres↔m³ factor, rather than the wizard hand-rolling `/1000`). `frontVolumeL` only applies
 *  to a dual-chamber box (bandpass4). */
export interface NewProjectSpec {
  name: string;
  box: BoxType;
  volumeL: number;
  frontVolumeL?: number;
}

/** Start a brand-new project from the app's initial defaults — NOT the ground state. Clears
 *  the whole design (params incl. filters, compare traces, per-chart zoom, driver source) so
 *  a "new" project never inherits the previous one, then adopts the fresh design as ground.
 *  `spec`, when given, is the New Project wizard's chosen name/box/volume, applied atomically
 *  as part of the same reset — the wizard has nothing left to write onto `state` by hand.
 *  `loadEmpty()` already resets box/vent/PR/environment/signal/simOptions/sweep/filters/entered
 *  to the app's initial defaults — there is nothing left for this function to reset on the
 *  params side.
 *
 *  When no project is currently focused (the registry was emptied by closing the last open
 *  project) this OPENS a new one via `addProject()` rather than throwing — the empty state's
 *  own recovery action, and every other "New Project" trigger, are the same call. Otherwise it
 *  resets the FOCUSED project's own content in place, preserving its tab identity. */
export function newProject(spec?: NewProjectSpec): void {
  presentationState.yRanges = {};
  const driver = OpenISDDriver.fromConformingRecord(blankDriverRecord(), engine);
  if (Array.isArray(driver)) {
    throw new Error(`blankDriverRecord() does not conform: ${driver.join('; ')}`);
  }
  const volume_m3 = fromDisplay(spec?.volumeL ?? 20, 'volume', 'L');
  // Only sealed is buildable from what NewProjectSpec carries today: `vented()`/`bandpass4()`
  // require a tuning frequency (`.tuning_hz()`/`.frontTuning_hz()`) the wizard never collects
  // (packages/design/domain/openisdTransforms.ts's `VentedProjectBuilder`/`Bandpass4ProjectBuilder`), so
  // a non-sealed spec builds sealed at the same volume until the wizard is extended to ask.
  const p = OpenISDProject.builder(driver, engine).sealed().volume_m3(volume_m3).build();
  p.name.set(spec?.name ?? '');
  if (!focusedProject()) {
    addProject(p);
  } else {
    projects.value = projects.value.map((existing, i) => (i === focusedIndex.value ? p : existing));
  }
}

/**
 * Why the last restore refused something, empty when it took everything.
 *
 * A refusal that only reaches the console is a silent data loss the user discovers later, so
 * it is surfaced: the app is running, and it says what it would not load and why.
 */
const restoreProblems = ref<string[]>([]);


/** The name for a copy of the open project — "Copy of <name>", made unique among `taken`.
 *  Falls back to the driver's name when the project has none, same as the project list rows. */
export function copyProjectName(taken: readonly string[]): string {
  return uniqueName(copyOfName(state.project.name || driverName.value), taken);
}

/** The open design, as the live domain object every save/share door persists
 *  (`@openisd/persistence`'s `ProjectRepo` takes and returns real `OpenISDProject` objects, never
 *  a serialised copy — QO90). No field is re-gathered by hand: `OpenISDProject` already IS
 *  params + box + meta + driver together, so a second, parallel struct duplicating those fields
 *  would be a second answer to the same question. */
export function currentProject(): OpenISDProject {
  return requireFocusedProject();
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
export const projectChanged = computed<number>(() => changeTicks.value);

/** The live presentation state as the repo's view shape — read directly by the share-link
 *  doors and by the view-state autosave (QO90 — view/UI preferences persist under their own
 *  storage key, independent of the project). */
export function currentViewSnapshot(): ViewSnapshot {
  return {
    lossMode: presentationState.lossMode,
    graphs: presentationState.graphs,
    ui: presentationState.ui,
    cursor: {
      f: presentationState.cursorF, pinnedF: presentationState.pinnedF, locked: presentationState.cursorLocked,
      range: presentationState.dragRange ? { fLo: presentationState.dragRange.fLo, fHi: presentationState.dragRange.fHi } : null,
    },
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
export function applyLoadedProject(project: OpenISDProject): void {
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

/** Restore view/UI preferences — loss-model choice, open charts, panel/unit preferences, the
 *  graph cursor — from a `ViewSnapshot` loaded independently of the project (QO90). Also the
 *  view-restoring half of a full-session apply (`applyState()` below), for the share-link
 *  doors that still carry project and view together (human ruling 2026-08-14). */
export function applyViewSnapshot(v: ViewSnapshot): void {
  if (v.lossMode) presentationState.lossMode = v.lossMode;
  // A saved/shared blob carries chart ids as plain strings, so each goes through the one
  // string→member boundary; an id this build does not declare is invalid data, and is
  // dropped rather than restored as a chart nothing can draw.
  if (Array.isArray(v.graphs) && v.graphs.length) presentationState.graphs = v.graphs.map(parseChartTabId);
  if (v.ui) Object.assign(presentationState.ui, v.ui);   // the whole view context is carried by a share link (stateToUrl, human ruling 2026-08-14) — nothing in it is stripped
  if (v.cursor) {
    presentationState.cursorF = v.cursor.f;
    presentationState.pinnedF = v.cursor.pinnedF;
    presentationState.cursorLocked = v.cursor.locked;
    presentationState.dragRange = v.cursor.range ? { fLo: v.cursor.range.fLo, fHi: v.cursor.range.fHi } : null;
  }
}

/** Restore a FULL session — project and view together — for the share-link doors
 *  (`stateToUrl`/`loadFromHash`), which still carry both (human ruling 2026-08-14). The
 *  pure-project door (`readProjectText`) calls `applyLoadedProject()` alone. */
export function applyState(o: { project: OpenISDProject; view: ViewSnapshot }): void {
  applyLoadedProject(o.project);
  applyViewSnapshot(o.view);
}

// A comparison overlay is stored WITHOUT its curves (they are derived, and bulk out every
// save and share link), so restoring one means re-running its sweep — a row without curves
// draws nothing, which is the same "loaded but invisible" failure at the overlay level.

// ---- Per-field display units (fields/units.ts) ------------------------------------
// appState stays SI; formatInUnit only chooses how a CALCULATED value is shown, reading the
// selected token off presentationState (logic/presentationState.ts owns
// unitToken/cycleUnitToken/resetUnitTokens — pure view functions, not design state).
/** Format a CALCULATED (read-only) value in a field's currently-selected unit — the single
 *  source every skin uses to pair a readout with a <UnitToggle>. `si` MUST be the SI value
 *  (m³/m/m²/Hz/kg); a few engine helpers return convenience units (e.g. prVas is litres → pass
 *  value/1000). `baseDp` is the field's base-unit dp from fieldRegistry. Non-finite → '—'. */
export function formatInUnit(
  si: number | null | undefined,
  field: string,
  group: UnitGroup,
  baseToken: string,
  baseDp: number,
): string {
  if (si == null || !isFinite(si)) return '—';
  const tok = unitToken(field, baseToken);
  return toDisplay(si, group, tok).toFixed(displayPrecision(baseDp, group, baseToken, tok));
}

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
export const simVcInductance = computed<boolean>({
  get: () => { void live.value; return live.value?.circuitModel.get() === 'gyrator'; },
  set: (on) => { focusedProject()?.circuitModel.set(on ? 'gyrator' : 'winisd'); },
});



