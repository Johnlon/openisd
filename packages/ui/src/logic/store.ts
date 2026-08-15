/* eslint-disable @typescript-eslint/no-explicit-any */
import { reactive, computed, ref, watch } from 'vue';
import { sweep, maxCurves, classifyFinite, classifyMaxFinite, classifyFlatClamp, validateParams } from '@openisd/engine';
import type { Driver, DriverError, ConsistencyIssue, SweepResult, MaxCurvesResult, BoxType } from '@openisd/engine';
import type { Cell, MetaCell, SpecField, MetaField, OpenISDDriver } from '@openisd/model';

/** The openisd.yml record shape — what `OpenISDDriver.toRecord()` hands back. A TYPE only:
 *  `ManagedProject` is the one holder of the OpenISDDriver value (ARCHITECTURE.md §2). */
type DriverRecord = ReturnType<OpenISDDriver['toRecord']>;
import { WinISDDriver } from '@openisd/winisd';
import { ManagedProject } from './managedProject.js';
import type { AppState, UiParams, SyncedParams, SerializedState } from '../types.js';
import { parseChartTabId } from './series.js';
import { nextToken, toDisplay, displayPrecision, unitDef, type UnitGroup } from './fields/units.js';
import {
  solveVentGroup, ventSolveSuspended, suspendVentSolve, ventSp,
  enterVentField as enterVentFieldOn, clearVentField as clearVentFieldOn,
  ventFieldState as ventFieldStateOn, type VentField, type VentEntryField,
  ventTargetUnreachable as ventUnreachableOn, ventMaxReachableFb as ventMaxReachableFbOn,
} from './useVentGroup.js';
import {
  solvePrGroup, prTargetUnreachable as prUnreachableOn,
  enterPrField as enterPrFieldOn, clearPrField as clearPrFieldOn,
  prFieldState as prFieldStateOn, type PrField,
} from './usePrGroup.js';
import { tuningFromLength } from '@openisd/engine';

const P_DEFAULTS: UiParams = {
  Vb:0.030, Vf:0.015, ventShape:'round', ventD:0.05, ventW:0.10, ventH:0.05, ventL:0.10, Ql:10, Qa:100, Qp:100,
  // Fb is DERIVED from the ventL/ventD/Vb literals above rather than written as its own
  // number, so the default design is numerically identical to what it has always been —
  // with `entered` below making ventL the calculated member, it re-solves straight back to
  // 0.10 m. A hand-written Fb would silently move the default box.
  Fb: tuningFromLength(0.030, 0.10, ventSp(0.05), 0.732),
  Frc: 50,
  // PR system tuning. Seeded to 0 and solved from the added mass on first use, because it
  // depends on Vb and the PR's own parameters — there is no meaningful literal for it.
  prFp: 0,
  // WinISD's direction: volume, diameter and tuning are typed; vent length is returned.
  // For the PR, added mass is entered and the tuning solved — the panel's historic behaviour.
  entered: { Vb: true, ventD: true, ventW: true, ventH: true, Fb: true, Frc: true, prMadd: true },
  nDrivers:1, wiring:'parallel', Pin:1, Rs:0.1,
  prName:'Custom PR',
  prSd:0.0133, prNum:1, prMmd:0.010, prMadd:0, prCms:0.0008, prRms:1.0, prXmax:0.012, prMode:'winisd',
  fmin:1, fmax:20000, N:400,
  circuitModel: 'winisd',
  filters: [],
  vcTempRise: 0, alfaVC: 0.0039, driverAddedMass: 0,   // WinISD-parity; no-op until temp rise / mass set
  endCorrection: 0.732,                                 // one-flanged (WinISD default); selectable
  // WinISD Advanced-pane options. Each default is OpenISD's historic behaviour, so opening an
  // existing design changes nothing. NOTE rgAtDriverSide defaults true where WinISD's own
  // checkbox ships unchecked — see PLAN_ADVANCED_SIM_OPTIONS.md Q3.
  rgAtDriverSide: false, tlPortModel: false, forceFlatResponse: false, splXmaxLimited: false,
  // Environment — PER PROJECT, as in WinISD's .wpr [Box] section (T / p / phi). ρ and c are
  // derived from all three (engine air.ts). `ignoreHumidityAndPressure` opts in to WinISD's
  // behaviour of storing them and never reading them; openisd's default is the physics
  // (ledger QO7). Humidity is a PERCENT here; the .wpr's fraction is converted in the writer.
  tempK: 293.15, humidityPct: 30, pressurePa: 101325, ignoreHumidityAndPressure: false,
};

