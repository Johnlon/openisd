/**
 * `store.ts` — the app's Vue-reactive state HOLDER. It is a store, nothing more.
 *
 * ── What this file MUST NOT do (human ruling 2026-08-18, ARCHITECTURE.md §5) ──
 * It must never CALCULATE a value — not even by correctly calling out to a properly
 * single-sourced formula function. A calculated value is a property or method on the domain
 * object that owns it (`OpenISDDriver`/`ManagedOpenISDProject`), read by this file, never
 * computed IN this file. If a value this file needs isn't exposed on the owning domain object
 * yet, the fix is adding it there as a getter/method — never computing it here "just this
 * once," however small or well-sourced the calculation looks. This file's only legitimate
 * jobs are: hold Vue-reactive references, delegate reads/writes to `managedProject`/the
 * project registry, and bridge notifications into Vue's reactivity system.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { reactive, computed, ref, shallowRef, watch, type ComputedRef } from 'vue';
import { sweep, maxCurves, classifyFinite, classifyMaxFinite, classifyFlatClamp, validateParams } from '@openisd/engine';
import type { EngineDriver, DriverError, SweepResult, MaxCurvesResult, BoxType } from '@openisd/engine';
import { driverRecordProblems, OpenISDDriver } from '@openisd/model';
import type { SpecField, _OpenISDDriverJson, _OpenISDProjectJson } from '@openisd/model';
import { ManagedOpenISDProject, toAlignmentKind, fromAlignmentKind } from './managedProject.js';
import type { AppState, UiParams, SyncedParams, SerializedState, DriverJSON } from '../types.js';
import { presentationState, unitToken } from './presentationState.js';
import { parseChartTabId } from './series.js';
import { toDisplay, displayPrecision, type UnitGroup } from './fields/units.js';
import { getOrInit } from './hmrSingleton.js';
import {
  solveVentGroup, ventSolveSuspended, suspendVentSolve,
} from './useVentGroup.js';
import { solvePrGroup } from './usePrGroup.js';
// Persistence has a SINGLE source of truth: openisd.state (utils/persist.js),
// written by App.vue's watch and restored by loadLocal() on mount. store.js does
// not persist — it initialises to defaults; App.vue applies any saved state.

// ---- The project: ManagedOpenISDProject, and NOTHING else ----------------------------------------
// ARCHITECTURE.md §"Approved state stores": ManagedOpenISDProject holds ALL active/edit/what-if
// state. The store does not hold a driver, does not hold a baseline, and does not know a
// what-if exists — a second copy of any of those is a second answer to the same question, and
// the two are free to disagree. Everything below DELEGATES; it stores nothing.
//
// ManagedOpenISDProject's framework-free subscribe() is bridged to Vue through _version: it fires on
// every change the facade decides a subscriber should see (a what-if overlay fires live), and
// the computeds below touch _version so they re-derive exactly then. @openisd/model stays
// Vue-free — the arrow points up, never down.
//
// Declared here, ABOVE `state`, rather than in its own section below: the PR-group watch below
// runs `{ immediate: true }` at module load, synchronously reading `managedProject` — before any
// later `const managedProject` would exist yet (TDZ). It has to be defined before `state` is,
// not merely before it is first USED at runtime.
const _version = getOrInit('store', '_version', () => ref(0));

/**
 * THE project. The one facade over ground, committed and the edit-or-what-if overlay
 * (`logic/managedProject.ts`), and the domain object for ONE project in the left nav.
 *
 * Every read and every write of a project's state goes through it: `.cell()`/`.metaCell()`/
 * `.toEngineDriver()`/`.errors()`/`._snapshot()` to read; `.enter()`/`.clear()`/`.mutate()` to write;
 * `.beginWhatIf()`/`.cancelWhatIf()`/`.isWhatIfActive()` to manage a what-if. `._recordToPersist()`
 * is separate again — it is what anything saved/exported/shared reads, and it never hands out a
 * live what-if: it cancels one first, so nothing unverified can reach disk. The
 * `_OpenISDProjectJson` it wraps — and the `OpenISDDriver` inside that — are private to it and
 * never leave.
 */

