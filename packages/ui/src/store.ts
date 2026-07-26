import { reactive, computed, ref, shallowRef, watch } from 'vue';
import { sweep, maxCurves, classifyFinite, classifyFlatClamp } from '@openisd/engine';
import type { Driver, DriverRaw, DriverError, SweepResult, MaxCurvesResult, BoxType } from '@openisd/engine';
import { Driver as DriverModel, type DriverJSON } from '@openisd/winisd';
import { DPAL } from './presets.js';
import type { AppState, UiParams, SyncedParams, Design, SerializedState } from './types.js';
import { nextToken, toDisplay, displayPrecision, unitDef, type UnitGroup } from './fields/units.js';
import { copyOfName, uniqueName } from './utils/projectFile.js';

// The app's default driver on first open (no saved selection) and the target of the
// "Reset to sample" button. Mirrors drivers/demos/demo-generic-6.5in-woofer.wdr.
export const DEFAULT_DRIVER: DriverRaw = { name: 'Samples - Generic 6.5" Woofer', brand: 'Samples', model: 'Generic 6.5" Woofer', Fs:37, Qts:0.378, Qes:0.40, Qms:7.0, Vas:0.0300, Sd:0.0133, Re:5.6, Le:0.70e-3, Xmax:0.0050, Pe:60, Z:8 };