// Persistence has a SINGLE source of truth: openisd.state (utils/persist.js),
// written by App.vue's watch and restored by loadLocal() on mount. store.js does
// not persist — it initialises to defaults; App.vue applies any saved state.
const globalCtx = (typeof window !== 'undefined') ? (window as any) : null;
if (globalCtx && !globalCtx.__store_context) {
  globalCtx.__store_context = {};
}
const ctx = globalCtx ? globalCtx.__store_context : {};

function getOrInit<T>(key: string, init: () => T): T {
  if (!(key in ctx)) {
    ctx[key] = init();
  }
  return ctx[key];
}

/**
 * A fresh copy of the defaults. The object-valued members (`filters`, `entered`) are cloned,
 * because a shallow spread of P_DEFAULTS hands out the SAME array/object to every design —
 * so pushing a filter or entering a vent field would mutate the defaults themselves, and the
 * next "new project" would inherit it. One helper rather than each call site remembering.
 */
function defaultP(): UiParams {
  return { ...P_DEFAULTS, filters: [], entered: { ...P_DEFAULTS.entered } };
}

export const state: AppState = getOrInit('state', () => reactive({
  box:       'vented',
  lossMode:  'winisd-lossy',
  P:         defaultP(),
  graphs:    ['SPL', 'Excursion', 'Zmag', 'GD'],
  editDriver: false,
  editDriverInfo: false,
  cursorF:     null,
  pinnedF:     null,
  cursorLocked: false,
  dragRange:   null,  // { fLo, fHi } — shared frequency selection across all graph panels
  browseOpen:   false,
  defineOpen:   false,
  driverSource: null,  // snapshot of the last driver loaded from the library — used for reset
  yRanges:      {},    // per-chart Y-axis override: { [tabId]: { min, max } }; absent = auto-scale
  ui:           { skin: (typeof window !== 'undefined' && window.location.port === '4100') ? 'modern' : 'original', unitTokens: {}, envDefaults: { tempK: 293.15, pressurePa: 101325.0, humidityPct: 30.0 } },  // local-only presentation prefs; never shared (persist.ts)
  project:      { name: '', creator: '', created: '', modified: '', description: '' },
}));

// ---- Vent group: keep the calculated member solved while the user edits ------------------
// Watches only what can DRIVE a re-solve — the two always-entered members, the end
// correction, and whichever of Fb/ventL is currently entered. Two guards:
//   _solvingVent  — the solver's own write must not re-enter the watcher. With floating
//                   point, L → Fb → L need not land on the identical double, so an
//                   unguarded watch on all four can oscillate instead of settling.
//   ventSolveSuspended() — a restore assigns a whole persisted P and must be adopted
//                   verbatim (docs/design/STATE_MODEL.md rule 3, "Cancel means byte-identical").
let _solvingVent = false;
watch(
  () => [
    state.box === 'bandpass4' ? state.P.Vf : state.P.Vb,
    state.P.ventD, state.P.ventShape, state.P.ventW, state.P.ventH, state.P.endCorrection,
    state.P.entered.Fb ? state.P.Fb : state.P.ventL,
    state.box,
  ],
  () => {
    if (_solvingVent || ventSolveSuspended()) return;
    _solvingVent = true;
    try { solveVentGroup(state.P, state.box); } finally { _solvingVent = false; }
  },
  // flush:'sync' is REQUIRED, not a preference. Vue's default 'pre' defers the callback to
  // the next tick, by which time suspendVentSolve() has already returned and cleared its
  // flag — the suspension would be a no-op and a restore would still be re-solved (and so
  // still drift). Synchronous flush makes the guard actually cover the assignment. The
  // callback is a few arithmetic ops; the expensive re-sweep is throttled separately.
  { flush: 'sync' },
);