/**
 * Human ruling (QO52, closed 2026-08-18): the ONLY module-level globals this file — or any
 * module — may export are `openProjects()` and `focusedProject()`. Enforced by
 * `packages/ui/test/ui/architecture.test.ts` ("module-level globals — only openProjects()/
 * focusedProject() are legal"). ONLY the human may add, remove, or edit an entry here — no
 * agent may widen this list on its own judgement to make a red test pass. A failing test
 * naming a new offender is the correct, expected result until the full migration
 * (REVIEW.md) lands; report the offender and wait for the human's ruling instead.
 *
 * Deliberately seeded with ONLY the permitted names — this list is expected to be far
 * shorter than this file's actual export surface until the migration in REVIEW.md is done.
 * `focusProject`/`removeProject`/`addProject` added 2026-08-18 by explicit human instruction
 * (the write side of the registry — openProjects()/focusedProject() alone are read-only).
 */
export const ALLOWED_GLOBALS = [
  'openProjects', 'focusedProject', 'focusProject', 'removeProject', 'addProject',
];
export const managedProject: ManagedOpenISDProject = getOrInit('store', '_managed', () => {
  const md = ManagedOpenISDProject.createEmpty();
  md.subscribe(() => { _version.value++; });
  return md;
});

/**
 * The multi-project registry (human ruling, 2026-08-18) — replaces `workspace.ts`'s ad-hoc
 * `WorkspaceEntry`/`OpenProject` and `OriginalShell.vue`'s local `openProjects`/
 * `activeProjectId` reimplementation as the ONE place "which projects are open, which is
 * focused" lives. `_projects[0]` starts as the same object `managedProject` already is — one
 * project open, matching today's actual behaviour — so this is additive: existing code using
 * `managedProject` directly keeps working unchanged while new/refactored code reads through
 * `focusedProject()`. Rewiring `OriginalShell.vue`'s own multi-project UI onto this registry,
 * and deleting `workspace.ts`, is separate, larger follow-on work (REVIEW.md Phase 1.4/1.5) —
 * not done in this pass; flagged, not silently deferred.
 */
const _projects = getOrInit('store', '_projects', () => shallowRef<ManagedOpenISDProject[]>([managedProject]));
const _focusedIndex = getOrInit('store', '_focusedIndex', () => ref(0));

/** Every open project. Empty array if none are open. */
export function openProjects(): ManagedOpenISDProject[] { return _projects.value; }

/** The project currently focused in the UI's project list, or null if none are open. */
export function focusedProject(): ManagedOpenISDProject | null {
  return _projects.value[_focusedIndex.value] ?? null;
}

/** Move focus to the project at `index` — called when the user changes the active project in
 *  the UI's project list. Out-of-range indices are ignored. */
export function focusProject(index: number): void {
  if (index < 0 || index >= _projects.value.length) return;
  _focusedIndex.value = index;
}

/** Remove the project at `index` from the registry. If the focused index is now past the end,
 *  it clamps to the new last project; if the registry is now empty, the index is left alone —
 *  `focusedProject()` already answers null for an out-of-range index, nothing to noop around. */
export function removeProject(index: number): void {
  if (index < 0 || index >= _projects.value.length) return;
  // shallowRef: reassign a new array rather than splice in place, or the removal wouldn't
  // trigger reactivity — shallowRef only tracks .value replacement, not in-place mutation.
  const next = _projects.value.slice();
  next.splice(index, 1);
  _projects.value = next;
  if (next.length > 0 && _focusedIndex.value >= next.length) {
    _focusedIndex.value = next.length - 1;
  }
}

/** Add a newly-created or re-imported project to the registry and focus it. */
export function addProject(project: ManagedOpenISDProject): void {
  _projects.value = [..._projects.value, project];
  _focusedIndex.value = _projects.value.length - 1;
}

function buildState(): AppState {
  const s = {
    project:      { name: '', creator: '', created: '', modified: '', description: '' },
  };
  // `box` is an accessor property over `managedProject`'s OWN `OpenISDBox.active` — not an
  // independent copy — because every `managedProject.boxVolume_m3()`/`.activeVentField()`/
  // `.boxTuning_Fb_hz()`/`.prField()` accessor (ledger QO54) picks its storage BY active
  // alignment, so `state.box` must always read the SAME `active` those accessors use, never a
  // second, independently-writable copy of it (packages/ui/test/logic/boxActiveSync.test.ts).
  Object.defineProperty(s, 'box', {
    enumerable: true, configurable: true,
    get: () => fromAlignmentKind(managedProject.activeAlignment()),
    set: (v: BoxType) => managedProject.setActiveAlignment(toAlignmentKind(v)),
  });
  return s as unknown as AppState;
}

