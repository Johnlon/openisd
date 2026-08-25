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
import { reactive, computed, ref, shallowRef, triggerRef, watch, type ComputedRef, type ShallowRef } from 'vue';
import { sweep, maxCurves, classifyFinite, classifyMaxFinite, classifyFlatClamp, validateParams } from '@openisd/engine';
import type { EngineDriver, DriverError, SweepResult, MaxCurvesResult, BoxType } from '@openisd/engine';
import type { SpecField, OpenISDProject, OpenISDProjectMeta, Cell } from '@openisd/model';
import { ManagedProject, toAlignmentKind, fromAlignmentKind } from './managedProject.js';
import type { AppState, SyncedParams } from '../types.js';
import type { UiParams } from '@openisd/model';
import { copyOfName, uniqueName, type ViewSnapshot } from '@openisd/persistence';
import { presentationState, unitToken } from './presentationState.js';
import { resolveAirEnvironment } from './environment.js';
import { parseChartTabId } from './series.js';
import { toDisplay, fromDisplay, displayPrecision, type UnitGroup } from './fields/units.js';
import { getOrInit } from './hmrSingleton.js';
import {
  solveVentGroup, ventSolveSuspended, suspendVentSolve,
} from './useVentGroup.js';
import { solvePrGroup } from './usePrGroup.js';
// Persistence has a SINGLE source of truth: openisd.state (utils/persist.js),
// written by App.vue's watch and restored by loadLocal() on mount. appState.ts does
// not persist — it initialises to defaults; App.vue applies any saved state.

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

/**
 * `ManagedProject` (`logic/managedProject.ts`) is the facade over ground, committed and the
 * edit-or-what-if overlay, and the domain object for ONE project in the registry below.
 *
 * Every read and every write of a project's state goes through it: `.cell()`/`.metaCell()`/
 * `.toEngineDriver()`/`.errors()`/`.snapshot()` to read; `.enter()`/`.clear()`/`.mutate()` to write;
 * `.beginWhatIf()`/`.cancelWhatIf()`/`.isWhatIfActive()` to manage a what-if. `.projectToPersist()`
 * is separate again — it is what anything saved/exported/shared reads, and it never hands out a
 * live what-if: it cancels one first, so nothing unverified can reach disk. The
 * `OpenISDProjectJson` it wraps — and the `OpenISDDriver` inside that — are private to it and
 * never leave.
 *
 * `seedProject` is the one always seeded into the registry below at module load — the app
 * never starts with zero projects open — and is otherwise indistinguishable from any project
 * opened later; nothing about it is special once the app is running.
 */
const seedProject: ManagedProject = getOrInit('appState', '_managed', () => {
  return ManagedProject.createEmpty();
});

/**
 * The multi-project registry (human ruling, 2026-08-18) — replaces `workspace.ts`'s ad-hoc
 * `WorkspaceEntry`/`OpenProject` and `OriginalShell.vue`'s own former local `openProjects`/
 * `activeProjectId` reimplementation as the ONE place "which projects are open, which is
 * focused" lives. `projects[0]` starts as `seedProject` — one project open, matching the
 * app's starting state.
 */
const projects = getOrInit('appState', 'projects', () => shallowRef<ManagedProject[]>([seedProject]));
const focusedIndex = getOrInit('appState', 'focusedIndex', () => ref(0));

/** Every open project. Empty array if none are open. */
export function openProjects(): ManagedProject[] { return projects.value; }

/** The project currently focused in the UI's project list, or null if none are open. */
export function focusedProject(): ManagedProject | null {
  return projects.value[focusedIndex.value] ?? null;
}

/** Move focus to the project at `index` — called when the user changes the active project in
 *  the UI's project list. Out-of-range indices are ignored. */