/** Enter a vent-group field on the current design — held until explicitly cleared. */
export function enterVentField(field: VentEntryField, value: number): void {
  enterVentFieldOn(state.P, field, value, state.box);
}
/** Clear a vent-group field — it becomes C if the rest determine it, else N. */
export function clearVentField(field: VentField): void {
  clearVentFieldOn(state.P, field, state.box);
}
/** E / C / N for a vent-group field, in the driver editor's own vocabulary. */
export function ventFieldState(field: VentField): 'E' | 'C' | 'N' {
  return ventFieldStateOn(state.P, field, state.box);
}
/** True when the entered target tuning is not reachable with this volume and port area. */
export function ventTargetUnreachable(): boolean {
  return ventUnreachableOn(state.P, state.box);
}
/** The highest tuning any vent of this area can deliver in this volume — the L = 0 tuning. */
export function ventMaxReachableFb(): number | null {
  return ventMaxReachableFbOn(state.P, state.box);
}

// ---- PR tuning group: added mass ↔ system tuning -----------------------------------------
// Shares the vent group's suspension flag: both are solved off `state.P`, and a restore must
// adopt the whole of P verbatim or neither group is byte-identical.
watch(
  () => [state.P.Vb, state.P.prSd, state.P.prCms, state.P.prMmd, state.P.prNum,
         state.P.entered.prFp ? state.P.prFp : state.P.prMadd],
  () => {
    if (_solvingVent || ventSolveSuspended()) return;
    _solvingVent = true;
    try { solvePrGroup(state.P); } finally { _solvingVent = false; }
  },
  { flush: 'sync', immediate: true },
);

/** Enter a PR-group field (target tuning or added mass) — held until explicitly cleared. */
export function enterPrField(field: PrField, value: number): void {
  enterPrFieldOn(state.P, field, value);
}
/** Clear a PR-group field — it becomes C if the other determines it, else N. */
export function clearPrField(field: PrField): void {
  clearPrFieldOn(state.P, field);
}
/** E / C / N for a PR-group field. */
export function prFieldState(field: PrField): 'E' | 'C' | 'N' {
  return prFieldStateOn(state.P, field);
}
/** True when the entered target tuning is not reachable by adding mass to this PR. */
export function prTargetUnreachable(): boolean {
  return prUnreachableOn(state.P);
}

if (typeof window !== 'undefined') {
  if (!(window as any).__store_instances) (window as any).__store_instances = [];
  if (!(window as any).__store_instances.includes(state)) {
    (window as any).__store_instances.push(state);
  }
}

// ---- The project: ManagedProject, and NOTHING else ----------------------------------------
// ARCHITECTURE.md §"Approved state stores": ManagedProject holds ALL active/edit/what-if
// state. The store does not hold a driver, does not hold a baseline, and does not know a
// what-if exists — a second copy of any of those is a second answer to the same question, and
// the two are free to disagree. Everything below DELEGATES; it stores nothing.
//
// ManagedProject's framework-free subscribe() is bridged to Vue through _version: it fires on
// every change the facade decides a subscriber should see (an edit draft stays silent until
// commitEdit; a what-if overlay fires live), and the computeds below touch _version so they
// re-derive exactly then. @openisd/model stays Vue-free — the arrow points up, never down.
const _version = getOrInit('_version', () => ref(0));

/**
 * THE project. The one facade over ground, committed and the edit-or-what-if overlay
 * (`logic/managedProject.ts`), and the domain object for ONE project in the left nav.
 *
 * Every read and every write of a project's state goes through it: `.cell()`/`.metaCell()`/
 * `.toDriver()`/`.errors()`/`.snapshot()` to read, `.enter()`/`.clear()`/`.mutate()` to write,
 * `.recordToPersist()` for anything saved/exported/shared, `.beginWhatIf()`/`.cancelWhatIf()`/
 * `.isWhatIfActive()` for a what-if, `.beginEdit()`/`.commitEdit()`/`.cancelEdit()` for an
 * edit. The `OpenISDProject` it wraps — and the `OpenISDDriver` inside that — are private to
 * it and never leave.
 */