export const state: AppState = getOrInit('store', 'state', () => reactive(buildState()));

// ---- Vent group: keep the calculated member solved while the user edits ------------------
// `_version` (above) already bumps on every managedProject mutation — box/vent/PR fields
// included — so it is the one reactive dependency this needs; the group itself decides,
// field by field, whether there is anything to solve (`ventDerivable`). Two guards:
//   _solvingVent  — the solver's own write must not re-enter the watcher: `_version` bumping
//                   again from inside `solveVentGroup`'s own mutation would otherwise recurse.
//   ventSolveSuspended() — a restore assigns a whole persisted snapshot and must be adopted
//                   verbatim (docs/design/STATE_MODEL.md rule 3, "Cancel means byte-identical").
let _solvingVent = false;
watch(
  () => [_version.value, state.box],
  () => {
    if (_solvingVent || ventSolveSuspended()) return;
    _solvingVent = true;
    try { solveVentGroup(managedProject, state.box); } finally { _solvingVent = false; }
  },
  // flush:'sync' is REQUIRED, not a preference. Vue's default 'pre' defers the callback to
  // the next tick, by which time suspendVentSolve() has already returned and cleared its
  // flag — the suspension would be a no-op and a restore would still be re-solved (and so
  // still drift). Synchronous flush makes the guard actually cover the assignment. The
  // callback is a few arithmetic ops; the expensive re-sweep is throttled separately.
  { flush: 'sync' },
);

// ---- PR tuning group: added mass ↔ system tuning -----------------------------------------
// Shares the vent group's suspension flag and the same `_version` dependency.
watch(
  () => _version.value,
  () => {
    if (_solvingVent || ventSolveSuspended()) return;
    _solvingVent = true;
    try { solvePrGroup(managedProject); } finally { _solvingVent = false; }
  },
  { flush: 'sync', immediate: true },
);

if (typeof window !== 'undefined') {
  if (!(window as any).__store_instances) (window as any).__store_instances = [];
  if (!(window as any).__store_instances.includes(state)) {
    (window as any).__store_instances.push(state);
  }
}

/** Load a driver from WinISD `.wdr` text. The `.wdr` is parsed as-read by the serialiser, then
 *  projected into the app's own model — the file format never reaches past this line. */
export function setDriverFromWdr(text: string): void {
  managedProject.loadDriverRecord(OpenISDDriver.fromWdrText(text).toJsonRecord());
}

/** Route one per-field edit to whichever layer ManagedOpenISDProject says is effective. */
export function enterDriverField(field: SpecField, value: number): void {
  managedProject.enter(field, value);
}
export function clearDriverField(field: SpecField): void {
  managedProject.clear(field);
}

// The resolved, engine-ready driver — EFFECTIVE, so a live what-if is what the charts draw.
// PRIVATE to this file's own sweep; every outside caller reads `managedProject.toEngineDriver()`
// directly through `logic/liveProject.ts`'s reactivity adapter instead of a store wrapper.
function _engineDriver(): EngineDriver | null {
  void _version.value;
  return managedProject.toEngineDriver();
}

// The PROJECT for persistence — committed state, never the overlay, so a live what-if is never
// saved, shared or written to disk. _projectToPersist() cancels an active what-if itself.
//
// NOT EXPORTED. The store may HOLD `_OpenISDProjectJson` (it is the stored object) but may not
// expose it on its API — only the domain wrappers may (human ruling 2026-08-20). Every consumer
// outside this file takes a domain wrapper or a public type instead.
function _projectToPersist(): _OpenISDProjectJson {
  void _version.value;
  return managedProject._projectToPersist();
}

/** Just the driver record out of the persistable project, for the paths that write a DRIVER
 *  file (`.wdr`, `.owdr`) rather than a project file. Undefined when none is chosen. */
export const driverRecord: ComputedRef<DriverJSON | undefined> =
  computed(() => _projectToPersist().driver);

/** What this driver is CALLED — brand and model as the record states them, from the EFFECTIVE
 *  driver. '' when nothing names it (no driver chosen yet), so a caller can fall back. */
export const driverName = computed<string>(() => {
  void _version.value;
  return [managedProject.metaCell('brand').value, managedProject.metaCell('model').value]
    .filter(x => x.length > 0).join(' ').trim();
});

