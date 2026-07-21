import { reactive, computed, ref, shallowRef, watch } from 'vue';
import { sweep, maxCurves, classifyFinite } from '@openisd/engine';
import type { Driver, DriverRaw, DriverError, SweepResult, MaxCurvesResult, BoxType } from '@openisd/engine';
import { Driver as DriverModel, type DriverJSON } from '@openisd/winisd';
import { DPAL } from './presets.js';
import type { AppState, UiParams, SyncedParams, Design } from './types.js';

// The app's default driver on first open (no saved selection) and the target of the
// "Reset to demo" button. Mirrors drivers/demos/demo-generic-6.5in-woofer.wdr.
export const DEFAULT_DRIVER: DriverRaw = { name: 'Demo - Generic 6.5" Woofer', brand: 'Demo', model: 'Generic 6.5" Woofer', Fs:37, Qts:0.378, Qes:0.40, Qms:7.0, Vas:0.0300, Sd:0.0133, Re:5.6, Le:0.70e-3, Xmax:0.0050, Pe:60, Z:8 };

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
};

// Persistence has a SINGLE source of truth: openisd.state (utils/persist.js),
// written by App.vue's watch and restored by loadLocal() on mount. store.js does
// not persist — it initialises to defaults; App.vue applies any saved state.
export const state: AppState = reactive({
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
  ui:           { skin: 'auto' },  // local-only presentation preference; never shared (persist.ts)
  project:      { name: '', creator: '', created: '', modified: '', description: '' },
});


// The store's single source of truth for the driver is a long-lived Driver ADT instance
// (@openisd/winisd). It owns E/C/N provenance and every derivation. Its framework-free
// subscribe() is bridged to Vue through _version: every enter/clear and every instance
// swap bumps _version, and the computeds below touch it so they re-derive. winisd stays
// Vue-free — the arrow points up (ui → winisd), never down.
const _version = ref(0);
let _model  = DriverModel.fromRaw(DEFAULT_DRIVER);
let _unsub  = _model.subscribe(() => { _version.value++; });

/** The current Driver ADT instance — call enter/clear/toWdr on it directly. */
export function getDriverModel(): DriverModel { return _model; }

// Swap the held instance (load / import / reset). Re-bridge reactivity and bump once.
function setModel(m: DriverModel): void {
  _unsub();
  _model = m;
  _unsub = _model.subscribe(() => { _version.value++; });
  _version.value++;
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
const _whatIf       = shallowRef<DriverModel | null>(null);
const _whatIfVersion = ref(0);
let _whatIfUnsub: (() => void) | null = null;
function _effModel(): DriverModel { return _whatIf.value ?? _model; }

/** Begin a driver what-if: overlay a live copy of the committed model. Idempotent. */
export function startDriverWhatIf(): void {
  if (_whatIf.value) return;
  const m = DriverModel.fromJSON(_model.toJSON());   // deep copy of the committed driver
  _whatIfUnsub = m.subscribe(() => { _whatIfVersion.value++; });
  _whatIf.value = m;
  _whatIfVersion.value++;
}
function _clearWhatIf(): void {
  if (_whatIfUnsub) { _whatIfUnsub(); _whatIfUnsub = null; }
  _whatIf.value = null;
  _whatIfVersion.value++;
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

const _curves = ref<SweepResult | null>(null);
const _max    = ref<MaxCurvesResult | null>(null);
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
  const issue = classifyFinite(sw);
  return issue ? [issue] : [];
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
  return JSON.stringify({ box: state.box, P: state.P, driver: driverJSON.value });
}
const _ground = ref(projectFingerprint());
/** True when the live design differs from the last loaded/saved (ground) state. */
export const isModified = computed<boolean>(() => _ground.value !== projectFingerprint());
/** Adopt the current design as ground (call after load, and after a successful save). */
export function markProjectSaved(): void { _ground.value = projectFingerprint(); }
/** Discard unsaved changes: restore the design to the ground state. */
export function resetProjectToGround(): void {
  const g = JSON.parse(_ground.value) as { box: BoxType; P: UiParams; driver: DriverJSON };
  state.box = g.box;
  Object.assign(state.P, g.P);
  setDriverFromSerialized(g.driver);
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

export function driverShort(raw: DriverRaw | null | undefined): string {
  return ((raw?.name) || [raw?.brand, raw?.model].filter(Boolean).join(' ') || 'Driver')
    .replace(/\.wdr$/i, '');
}

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
    name:   driverShort(driverRaw.value) + ' (' + state.box + ' ' + (p.Vb * 1000).toFixed(0) + 'L)',
    color:  DPAL[(state.compare.length + 1) % DPAL.length],
  };
  d.curves    = sweep(d.driver!, d.box, d.P);
  d.maxCurves = maxCurves(d.driver!, d.box, d.P);
  state.compare.push(d);
}