export const managedProject: ManagedProject = getOrInit('_managed', () => {
  const md = ManagedProject.createEmpty();
  ctx._unsub = md.subscribe(() => { _version.value++; });
  return md;
});

/** Adopt a chosen driver into the CURRENT design — a library pick, an import, a file open.
 *  The box and everything else are left alone: choosing a driver is not opening a project. */
export function loadDriverRecord(record: DriverRecord): void {
  managedProject.loadDriverRecord(record);
}

/** Load a driver from WinISD `.wdr` text. The `.wdr` is parsed as-read by the serialiser, then
 *  projected into the app's own model — the file format never reaches past this line. */
export function setDriverFromWdr(text: string): void {
  managedProject.loadDriverRecord(WinISDDriver.fromWdr(text).toOpenISDRecord());
}

/** Route one per-field edit to whichever layer ManagedProject says is effective. */
export function enterDriverField(field: SpecField, value: number): void {
  managedProject.enter(field, value);
}
export function clearDriverField(field: SpecField): void {
  managedProject.clear(field);
}

/** One field's value + E/C/N provenance from the EFFECTIVE driver. Reactive: touching
 *  _version makes any render or computed calling this re-run when ManagedProject notifies. */
export function driverCell(field: SpecField): Cell {
  void _version.value;
  return managedProject.cell(field);
}

/** A record-level metadata field (brand/model/manufacturer) from the EFFECTIVE driver. */
export function driverMetaCell(field: MetaField): MetaCell {
  void _version.value;
  return managedProject.metaCell(field);
}

// The resolved, engine-ready driver — EFFECTIVE, so a live what-if is what the charts draw.
export const driver = computed<Driver | null>(() => {
  void _version.value;
  return managedProject.toDriver();
});

// The PROJECT for persistence — committed state, never the overlay, so a live what-if is never
// saved, shared or written to disk. recordToPersist() cancels an active what-if itself.
export const projectToPersist = computed(() => {
  void _version.value;
  return managedProject.recordToPersist();
});

/** Just the driver record out of the persistable project, for the paths that write a DRIVER
 *  file (`.wdr`, `.owdr`) rather than a project file. Undefined when none is chosen. */
export const driverRecord = computed<DriverRecord | undefined>(() => projectToPersist.value.driver);

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
 * `state.browseOpen = true`. ManagedProject owns the cancellation; this only asks for it.
 */
export function openDriverPicker(): void {
  if (managedProject.isWhatIfActive()) { managedProject.cancelWhatIf(); state.editDriver = false; }
  state.browseOpen = true;
}

export const driverErrors = computed<DriverError[]>(() => {
  void _version.value;
  return managedProject.errors();
});
export const driverConsistencyIssues = computed<ConsistencyIssue[]>(() => {
  void _version.value;
  return managedProject.consistencyIssues();
});
// driverWarnings: human-readable messages for all errors and warns — used by DriverPanel
export const driverWarnings = computed<string[]>(() => driverErrors.value.map(e => e.message));