/**
 * Open the driver picker — the ONE governed entry point. Cancels any active what-if first: an
 * uncommitted preview must never be left dangling once the user has moved on to picking a
 * different driver. Every "Select Driver"/"Browse…" trigger calls this, never a raw
 * `presentationState.browseOpen = true`. ManagedOpenISDProject owns the cancellation; this only asks for it.
 */
export function openDriverPicker(): void {
  if (managedProject.isWhatIfActive()) { managedProject.cancelWhatIf(); presentationState.editDriver = false; }
  presentationState.browseOpen = true;
}

function _driverErrors(): DriverError[] {
  void _version.value;
  return managedProject.errors();
}

export const syncedP = computed<SyncedParams>(() => {
  // The dependency: `toUiParams()`/`driveVoltage_V()` read the effective project directly and
  // touch no Vue ref themselves (`managedProject` stays framework-free), so this computed
  // re-derives on every project mutation via `_version`, the same bridge every other read in
  // this file uses (`logic/liveProject.ts`'s adapter, in this file's own private form).
  void _version.value;
  const p: SyncedParams = { ...managedProject.toUiParams(), eg: managedProject.driveVoltage_V() };
  if (state.box === 'vented' || state.box === 'bandpass4') {
    p.Sp = managedProject.ventArea_m2();
    p.Leff = managedProject.ventEffectiveLength_m();
  }
  return p;
});

const _curves = getOrInit('store', '_curves', () => ref<SweepResult | null>(null));
const _max    = getOrInit('store', '_max', () => ref<MaxCurvesResult | null>(null));
const _doSweep = () => {
  const d = _engineDriver();
  _curves.value = d ? sweep(d, state.box, syncedP.value) : null;
  _max.value    = d ? maxCurves(d, state.box, syncedP.value) : null;
};
_doSweep();
// Leading-edge throttle (was a pure trailing debounce): the chart curves must
// redraw DURING a held/rapid spinner drag, not only after release. A pure
// `setTimeout(_doSweep, 80)` cleared on every change starves the sweep while the
// value keeps changing faster than 80ms, so the graph froze until you let go
// (the bottom stat numbers, which read `driver`/`syncedP` directly, stayed live —
// that mismatch was the tell). Here the first change runs immediately, then at
// most once per _SWEEP_MS while changes keep coming, with a trailing run to catch
// the final value.
const _SWEEP_MS = 32;   // ~30 fps — live-feeling without resweeping every event
let _sweepTimer: ReturnType<typeof setTimeout> | null = null;
let _lastSweep = 0;
function _scheduleSweep(): void {
  const now = performance.now();
  const wait = _SWEEP_MS - (now - _lastSweep);
  if (wait <= 0) {
    if (_sweepTimer) { clearTimeout(_sweepTimer); _sweepTimer = null; }
    _lastSweep = now;
    _doSweep();
  } else if (_sweepTimer === null) {
    _sweepTimer = setTimeout(() => {
      _sweepTimer = null;
      _lastSweep = performance.now();
      _doSweep();
    }, wait);
  }
}
watch([_engineDriver, syncedP, () => state.box], _scheduleSweep);
export const curvesData = _curves;
export const maxData    = _max;

// Postcondition (hardening): a valid driver can still yield a non-finite sweep at
// some frequency (a numerical singularity the input guards can't foresee). Classify
// the sweep output so it's never a silently blank chart — surfaced through the same
// issue channel as deriveEngineDriver's errors. Empty when the driver is invalid (no sweep)
// or the sweep is clean.
const curveIssues = computed<DriverError[]>(() => {
  const sw = _curves.value, mx = _max.value;
  if (!sw) return [];
  // classifyFinite: a singularity made the curve undrawable. classifyMaxFinite: the same
  // question asked of the Max-SPL/Max-power pair, which is computed after the sweep and can
  // be non-finite while every sweep array is fine. classifyFlatClamp: force-flat ran out of
  // allowed boost, so the "flat" response is not flat below some frequency — a truncated
  // inverse filter must never look like a design that flattens for free.
  return [classifyFinite(sw), mx ? classifyMaxFinite(mx) : null, classifyFlatClamp(sw)]
    .filter((e): e is DriverError => e !== null);
});

// Precondition (hardening, CODE_REVIEW.md §18): the enclosure parameters the circuit
// divides by — Vb everywhere, Sp/Vf/PR per box type. The postcondition above does catch
// the resulting garbage, but only as "no usable values"; this names the field to change.
// Validated at the same store boundary, from the same params the sweep is actually run on.
export const paramIssues = computed<DriverError[]>(() => validateParams(state.box, syncedP.value));