export function focusProject(index: number): void {
  if (index < 0 || index >= projects.value.length) return;
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
export function addProject(project: ManagedProject): void {
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
export function requireFocusedProject(): ManagedProject {
  const p = focusedProject();
  if (!p) throw new NoFocusedProjectError();
  return p;
}

/** Open a brand-new, blank, independent project tab and focus it — the store is the ONE
 *  logic module licensed to construct a `ManagedProject`
 *  (`architecture.test.ts` "the store is the only logic module that holds the ManagedProject
 *  instance"), so a UI file that wants a new tab calls this rather than importing the class
 *  itself. */
export function openBlankProject(): void {
  addProject(ManagedProject.createEmpty());
}

/** Duplicate the FOCUSED project's committed design into a brand-new, independent tab under
 *  `newName`, and focus it. `ManagedProject.fromProject` makes a genuinely separate copy (its
 *  own ground/committed layers) — editing the copy can never touch the original. Same
 *  construction-licensing reason as `openBlankProject()`. */
export function duplicateFocusedProject(newName: string): void {
  const source = requireFocusedProject();
  // Read BEFORE `addProject()` moves focus to the copy — this is the SOURCE's own ground
  // (lazily seeded if it had none yet).
  const sourceGround = currentGround();
  const copy = ManagedProject.fromProject(source.projectToPersist());
  addProject(copy);
  // A copy has never itself been saved, so it must start "modified" even when duplicating an
  // already-clean source — `newName` never matches `sourceGround`'s own (still-original) name,
  // exactly the property that makes `isModified` read true immediately. Seeding from the
  // source's ground rather than some invented sentinel also means Revert on a still-identical
  // copy is coherent (parses the SAME real fingerprint the source would revert to) instead of
  // risking an unparseable placeholder.
  groundByProject.set(copy, sourceGround);
  copy.mutate(p => p.setProjectMeta({ ...p.projectMeta(), name: newName }));
}

/** A private, read-only source of safe defaults for the handful of module-scope reactive
 *  computeds below (`state.box`, `syncedP`, the sweep scheduler's watch sources) that Vue
 *  evaluates unconditionally on every reactive flush regardless of whether any project is
 *  focused — e.g. right after the last open project is closed. Never registered in
 *  `projects`, never mutated, never exposed: nothing downstream ever reads its values for
 *  real, because the gated UI that would is unmounted whenever `focusedProject()` is null. */
const EMPTY_PROJECT_DEFAULTS: ManagedProject = ManagedProject.createEmpty();

// The one Vue bridge onto WHICHEVER project is currently focused. Re-subscribes on every
// focus change or open/close of a project (the `watch([projects, focusedIndex], ...)` inside
// the initializer below), so every reader touching `live.value` sees the newly focused
// project and re-fires on its own mutations. `live.value` is null exactly when
// `focusedProject()` is null.
// HMR-singleton, same reasoning as the registry itself: the whole subscription+watch setup is
// built once inside the `getOrInit` initializer so hot-reload does not create a second,
// leaked watcher alongside the one that survives via `getOrInit`'s cache.
const live: ShallowRef<ManagedProject | null> = getOrInit('appState', '_live', () => {
  const liveRef = shallowRef<ManagedProject | null>(null);
  let disposeCurrent: (() => void) | null = null;
  function resubscribe(): void {
    if (disposeCurrent) { disposeCurrent(); disposeCurrent = null; }
    const p = projects.value[focusedIndex.value] ?? null;
    liveRef.value = p;
    if (p) disposeCurrent = p.subscribe(() => { triggerRef(liveRef); });
  }
  watch([projects, focusedIndex], resubscribe, { flush: 'sync' });
  resubscribe();
  return liveRef;
});

// `state.project`'s five fields, each an accessor onto the FOCUSED project's own meta — never
// an independent copy. A plain mutable mirror (this file's earlier shape) went stale the
// instant focus moved to a DIFFERENT already-open project via `focusProject()` alone (no load
// call to refresh it), so the Project tab and titlebar kept showing whichever project was
// focused BEFORE the switch — found and fixed while wiring the multi-project registry
// (PROMPT_RELEASE_HARDENING plan). Reads fall back to `EMPTY_PROJECT_DEFAULTS` when nothing is
// focused; writes no-op then (defensive — the gated UI that could write is unmounted).
const PROJECT_META_FIELDS = ['name', 'creator', 'created', 'modified', 'description'] as const;
function buildProjectMetaAccessor(): OpenISDProjectMeta {
  const obj = {} as OpenISDProjectMeta;
  for (const key of PROJECT_META_FIELDS) {
    Object.defineProperty(obj, key, {
      enumerable: true, configurable: true,
      get: () => (focusedProject() ?? EMPTY_PROJECT_DEFAULTS).snapshot().projectMeta()[key],
      set: (v: string) => {
        const p = focusedProject();
        if (!p) return;
        p.mutate(proj => proj.setProjectMeta({ ...proj.projectMeta(), [key]: v }));
      },
    });
  }
  return obj;
}

function buildState(): AppState {
  const s = {};
  const projectMeta = buildProjectMetaAccessor();
  Object.defineProperty(s, 'project', {
    enumerable: true, configurable: true,
    get: () => projectMeta,
    set: (v: OpenISDProjectMeta) => {
      const p = focusedProject();
      if (!p) return;
      p.mutate(proj => proj.setProjectMeta({ ...v }));
    },
  });
  // `box` is an accessor property over the FOCUSED project's own `OpenISDBox.active` — not an
  // independent copy — because every `boxVolume_m3()`/`.ventDiameter_m()`/`.boxTuning_Fb_hz()`/
  // `.prSd_m2()`-family accessor (ledger QO54) picks its storage BY active alignment, so
  // `state.box` must always read the SAME `active` those accessors use, never a second,
  // independently-writable copy of it (packages/ui/test/logic/boxActiveSync.test.ts). Falls
  // back to `EMPTY_PROJECT_DEFAULTS` when nothing is focused (see that constant's own doc) —
  // read-only, never observed by any mounted component. The setter no-ops when unfocused: a
  // write can only be issued by gated UI, so that branch is defensive, not a real path.
  Object.defineProperty(s, 'box', {
    enumerable: true, configurable: true,
    get: () => fromAlignmentKind((focusedProject() ?? EMPTY_PROJECT_DEFAULTS).activeAlignment()),
    set: (v: BoxType) => { focusedProject()?.setActiveAlignment(toAlignmentKind(v)); },
  });
  return s as unknown as AppState;
}

export const state: AppState = getOrInit('appState', 'state', () => reactive(buildState()));

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

if (typeof window !== 'undefined') {
  if (!(window as any).__store_instances) (window as any).__store_instances = [];
  if (!(window as any).__store_instances.includes(state)) {
    (window as any).__store_instances.push(state);
  }
}

/** Route one per-field edit to whichever layer ManagedProject says is effective. */
/** One driver field's value and provenance — dispatch lives here, not as a keyed method on
 *  `ManagedProject` (human ruling 2026-08-24, ENCAPSULATION_AND_LAYERING.md). */
export function driverFieldCell(field: SpecField): Cell {
  const p = requireFocusedProject();
  switch (field) {
    case 'Fs': return p.FsCell();
    case 'Re': return p.ReCell();
    case 'Le': return p.LeCell();
    case 'fLe': return p.fLeCell();
    case 'KLe': return p.KLeCell();
    case 'Znom': return p.ZnomCell();
    case 'Qts': return p.QtsCell();
    case 'Qes': return p.QesCell();
    case 'Qms': return p.QmsCell();
    case 'Vas': return p.VasCell();
    case 'Sd': return p.SdCell();
    case 'BL': return p.BLCell();
    case 'Mms': return p.MmsCell();
    case 'Cms': return p.CmsCell();
    case 'Rms': return p.RmsCell();
    case 'Xmax': return p.XmaxCell();
    case 'Xlim': return p.XlimCell();
    case 'SPL': return p.SPLCell();
    case 'Pe': return p.PeCell();
    case 'Dd': return p.DdCell();
    case 'EBP': return p.EBPCell();
    case 'numVC': return p.numVCCell();
    case 'VCCon': return p.VCConCell();
    case 'Dia': return p.DiaCell();
    case 'Vd': return p.VdCell();
    case 'no': return p.noCell();
    case 'SPLmax': return p.SPLmaxCell();
    case 'SPLmaxLF': return p.SPLmaxLFCell();
    case 'USPL': return p.USPLCell();
    case 'alfaVC': return p.driverAlfaVCCell();
    case 'Rt': return p.RtCell();
    case 'Ct': return p.CtCell();
    case 'gamma': return p.gammaCell();
    case 'Rme': return p.RmeCell();
    case 'Mpow': return p.MpowCell();
    case 'Mcost': return p.McostCell();
    case 'Gloss': return p.GlossCell();
    case 'c': return p.cCell();
    case 'roo': return p.rooCell();
    case 'Vcd': return p.VcdCell();
    case 'Hg': return p.HgCell();
    case 'Hc': return p.HcCell();
    case 'freq_low_hz': return p.freq_low_hzCell();
    case 'freq_high_hz': return p.freq_high_hzCell();
    case 'power_peak_W': return p.power_peak_WCell();
    case 'weight_kg': return p.weight_kgCell();
    case 'Thick': return p.ThickCell();
    case 'Depth': return p.DepthCell();
    case 'MagDepth': return p.MagDepthCell();
    case 'Magnet': return p.MagnetCell();
    case 'Basket': return p.BasketCell();
    case 'Outer': return p.OuterCell();
    case 'OuterX': return p.OuterXCell();
    case 'OuterY': return p.OuterYCell();
    case 'DVol': return p.DVolCell();
  }
}

export function enterDriverField(field: SpecField, value: number): void {
  const p = requireFocusedProject();
  switch (field) {
    case 'Fs': p.enterFs(value); return;
    case 'Re': p.enterRe(value); return;
    case 'Le': p.enterLe(value); return;
    case 'fLe': p.enterFLe(value); return;
    case 'KLe': p.enterKLe(value); return;
    case 'Znom': p.enterZnom(value); return;
    case 'Qts': p.enterQts(value); return;
    case 'Qes': p.enterQes(value); return;
    case 'Qms': p.enterQms(value); return;
    case 'Vas': p.enterVas(value); return;
    case 'Sd': p.enterSd(value); return;
    case 'BL': p.enterBL(value); return;
    case 'Mms': p.enterMms(value); return;
    case 'Cms': p.enterCms(value); return;
    case 'Rms': p.enterRms(value); return;
    case 'Xmax': p.enterXmax(value); return;
    case 'Xlim': p.enterXlim(value); return;
    case 'SPL': p.enterSPL(value); return;
    case 'Pe': p.enterPe(value); return;
    case 'Dd': p.enterDd(value); return;
    case 'EBP': p.enterEBP(value); return;
    case 'numVC': p.enterNumVC(value); return;
    case 'VCCon': p.enterVCCon(value); return;
    case 'Dia': p.enterDia(value); return;
    case 'Vd': p.enterVd(value); return;
    case 'no': p.enterNo(value); return;
    case 'SPLmax': p.enterSPLmax(value); return;
    case 'SPLmaxLF': p.enterSPLmaxLF(value); return;
    case 'USPL': p.enterUSPL(value); return;
    case 'alfaVC': p.enterDriverAlfaVC(value); return;
    case 'Rt': p.enterRt(value); return;
    case 'Ct': p.enterCt(value); return;
    case 'gamma': p.enterGamma(value); return;
    case 'Rme': p.enterRme(value); return;
    case 'Mpow': p.enterMpow(value); return;
    case 'Mcost': p.enterMcost(value); return;
    case 'Gloss': p.enterGloss(value); return;
    case 'c': p.enterC(value); return;
    case 'roo': p.enterRoo(value); return;
    case 'Vcd': p.enterVcd(value); return;
    case 'Hg': p.enterHg(value); return;
    case 'Hc': p.enterHc(value); return;
    case 'freq_low_hz': p.enterFreq_low_hz(value); return;
    case 'freq_high_hz': p.enterFreq_high_hz(value); return;
    case 'power_peak_W': p.enterPower_peak_W(value); return;
    case 'weight_kg': p.enterWeight_kg(value); return;
    case 'Thick': p.enterThick(value); return;
    case 'Depth': p.enterDepth(value); return;
    case 'MagDepth': p.enterMagDepth(value); return;
    case 'Magnet': p.enterMagnet(value); return;
    case 'Basket': p.enterBasket(value); return;
    case 'Outer': p.enterOuter(value); return;
    case 'OuterX': p.enterOuterX(value); return;
    case 'OuterY': p.enterOuterY(value); return;
    case 'DVol': p.enterDVol(value); return;
  }
}
export function clearDriverField(field: SpecField): void {
  const p = requireFocusedProject();
  switch (field) {
    case 'Fs': p.clearFs(); return;
    case 'Re': p.clearRe(); return;
    case 'Le': p.clearLe(); return;
    case 'fLe': p.clearFLe(); return;
    case 'KLe': p.clearKLe(); return;
    case 'Znom': p.clearZnom(); return;
    case 'Qts': p.clearQts(); return;
    case 'Qes': p.clearQes(); return;
    case 'Qms': p.clearQms(); return;
    case 'Vas': p.clearVas(); return;
    case 'Sd': p.clearSd(); return;
    case 'BL': p.clearBL(); return;
    case 'Mms': p.clearMms(); return;
    case 'Cms': p.clearCms(); return;
    case 'Rms': p.clearRms(); return;
    case 'Xmax': p.clearXmax(); return;
    case 'Xlim': p.clearXlim(); return;
    case 'SPL': p.clearSPL(); return;
    case 'Pe': p.clearPe(); return;
    case 'Dd': p.clearDd(); return;
    case 'EBP': p.clearEBP(); return;
    case 'numVC': p.clearNumVC(); return;
    case 'VCCon': p.clearVCCon(); return;
    case 'Dia': p.clearDia(); return;
    case 'Vd': p.clearVd(); return;
    case 'no': p.clearNo(); return;
    case 'SPLmax': p.clearSPLmax(); return;
    case 'SPLmaxLF': p.clearSPLmaxLF(); return;
    case 'USPL': p.clearUSPL(); return;
    case 'alfaVC': p.clearDriverAlfaVC(); return;
    case 'Rt': p.clearRt(); return;
    case 'Ct': p.clearCt(); return;
    case 'gamma': p.clearGamma(); return;
    case 'Rme': p.clearRme(); return;
    case 'Mpow': p.clearMpow(); return;
    case 'Mcost': p.clearMcost(); return;
    case 'Gloss': p.clearGloss(); return;
    case 'c': p.clearC(); return;
    case 'roo': p.clearRoo(); return;
    case 'Vcd': p.clearVcd(); return;
    case 'Hg': p.clearHg(); return;
    case 'Hc': p.clearHc(); return;
    case 'freq_low_hz': p.clearFreq_low_hz(); return;
    case 'freq_high_hz': p.clearFreq_high_hz(); return;
    case 'power_peak_W': p.clearPower_peak_W(); return;
    case 'weight_kg': p.clearWeight_kg(); return;
    case 'Thick': p.clearThick(); return;
    case 'Depth': p.clearDepth(); return;
    case 'MagDepth': p.clearMagDepth(); return;
    case 'Magnet': p.clearMagnet(); return;
    case 'Basket': p.clearBasket(); return;
    case 'Outer': p.clearOuter(); return;
    case 'OuterX': p.clearOuterX(); return;
    case 'OuterY': p.clearOuterY(); return;
    case 'DVol': p.clearDVol(); return;
  }
}

// The resolved, engine-ready driver — EFFECTIVE, so a live what-if is what the charts draw.
// PRIVATE to this file's own sweep; every outside caller reads the focused project's own
// `.toEngineDriver()` directly through `logic/liveProject.ts`'s reactivity adapter instead of
// an appState wrapper. Null when no project is focused (registry empty), same as an
// incomplete driver — nothing to sweep either way.
function engineDriver(): EngineDriver | null {
  void live.value;
  return live.value ? live.value.toEngineDriver() : null;
}

/** The COMMITTED driver as the managed layer's own persisted TEXT — what a save, a share
 *  link, or a ground fingerprint embeds. Never the record value: the UI carries only this
 *  serialisation (QO73). Cancels an active what-if (the managed method's own structural
 *  guard). Always a real string for a focused project: a project cannot exist without a
 *  driver (`docs/design/DRIVER_NON_NULL_INVARIANT.md`) — an unfilled one still serialises. ''
 *  when no project is focused — there is no project to have a driver. */
export const persistedDriver: ComputedRef<string> =
  computed(() => { void live.value; return live.value ? live.value.persistedDriverText() : ''; });

/** What this driver is CALLED — brand and model as the record states them, from the EFFECTIVE
 *  driver. '' when nothing names it (no driver chosen, or no project focused), so a caller can
 *  fall back. */
export const driverName = computed<string>(() => {
  void live.value;
  if (!live.value) return '';
  return [live.value.brand(), live.value.model()]
    .filter(x => x.length > 0).join(' ').trim();
});

/**
 * Open the driver picker — the ONE governed entry point. Cancels any active what-if first: an
 * uncommitted preview must never be left dangling once the user has moved on to picking a
 * different driver. Every "Select Driver"/"Browse…" trigger calls this, never a raw
 * `presentationState.browseOpen = true`. ManagedProject owns the cancellation; this only asks
 * for it. No-ops when no project is focused — there is nothing to pick a driver for.
 */
export function openDriverPicker(): void {
  const p = focusedProject();
  if (!p) return;
  if (p.isWhatIfActive()) { p.cancelWhatIf(); presentationState.editDriver = false; }
  presentationState.browseOpen = true;
}

function driverErrors(): DriverError[] {
  void live.value;
  return live.value ? live.value.errors() : [];
}

export const syncedP = computed<SyncedParams>(() => {
  // The dependency: `toUiParams()`/`driveVoltage_V()` read the effective project directly and
  // touch no Vue ref themselves (`ManagedProject` stays framework-free), so this computed
  // re-derives on every project mutation via `live`, the same bridge every other read in
  // this file uses. Falls back to `EMPTY_PROJECT_DEFAULTS` when nothing is focused — Vue
  // evaluates this computed's sources unconditionally as part of the sweep-scheduler watch
  // below even while the gate hides the UI that would otherwise read it.
  void live.value;
  const src = live.value ?? EMPTY_PROJECT_DEFAULTS;
  const p: SyncedParams = { ...src.toUiParams(), eg: src.driveVoltage_V() };
  if (state.box === 'vented' || state.box === 'bandpass4') {
    p.Sp = src.ventArea_m2();
    p.Leff = src.ventEffectiveLength_m();
  }
  // The WinISD toggle swaps the PROJECT's humidity/pressure for the app-level Options
  // environment before the engine sees them (resolveAirEnvironment's docstring) — sweep and
  // readouts honour the toggle identically. Persistence is untouched: the autosave/share
  // writers read `toUiParams()` directly, so a saved project keeps its own environment.
  return resolveAirEnvironment(p, presentationState.ui.envDefaults);
});

const curves = getOrInit('appState', 'curves', () => ref<SweepResult | null>(null));
const max    = getOrInit('appState', 'max', () => ref<MaxCurvesResult | null>(null));
const doSweep = () => {
  const d = engineDriver();
  curves.value = d ? sweep(d, state.box, syncedP.value) : null;
  max.value    = d ? maxCurves(d, state.box, syncedP.value) : null;
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
watch([engineDriver, syncedP, () => state.box], scheduleSweep);
export const curvesData = curves;
export const maxData    = max;

// Postcondition (hardening): a valid driver can still yield a non-finite sweep at
// some frequency (a numerical singularity the input guards can't foresee). Classify
// the sweep output so it's never a silently blank chart — surfaced through the same
// issue channel as deriveEngineDriver's errors. Empty when the driver is invalid (no sweep)
// or the sweep is clean.
const curveIssues = computed<DriverError[]>(() => {
  const sw = curves.value, mx = max.value;
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
// Validated at the same appState boundary, from the same params the sweep is actually run on.
export const paramIssues = computed<DriverError[]>(() => validateParams(state.box, syncedP.value));

// The full issue list the UI shows: driver-derivation issues + box-parameter issues +
// sweep/max-curve finiteness issues.
export const allIssues = computed<DriverError[]>(
  () => [...driverErrors(), ...paramIssues.value, ...curveIssues.value]);

// ---- Project state: ground ↔ modified layer (docs/design/STATE_MODEL.md) ----------------------
// A project fingerprint captures the whole design (box + params + driver). "Ground" is
// the last loaded/saved fingerprint; the project is "modified" when the live design
// differs from it. This is the ground↔committed layer of docs/design/STATE_MODEL.md; the what-if/edit
// priorityState proxy layers are built on top of it separately. Additive — components keep
// reading state.box/the focused project directly; this only observes and can restore them.
function projectFingerprint(): string {
  // Order-deterministic: toUiParams() gathers fields in the same fixed order on every call,
  // and the ADT's toJSON() preserves input insertion order, so JSON.stringify yields a stable
  // string to diff.
  const src = live.value ?? EMPTY_PROJECT_DEFAULTS;
  return JSON.stringify({
    box: state.box, P: src.toUiParams(), driver: persistedDriver.value, project: state.project,
  });
}
// One ground checkpoint PER open project (keyed by instance identity), not one shared string —
// each `ManagedProject` in the registry is independently live, so switching focus must never
// overwrite another project's ground.
const groundByProject = getOrInit('appState', 'groundByProject', () => new WeakMap<ManagedProject, string>());
function currentGround(): string {
  const p = focusedProject();
  if (!p) return '';
  const g = groundByProject.get(p);
  if (g !== undefined) return g;
  const fresh = projectFingerprint();
  groundByProject.set(p, fresh);
  return fresh;
}
/** True when the live design differs from the last loaded/saved (ground) state. False when no
 *  project is focused — nothing is "modified" if nothing is open. */
export const isModified = computed<boolean>(() => {
  void live.value;
  return focusedProject() !== null && currentGround() !== projectFingerprint();
});
/** Adopt the current design as ground (call after load, and after a successful save). No-ops
 *  when no project is focused. */
export function markProjectSaved(): void {
  const p = focusedProject();
  if (!p) return;
  groundByProject.set(p, projectFingerprint());
}
/** Discard unsaved changes: restore the focused project's design to its ground state. */
export function resetProjectToGround(): void {
  const p = requireFocusedProject();
  const g = JSON.parse(currentGround()) as { box: BoxType; P: UiParams; driver: string; project?: any };
  // Adopt the stored params verbatim. The ground snapshot already holds BOTH vent-group
  // members and the entered set, so there is nothing to re-solve — and re-solving is exactly
  // what breaks "Cancel means byte-identical" (docs/design/STATE_MODEL.md rule 3): the solver would
  // reproduce the calculated member from a value that was rounded on its way through JSON
  // and land on a different double. `loadUiParams` sets the active alignment itself, so this
  // is the one call that lands box + every vent/PR/plain field together.
  suspendVentSolve(() => p.loadUiParams(g.P, toAlignmentKind(g.box)));
  restoreProblems.value = [];
  // A refusal is REPORTED, never swallowed: dropping it would leave the previous driver in
  // place while the UI showed a successful discard-changes. `g.driver` is always present — a
  // ground checkpoint is a fingerprint of a live project, and a project cannot exist without
  // a driver (docs/design/DRIVER_NON_NULL_INVARIANT.md).
  const problems = p.loadDriverFromPersistedText(g.driver);
  if (problems.length) {
    restoreProblems.value = problems.map(msg => `the checkpoint's driver was not restored: ${msg}`);
    console.error(`[reset] refused the checkpoint's driver record — ${problems.join('; ')}`);
  }
  if (g.project) {
    Object.assign(state.project, g.project);
  }
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
  if (!focusedProject()) addProject(ManagedProject.createEmpty());
  const p = requireFocusedProject();
  p.loadEmpty();                                              // an unfilled driver — the user picks one
  // AFTER loadEmpty(), not before: loadEmpty() replaces the whole design (`ManagedProject.
  // load()`), which would silently wipe a meta write made ahead of it — `state.project` is now
  // a live accessor onto the focused project's own meta, not an independent bag a caller could
  // pre-fill and have survive a subsequent full reset.
  state.project = { name: spec?.name ?? '', creator: '', created: '', modified: '', description: '' }; // blank meta
  if (spec) {
    state.box = spec.box;
    p.setBoxVolume_m3(fromDisplay(spec.volumeL, 'volume', 'L'));
    if (spec.frontVolumeL != null) p.setFrontVolume_m3(fromDisplay(spec.frontVolumeL, 'volume', 'L'));
  }
  markProjectSaved();                                       // the fresh design is the new clean ground
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

/** The open design, as the domain object every save/share door persists — the managed layer's
 *  own persist-safe copy (`projectToPersist()`, which cancels an active what-if itself). No
 *  field is re-gathered by hand: `OpenISDProject` already IS params + box + meta + driver
 *  together, so a second, parallel struct duplicating those fields would be a second answer to
 *  the same question. */
export function currentProject(): OpenISDProject {
  return requireFocusedProject().projectToPersist();
}

/** The FOCUSED project's committed snapshot, reactively — what App.vue's autosave watcher
 *  reads (never `currentProject()`/`projectToPersist()`, which cancels an active what-if as a
 *  side effect: correct for an explicit save/export/share action, wrong for a getter re-run on
 *  every reactive tick, `BUG_20260825_whatif_destroyed_by_autosave_watcher.md`). Null when no
 *  project is focused — nothing to autosave. */
export const committedSnapshot = computed<OpenISDProject | null>(() => {
  void live.value;
  return live.value ? live.value.committedSnapshot() : null;
});

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
 * (`ManagedProject.load()`). The pure-project load doors (`loadLocal`/`readProjectText`,
 * QO90) call this; the view is restored separately, from its own storage key, by
 * `applyViewSnapshot()`.
 *
 * Old-schema repair (a pre-vent-group save with no `ventShape`/`ventW`/`ventH`/`entered`) and
 * driver-record conformance checking (a bad record refused rather than crashing the whole
 * load, quarantined so an autosave cannot overwrite the evidence) already happened at the repo
 * boundary (`@openisd/persistence`'s `projectRepo.ts`) that produced `project` — this only
 * adopts the result.
 *
 * Every load path must land the WHOLE project: a second, hand-rolled subset loader is how
 * File → Open… silently dropped the project name, the comparison overlays and the graph
 * cursor while appearing to succeed. `project-load-gate.test.ts` fails the suite if a field
 * `currentProject()` carries is not restored here.
 */
export function applyLoadedProject(project: OpenISDProject): void {
  // `suspendVentSolve`: a restore must land byte-identical (`docs/design/STATE_MODEL.md` rule
  // 3), and `.load()` notifies — which would otherwise let the reactive vent-group watcher
  // re-solve a member the load already set, landing a rounded-through-JSON double instead of
  // the persisted one. Lands on WHICHEVER project is currently focused — every load-path
  // caller (`App.vue`'s hash/local restore, `OriginalShell.vue`'s File → Open, which opens a
  // fresh tab first) already ensures a project is focused before calling this.
  const p = requireFocusedProject();
  suspendVentSolve(() => p.load(project));
  // No further meta write needed: `p.load(project)` already landed `project`'s own meta on
  // the domain object, and `state.project` (an accessor onto the focused project, not an
  // independent copy) already reads it straight through.
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
 *  pure-project doors (`loadLocal`/`readProjectText`) call `applyLoadedProject()` alone. */
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
  get: () => { void live.value; return live.value?.circuitModel() === 'gyrator'; },
  set: (on) => { focusedProject()?.setCircuitModel(on ? 'gyrator' : 'winisd'); },
});