export const syncedP = computed<SyncedParams>(() => {
  // Drive voltage: sqrt(Pin × Re) — matches WinISD reference-power convention.
  // Users can also set voltage directly in the UI; Pin is back-calculated from V²/Re.
  const eg = Math.sqrt((state.P.Pin ?? 1) * (driver.value?.Re ?? 1));
  const p: SyncedParams = { ...state.P, eg };
  // Deep-copy the filters so this computed depends on each filter's fields (fc/Q/gain)
  // AND the array length — the shallow `{ ...state.P }` above only captures the array
  // reference, so editing or adding/removing a filter would not recompute syncedP and
  // the sweep would never re-run.
  p.filters = state.P.filters.map(f => ({ ...f }));
  if (state.box === 'vented' || state.box === 'bandpass4') {
    if (state.P.ventShape === 'slotted') {
      const Sp = state.P.ventW * state.P.ventH;
      const d = 2 * Math.sqrt(Sp / Math.PI);
      p.Sp   = Sp;
      p.Leff = state.P.ventL + state.P.endCorrection * d;
    } else {
      p.Sp   = Math.PI * (state.P.ventD / 2) ** 2;
      p.Leff = state.P.ventL + state.P.endCorrection * state.P.ventD;
    }
  }
  return p;
});

const _curves = getOrInit('_curves', () => ref<SweepResult | null>(null));
const _max    = getOrInit('_max', () => ref<MaxCurvesResult | null>(null));
const _doSweep = () => {
  const d = driver.value;
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
watch([driver, syncedP, () => state.box], _scheduleSweep);
export const curvesData = _curves;
export const maxData    = _max;

// Postcondition (hardening): a valid driver can still yield a non-finite sweep at
// some frequency (a numerical singularity the input guards can't foresee). Classify
// the sweep output so it's never a silently blank chart — surfaced through the same
// issue channel as deriveDriver's errors. Empty when the driver is invalid (no sweep)
// or the sweep is clean.
export const curveIssues = computed<DriverError[]>(() => {
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
  () => [...driverErrors.value, ...paramIssues.value, ...curveIssues.value]);

// ---- Project state: ground ↔ modified layer (docs/design/STATE_MODEL.md) ----------------------
// A project fingerprint captures the whole design (box + params + driver). "Ground" is
// the last loaded/saved fingerprint; the project is "modified" when the live design
// differs from it. This is the ground↔modified layer of docs/design/STATE_MODEL.md; the what-if/edit
// priorityState proxy layers are built on top of it separately. Additive — components keep
// reading state.P/state.box directly; this only observes and can restore them.
function projectFingerprint(): string {
  // Order-deterministic: state.P keeps its P_DEFAULTS key order and the ADT's toJSON()
  // preserves input insertion order, so JSON.stringify yields a stable string to diff.
  return JSON.stringify({ box: state.box, P: state.P, driver: driverRecord.value, project: state.project });
}
export const _ground = getOrInit('_ground', () => ref(projectFingerprint()));
/** True when the live design differs from the last loaded/saved (ground) state. */
export const isModified = computed<boolean>(() => _ground.value !== projectFingerprint());
/** Adopt the current design as ground (call after load, and after a successful save). */
export function markProjectSaved(): void { _ground.value = projectFingerprint(); }
/** Discard unsaved changes: restore the design to the ground state. */
export function resetProjectToGround(): void {
  const g = JSON.parse(_ground.value) as { box: BoxType; P: UiParams; driver: DriverRecord; project?: any };
  state.box = g.box;
  // Adopt the stored params verbatim. The ground snapshot already holds BOTH vent-group
  // members and the entered set, so there is nothing to re-solve — and re-solving is exactly
  // what breaks "Cancel means byte-identical" (docs/design/STATE_MODEL.md rule 3): the solver would
  // reproduce the calculated member from a value that was rounded on its way through JSON
  // and land on a different double.
  suspendVentSolve(() => Object.assign(state.P, g.P));
  managedProject.loadDriverRecord(g.driver);
  if (g.project) {
    Object.assign(state.project, g.project);
  }
}
/** Start a brand-new project from the app's initial defaults — NOT the ground state. Clears
 *  the whole design (params incl. filters, compare traces, per-chart zoom, driver source) so
 *  a "new" project never inherits the previous one, then adopts the fresh design as ground.
 *  Callers (the New Project wizard) apply the chosen box type + volume on top afterwards. */
export function newProject(): void {
  state.box = 'vented';
  Object.assign(state.P, defaultP());   // fresh filters array + entered set, not the shared default refs
  state.yRanges = {};
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
export function applyState(o: SerializedState): void {
  if (o.driver) managedProject.loadDriverRecord(o.driver as DriverRecord);
  if (o.box) state.box = o.box;
  if (o.lossMode) state.lossMode = o.lossMode;
  // Verbatim, for the same reason as resetProjectToGround: a persisted design carries both
  // vent-group members and the entered set, so a restore has nothing to compute.
  //
  // A design saved before the vent group existed carries `ventL` and no provenance. That is
  // not a second model to support — it is foreign input arriving at the persistence
  // boundary, and this is the one place it gets read into the single current shape. Its
  // `ventL` WAS authoritative (it was the only direction the app had), so the faithful
  // reading is exactly that: length entered, tuning solved from it.
  if (o.P) suspendVentSolve(() => {
    const incoming = o.P as UiParams;
    Object.assign(state.P, incoming);
    if (state.P.ventShape === undefined) state.P.ventShape = 'round';
    if (state.P.ventW === undefined) state.P.ventW = 0.10;
    if (state.P.ventH === undefined) state.P.ventH = 0.05;
    if (!incoming.entered) {
      state.P.entered = { Vb: true, ventD: true, ventW: true, ventH: true, ventL: true };
      solveVentGroup(state.P, state.box);
    }
  });
  // A saved/shared blob carries chart ids as plain strings, so each goes through the one
  // string→member boundary; an id this build does not declare is invalid data, and is
  // dropped rather than restored as a chart nothing can draw.
  if (Array.isArray(o.graphs) && o.graphs.length) state.graphs = o.graphs.map(parseChartTabId);
  if (o.ui) Object.assign(state.ui, o.ui);   // skin + active tab/chart ARE carried by a share link (stateToUrl); only an open editor's uncommitted buffer + unit prefs are stripped there
  if (o.project) Object.assign(state.project, o.project);
  if (o.cursor) {
    state.cursorF = o.cursor.f;
    state.pinnedF = o.cursor.pinnedF;
    state.cursorLocked = o.cursor.locked;
    state.dragRange = o.cursor.range ? { fLo: o.cursor.range.fLo, fHi: o.cursor.range.fHi } : null;
  }
}

// A comparison overlay is stored WITHOUT its curves (they are derived, and bulk out every
// save and share link), so restoring one means re-running its sweep — a row without curves
// draws nothing, which is the same "loaded but invisible" failure at the overlay level.

// ---- Per-field display units (fields/units.ts) ------------------------------------
// The store stays SI; these only choose how a field is shown/entered. A skin pairs a
// NumInput (or a calculated readout) with a <UnitToggle> that cycles the field's token;
// both read the token here so they agree. Keyed by field id, so the same quantity shown
// in more than one place/skin shares one selected unit. `baseToken` is the field's own
// default unit (its historic display unit) used until the user rotates it.
/** The field's currently-selected unit token (its base unit until rotated). */
export function unitToken(field: string, baseToken: string): string {
  return state.ui.unitTokens?.[field] ?? baseToken;
}
/** Rotate a field's unit to the next token in its group (persisted, survives refresh). */
export function cycleUnitToken(field: string, group: UnitGroup, baseToken: string): void {
  if (!state.ui.unitTokens) state.ui.unitTokens = {};
  state.ui.unitTokens[field] = nextToken(group, unitToken(field, baseToken));
}
/** Reset every field's display unit back to its own default (undoes all unit toggling app-wide
 *  — cm/L/g/Hz/K/Pa etc., whatever each field's `base` prop is), in one action. Does not touch
 *  state.P — this only affects how values are DISPLAYED, never the stored (SI) design. */
export function resetUnitTokens(): void {
  state.ui.unitTokens = {};
}
/** The current unit symbol shown for a field (its base unit until rotated). */
export function unitLabelOf(field: string, group: UnitGroup, baseToken: string): string {
  return unitDef(group, unitToken(field, baseToken)).label;
}
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
  get: () => state.P.circuitModel === 'gyrator',
  set: (on) => { state.P.circuitModel = on ? 'gyrator' : 'winisd'; },
});