// The full issue list the UI shows: driver-derivation issues + box-parameter issues +
// sweep/max-curve finiteness issues.
export const allIssues = computed<DriverError[]>(
  () => [..._driverErrors(), ...paramIssues.value, ...curveIssues.value]);

// ---- Project state: ground ↔ modified layer (docs/design/STATE_MODEL.md) ----------------------
// A project fingerprint captures the whole design (box + params + driver). "Ground" is
// the last loaded/saved fingerprint; the project is "modified" when the live design
// differs from it. This is the ground↔committed layer of docs/design/STATE_MODEL.md; the what-if/edit
// priorityState proxy layers are built on top of it separately. Additive — components keep
// reading state.box/managedProject directly; this only observes and can restore them.
function projectFingerprint(): string {
  // Order-deterministic: toUiParams() gathers fields in the same fixed order on every call,
  // and the ADT's toJSON() preserves input insertion order, so JSON.stringify yields a stable
  // string to diff.
  return JSON.stringify({
    box: state.box, P: managedProject.toUiParams(), driver: driverRecord.value, project: state.project,
  });
}
const _ground = getOrInit('store', '_ground', () => ref(projectFingerprint()));
/** True when the live design differs from the last loaded/saved (ground) state. */
export const isModified = computed<boolean>(() => _ground.value !== projectFingerprint());
/** Adopt the current design as ground (call after load, and after a successful save). */
export function markProjectSaved(): void { _ground.value = projectFingerprint(); }
/** The current ground checkpoint, opaque — for embedding in a saved project record
 *  (openProjects) alongside the design it belongs to. */
export function groundCheckpoint(): string { return _ground.value; }
/** Restore a previously-saved ground checkpoint — used when switching the active project
 *  among several open designs, each with its own ground. */
export function restoreGroundCheckpoint(value: string): void { _ground.value = value; }
/** Discard unsaved changes: restore the design to the ground state. */
export function resetProjectToGround(): void {
  const g = JSON.parse(_ground.value) as { box: BoxType; P: UiParams; driver: _OpenISDDriverJson; project?: any };
  // Adopt the stored params verbatim. The ground snapshot already holds BOTH vent-group
  // members and the entered set, so there is nothing to re-solve — and re-solving is exactly
  // what breaks "Cancel means byte-identical" (docs/design/STATE_MODEL.md rule 3): the solver would
  // reproduce the calculated member from a value that was rounded on its way through JSON
  // and land on a different double. `loadUiParams` sets the active alignment itself, so this
  // is the one call that lands box + every vent/PR/plain field together.
  suspendVentSolve(() => managedProject.loadUiParams(g.P, toAlignmentKind(g.box)));
  managedProject.loadDriverRecord(g.driver);
  if (g.project) {
    Object.assign(state.project, g.project);
  }
}
/** Start a brand-new project from the app's initial defaults — NOT the ground state. Clears
 *  the whole design (params incl. filters, compare traces, per-chart zoom, driver source) so
 *  a "new" project never inherits the previous one, then adopts the fresh design as ground.
 *  Callers (the New Project wizard) apply the chosen box type + volume on top afterwards.
 *  `managedProject.loadEmpty()` already resets box/vent/PR/environment/signal/simOptions/
 *  sweep/filters/entered to the app's initial defaults (`_prototypeProject()`) — there is
 *  nothing left for this function to reset on the params side. */
export function newProject(): void {
  presentationState.yRanges = {};
  state.project = { name: '', creator: '', created: '', modified: '', description: '' }; // blank meta
  managedProject.loadEmpty();                                // no driver chosen — the user picks one
  markProjectSaved();                                       // the fresh design is the new clean ground
}

/**
 * Restore a persisted snapshot (local save, share link, or an opened `.openisd.json` file)
 * into the live store — the ONE loader every entry point calls.
 *
 * Every load path must land the WHOLE snapshot: a second, hand-rolled subset loader is how
 * File → Open… silently dropped the project name, the view, the comparison overlays and the
 * graph cursor while appearing to succeed. `project-load-gate.test.ts` fails the suite if a
 * key serialize() emits is not restored here.
 */
/**
 * Why the last restore refused something, empty when it took everything.
 *
 * A refusal that only reaches the console is a silent data loss the user discovers later, so
 * it is surfaced: the app is running, and it says what it would not load and why.
 */
const restoreProblems = ref<string[]>([]);