const P_DEFAULTS: UiParams = {
  Vb:0.030, Vf:0.015, ventD:0.05, ventL:0.10, Ql:10, Qa:100, Qp:100,
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
  rgAtDriverSide: true, tlPortModel: false, forceFlatResponse: false, splXmaxLimited: false,
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

export const state: AppState = getOrInit('state', () => reactive({
  box:       'vented',
  P:         { ...P_DEFAULTS },
  graphs:    ['SPL', 'Excursion', 'Zmag', 'GD'],
  compare:   [],
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
  ui:           { skin: 'auto', unitTokens: {}, envDefaults: { tempK: 293.15, pressurePa: 101325.0, humidityPct: 30.0 } },  // local-only presentation prefs; never shared (persist.ts)
  project:      { name: '', creator: '', created: '', modified: '', description: '' },
}));

if (typeof window !== 'undefined') {
  if (!(window as any).__store_instances) (window as any).__store_instances = [];
  if (!(window as any).__store_instances.includes(state)) {
    (window as any).__store_instances.push(state);
  }
}

// The store's single source of truth for the driver is a long-lived Driver ADT instance
// (@openisd/winisd). It owns E/C/N provenance and every derivation. Its framework-free
// subscribe() is bridged to Vue through _version: every enter/clear and every instance
// swap bumps _version, and the computeds below touch it so they re-derive. winisd stays
// Vue-free — the arrow points up (ui → winisd), never down.
const _version = getOrInit('_version', () => ref(0));
let _model = getOrInit('_model', () => {
  const m = DriverModel.fromRaw(DEFAULT_DRIVER);
  ctx._unsub = m.subscribe(() => { _version.value++; });
  return m;
});
let _unsub = ctx._unsub;

/** The current Driver ADT instance — call enter/clear/toWdr on it directly. */
export function getDriverModel(): DriverModel {
  if (globalCtx && ctx._model) return ctx._model;
  return _model;
}

// Swap the held instance (load / import / reset). Re-bridge reactivity and bump once.
function setModel(m: DriverModel): void {
  _unsub();
  _model = m;
  _unsub = m.subscribe(() => { _version.value++; });
  _version.value++;
  if (globalCtx) {
    ctx._model = m;
    ctx._unsub = _unsub;
  }
}
/** Load a driver from a plain DriverRaw bag (My Drivers, saved project, demo). */
export function setDriverFromRaw(raw: DriverRaw | null | undefined): void {
  setModel(DriverModel.fromRaw(raw ?? {}));
}
/** Load a driver from WinISD .wdr text (import, library) — returns the new instance. */
export function setDriverFromWdr(text: string): DriverModel {
  const m = DriverModel.fromWdr(text);
  setModel(m);
  return m;
}
// Restore from a persisted/shared snapshot. v≥2 carries the full DriverJSON (marks +
// carried fields); a v1 blob carries a flat DriverRaw — routed through fromRaw.
export function setDriverFromSerialized(d: DriverJSON | DriverRaw | null | undefined): void {
  if (d && typeof d === 'object' && 'inputs' in d) setModel(DriverModel.fromJSON(d as DriverJSON));
  else setModel(DriverModel.fromRaw((d ?? {}) as DriverRaw));
}
// ---- What-if overlay (STATE_MODEL.md, Increment 2) ---------------------------------
// A driver-only what-if is a live COPY of the committed model. While active, the charts,
// StatBar, and the open editor read the copy (via the effective accessors below), so the
// preview updates live; but the committed `_model` — and therefore persistence and the
// ground fingerprint — is untouched, so scrubbing a what-if never dirties the project.
// `priorityState` (STATE_MODEL): the effective model IS the highest-priority layer that
// exists — what-if overlay when active, else the committed model. Reactive readers hang off
// the effective accessors; start/keep/cancel just swap which layer they resolve to.
// Modern/Classic never start a what-if here, so effective ≡ committed there (Invariant 1).
// const _whatIf       = getOrInit('_whatIf', () => shallowRef<DriverModel | null>(null));
const _whatIf       = getOrInit('_whatIf', () => shallowRef<DriverModel | null>(null));
const _whatIfVersion = getOrInit('_whatIfVersion', () => ref(0));
let _whatIfUnsub = getOrInit('_whatIfUnsub', () => null as (() => void) | null);
function _effModel(): DriverModel {
  return _whatIf.value ?? (globalCtx && ctx._model ? ctx._model : _model);
}

/** Begin a driver what-if: overlay a live copy of the committed model. Idempotent. */
export function startDriverWhatIf(): void {
  if (_whatIf.value) return;
  const m = DriverModel.fromJSON(_model.toJSON());   // deep copy of the committed driver
  _whatIfUnsub = m.subscribe(() => { _whatIfVersion.value++; });
  _whatIf.value = m;
  _whatIfVersion.value++;
  if (globalCtx) {
    ctx._whatIfUnsub = _whatIfUnsub;
  }
}
function _clearWhatIf(): void {
  if (_whatIfUnsub) { _whatIfUnsub(); _whatIfUnsub = null; }
  _whatIf.value = null;
  _whatIfVersion.value++;
  if (globalCtx) {
    ctx._whatIfUnsub = null;
  }
}
/** Keep: commit the what-if overlay as the live driver (→ modified), then drop the overlay. */
export function keepDriverWhatIf(): void {
  if (!_whatIf.value) return;
  const j = _whatIf.value.toJSON();
  _clearWhatIf();
  setModel(DriverModel.fromJSON(j));   // becomes the committed model → project is now modified
}
/** Cancel: discard the what-if overlay; the committed driver is unchanged. */
export function cancelDriverWhatIf(): void { _clearWhatIf(); }
/** Set the what-if overlay's driver from a raw bag (e.g. Tune's "Reset to library"). */
export function setWhatIfFromRaw(raw: DriverRaw | null | undefined): void {
  if (!_whatIf.value) return;
  if (_whatIfUnsub) _whatIfUnsub();
  _whatIf.value = DriverModel.fromRaw(raw ?? {});
  _whatIfUnsub = _whatIf.value.subscribe(() => { _whatIfVersion.value++; });
  _whatIfVersion.value++;
}
export const isDriverWhatIfActive = computed<boolean>(() => _whatIf.value !== null);
// The active overlay serialized (or null) — lets a skin persist an in-progress what-if so a
// refresh can restore it. Committed persistence still uses driverJSON (committed-only).
export const whatIfJSON = computed<DriverJSON | null>(() => {
  void _whatIfVersion.value;
  return _whatIf.value ? _whatIf.value.toJSON() : null;
});
/** Re-create the what-if overlay from a persisted snapshot (refresh restore). Unlike
 *  startDriverWhatIf (which copies the committed model), this adopts the given buffer. */
export function restoreDriverWhatIf(json: DriverJSON): void {
  if (_whatIfUnsub) _whatIfUnsub();
  _whatIf.value = DriverModel.fromJSON(json);
  _whatIfUnsub = _whatIf.value.subscribe(() => { _whatIfVersion.value++; });
  _whatIfVersion.value++;
}

/** Route a single per-field edit through the ADT (what-if input, rename). During an active
 *  what-if it edits the overlay; otherwise the committed model. */
export function enterDriverField(field: string, value: number | string): void { _effModel().enter(field, value); }
export function clearDriverField(field: string): void { _effModel().clear(field); }

// driver / driverRaw / driverErrors are EFFECTIVE: they resolve to the what-if overlay when
// one is active, else the committed model. They touch both version refs so they re-derive on
// a committed edit, a what-if edit, or an overlay start/keep/cancel.
export const driver = computed<Driver | null>(() => {
  void _version.value; void _whatIfVersion.value;
  return _effModel().toDriver();
});
// driverRaw: the entered bag back out (E fields + carried metadata) — the DriverRaw view
// the rest of the UI reads. Computed values (Cms/Mms/Bl) are NOT in it; read `driver` for
// those. Replaces the old plain state.driverRaw reactive object.
export const driverRaw = computed<DriverRaw>(() => {
  void _version.value; void _whatIfVersion.value;
  return _effModel().raw();
});
// driverJSON: the full ADT state (marks + carried fields + ParState) for persistence. This is
// COMMITTED-only (never the what-if overlay) so a live what-if is not persisted and does not
// move the ground fingerprint — the modified state stays isolated from the what-if.
export const driverJSON = computed<DriverJSON>(() => {
  void _version.value;
  return _model.toJSON();
});
export const driverErrors = computed<DriverError[]>(() => {
  void _version.value; void _whatIfVersion.value;
  return _effModel().errors();
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
  // the sweep would never re-run (CLASSIC-SKIN-review.md #1). Mirrors pinCompare's snapshot.
  p.filters = state.P.filters.map(f => ({ ...f }));
  if (state.box === 'vented' || state.box === 'bandpass4') {
    p.Sp   = Math.PI * (state.P.ventD / 2) ** 2;
    p.Leff = state.P.ventL + state.P.endCorrection * state.P.ventD;
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
  const sw = _curves.value;
  if (!sw) return [];
  // classifyFinite: a singularity made the curve undrawable. classifyFlatClamp: force-flat
  // ran out of allowed boost, so the "flat" response is not flat below some frequency —
  // a truncated inverse filter must never look like a design that flattens for free.
  return [classifyFinite(sw), classifyFlatClamp(sw)].filter((e): e is DriverError => e !== null);
});

// The full issue list the UI shows: driver-derivation issues + sweep-finiteness issues.
export const allIssues = computed<DriverError[]>(() => [...driverErrors.value, ...curveIssues.value]);

// ---- Project state: ground ↔ modified layer (STATE_MODEL.md) ----------------------
// A project fingerprint captures the whole design (box + params + driver). "Ground" is
// the last loaded/saved fingerprint; the project is "modified" when the live design
// differs from it. This is the ground↔modified layer of STATE_MODEL.md; the what-if/edit
// priorityState proxy layers are built on top of it separately. Additive — components keep
// reading state.P/state.box directly; this only observes and can restore them.
function projectFingerprint(): string {
  // Order-deterministic: state.P keeps its P_DEFAULTS key order and the ADT's toJSON()
  // preserves input insertion order, so JSON.stringify yields a stable string to diff.
  return JSON.stringify({ box: state.box, P: state.P, driver: driverJSON.value, project: state.project });
}
export const _ground = getOrInit('_ground', () => ref(projectFingerprint()));
/** True when the live design differs from the last loaded/saved (ground) state. */
export const isModified = computed<boolean>(() => _ground.value !== projectFingerprint());
/** Adopt the current design as ground (call after load, and after a successful save). */
export function markProjectSaved(): void { _ground.value = projectFingerprint(); }
/** Discard unsaved changes: restore the design to the ground state. */
export function resetProjectToGround(): void {
  const g = JSON.parse(_ground.value) as { box: BoxType; P: UiParams; driver: DriverJSON; project?: any };
  state.box = g.box;
  Object.assign(state.P, g.P);
  setDriverFromSerialized(g.driver);
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
  Object.assign(state.P, { ...P_DEFAULTS, filters: [] });   // fresh filters array, not the shared default ref
  state.compare = [];
  state.driverSource = null;
  state.yRanges = {};
  state.project = { name: '', creator: '', created: '', modified: '', description: '' }; // blank meta
  setDriverFromRaw(DEFAULT_DRIVER);
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
  if (o.driver) setDriverFromSerialized(o.driver);
  if (o.box) state.box = o.box;
  if (o.P) Object.assign(state.P, o.P);
  if (Array.isArray(o.graphs) && o.graphs.length) state.graphs = o.graphs;
  if (Array.isArray(o.compare)) state.compare = o.compare.map(restoreCompare);
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
function restoreCompare(d: SerializedState['compare'][number]): Design {
  const design: Design = { ...d, curves: null, maxCurves: null };
  if (design.driver) {
    design.curves    = sweep(design.driver, design.box, design.P);
    design.maxCurves = maxCurves(design.driver, design.box, design.P);
  }
  return design;
}

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
 * WinISD/gyrator circuit-model switch already selects (WINISD.md §9), so the Advanced
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

export function driverShort(raw: DriverRaw | null | undefined): string {
  return ((raw?.name) || [raw?.brand, raw?.model].filter(Boolean).join(' ') || 'Driver')
    .replace(/\.wdr$/i, '');
}

/**
 * Copy the current project into the projects list, overlaying its curves for comparison —
 * WinISD's right-click Copy. The copy is named after the PROJECT ("Copy of glob"), not after
 * the driver: a copy is a copy of what you are working on, and the projects list has to read
 * as a list of projects. An unnamed project falls back to its driver so the row is never blank.
 */
export function pinCompare(): void {
  if (!driver.value) return;
  const p = { ...syncedP.value };
  p.filters = (p.filters || []).map(f => ({ ...f }));  // snapshot; isolate from future edits
  const d: Design = {
    driver: driver.value,
    box:    state.box,
    P:      p,
    curves: null,
    maxCurves: null,
    name:   uniqueName(copyOfName(state.project.name || driverShort(driverRaw.value)),
                       state.compare.map(c => c.name ?? '')),
    color:  DPAL[(state.compare.length + 1) % DPAL.length],
    project: { ...state.project },
    _ground: _ground.value,
    isModified: isModified.value,
  };
  d.curves    = sweep(d.driver!, d.box, d.P);
  d.maxCurves = maxCurves(d.driver!, d.box, d.P);
  state.compare.push(d);
}

export function openProjectAdditive(snapshot: SerializedState): void {
  // 1. Save the existing compare overlays in the store
  const savedCompare = [...state.compare];

  // 2. Gather the currently active design we want to retain (skip if pristine/unmodified default)
  const activeDriver = _effModel().toDriver();
  let retainedDesign: Design | null = null;
  const isPristine = !state.project.name && savedCompare.length === 0 && _effModel().raw().brand === 'Samples';
  if (activeDriver && !isPristine) {
    const eg = Math.sqrt((state.P.Pin ?? 1) * (activeDriver.Re ?? 1));
    const p: SyncedParams = { ...state.P, eg };
    p.filters = (state.P.filters || []).map(f => ({ ...f }));
    if (state.box === 'vented' || state.box === 'bandpass4') {
      p.Sp   = Math.PI * (state.P.ventD / 2) ** 2;
      p.Leff = state.P.ventL + state.P.endCorrection * state.P.ventD;
    }
    const driverWithName = {
      ...activeDriver,
      name: driverShort(_effModel().raw())
    };
    retainedDesign = {
      driver: driverWithName,
      box:    state.box,
      P:      p,
      curves: null,
      maxCurves: null,
      name:   state.project.name || driverShort(_effModel().raw()) || 'Driver',
      color:  DPAL[(savedCompare.length + 1) % DPAL.length],
      project: { ...state.project },
      _ground: _ground.value,
      isModified: isModified.value,
    };
    retainedDesign.curves    = sweep(driverWithName, retainedDesign.box, retainedDesign.P);
    retainedDesign.maxCurves = maxCurves(driverWithName, retainedDesign.box, retainedDesign.P);
  }

  // 3. Load the opened project as active (which overwrites state.compare)
  applyState(snapshot);

  // 4. Combine: [retainedDesign, ...savedCompare, ...newly restored snapshot compare overlays]
  const finalCompare = [...state.compare];
  if (retainedDesign) {
    finalCompare.unshift(retainedDesign);
  }
  if (savedCompare.length > 0) {
    finalCompare.splice(retainedDesign ? 1 : 0, 0, ...savedCompare);
  }
  state.compare = finalCompare;
}