export function applyState(o: SerializedState): void {
  // ONE POISON PILL MUST NOT TAKE THE APP DOWN (ARCHITECTURE.md §"No single datum may take
  // the app down"). `o.driver` is untrusted: it comes from localStorage, a share link or a
  // file, and `as _OpenISDDriverJson` is an assertion about data we did not write. An unchecked
  // record with no `specs` threw on its first field read and killed every driver computed in
  // the app — a blank screen from one absent key.
  //
  // So the record is CHECKED here, and a bad one is refused while the rest of the state — box,
  // vents, targets, charts, UI — restores as normal. Least impact: the user loses the driver
  // selection, not the session. `restoreProblems` carries the reason to the UI, which is what
  // makes it a reported fault rather than a silent drop.
  restoreProblems.value = [];
  if (o.driver) {
    const problems = driverRecordProblems(o.driver);
    if (problems.length) {
      restoreProblems.value = problems.map(p => `saved driver was not loaded: ${p}`);
      // QUARANTINE BEFORE THE AUTOSAVE EATS IT. Refusing the record leaves the app with no
      // driver, and the very next autosave writes that driverless state over `openisd.state` —
      // so within a tick the user's record is GONE and the least-damaging repair has nothing
      // left to repair. Setting it aside keeps a one-field fix possible, and keeps the evidence
      // for diagnosing the cause.
      try { localStorage.setItem('openisd.quarantine.driver', JSON.stringify(o.driver)); }
      catch { /* storage full or disabled — the refusal still stands */ }
      console.error(`[restore] refused the saved driver record — ${problems.join('; ')}`);
    } else {
      managedProject.loadDriverRecord(o.driver as _OpenISDDriverJson);
    }
  }
  if (o.box) state.box = o.box;
  if (o.lossMode) presentationState.lossMode = o.lossMode;
  // Verbatim, for the same reason as resetProjectToGround: a persisted design carries both
  // vent-group members and the entered set, so a restore has nothing to compute.
  //
  // A design saved before the vent group existed carries `ventL` and no provenance. That is
  // not a second model to support — it is foreign input arriving at the persistence
  // boundary, and this is the one place it gets read into the single current shape. Its
  // `ventL` WAS authoritative (it was the only direction the app had), so the faithful
  // reading is exactly that: length entered, tuning solved from it.
  if (o.P) suspendVentSolve(() => {
    const incoming = { ...o.P };
    if (incoming.ventShape === undefined) incoming.ventShape = 'round';
    if (incoming.ventW === undefined) incoming.ventW = 0.10;
    if (incoming.ventH === undefined) incoming.ventH = 0.05;
    const hadEntered = !!incoming.entered;
    if (!hadEntered) incoming.entered = { Vb: true, ventD: true, ventW: true, ventH: true, ventL: true };
    managedProject.loadUiParams(incoming, toAlignmentKind(state.box));
    if (!hadEntered) solveVentGroup(managedProject, state.box);
  });
  // A saved/shared blob carries chart ids as plain strings, so each goes through the one
  // string→member boundary; an id this build does not declare is invalid data, and is
  // dropped rather than restored as a chart nothing can draw.
  if (Array.isArray(o.graphs) && o.graphs.length) presentationState.graphs = o.graphs.map(parseChartTabId);
  if (o.ui) Object.assign(presentationState.ui, o.ui);   // the whole view context is carried by a share link (stateToUrl, human ruling 2026-08-14) — nothing in it is stripped
  if (o.project) Object.assign(state.project, o.project);
  if (o.cursor) {
    presentationState.cursorF = o.cursor.f;
    presentationState.pinnedF = o.cursor.pinnedF;
    presentationState.cursorLocked = o.cursor.locked;
    presentationState.dragRange = o.cursor.range ? { fLo: o.cursor.range.fLo, fHi: o.cursor.range.fHi } : null;
  }
}

// A comparison overlay is stored WITHOUT its curves (they are derived, and bulk out every
// save and share link), so restoring one means re-running its sweep — a row without curves
// draws nothing, which is the same "loaded but invisible" failure at the overlay level.

// ---- Per-field display units (fields/units.ts) ------------------------------------
// The store stays SI; formatInUnit only chooses how a CALCULATED value is shown, reading the
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
  get: () => { void _version.value; return managedProject.circuitModel() === 'gyrator'; },
  set: (on) => { managedProject.setCircuitModel(on ? 'gyrator' : 'winisd'); },
});



