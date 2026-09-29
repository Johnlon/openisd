/**
 * `presentationState.ts` — PRESENTATION state: which dialog/panel is open, per-chart Y-axis
 * zoom, unit/env/colour preferences (ARCHITECTURE.md §"Approved state stores — there are
 * THREE, and no others"). It holds no domain value: `box`, driver, box/vent/PR fields, project
 * metadata and every other design input live on `managedProject`/`appState.ts` and are read
 * through them, never copied here.
 *
 * The graph cursor (crosshair/pinned/locked/drag-band), open charts (`graphs`) and the sealed
 * loss-model select (`lossMode`) used to live here — QO130 made them PROJECT-scoped instead (two
 * open projects must not share one cursor), so they moved onto `OpenISDProject` itself
 * (`.cursorF`/`.pinnedF`/`.cursorLocked`/`.dragRange`/`.graphs`/`.lossMode`). The cursor fields
 * went further under QO168: a documented exception in
 * `architecture-project-has-three-fields.test.ts`, never serialized anywhere.
 *
 * Same singleton-survives-HMR shape as `appState.ts`'s own `state` — a Vite hot-reload re-runs
 * this module's top-level code, and a fresh `reactive()` on every reload would orphan every
 * other module's already-captured reference to the old one.
 */
import {reactive} from 'vue';
import type {YRange} from '../types.js';
import type {ChartId} from '@openisd/design/engine';
import {getOrInit, hmrSlots} from './hmrSingleton.js';
import {nextToken} from './fields/units.js';
import {type UnitGroup} from '@openisd/design/fields';
import type {OpenISDProject} from '@openisd/design';

/** The palette `assignTraceColor`/`cycleTraceColor` draw from — one project's own
 *  legend/line colour, distinct from `ChartColors`' background/axis overrides below. */
const TRACE_PALETTE = ['#c9c92e', '#e34b4b', '#3a7bd5', '#2e8b57', '#c23bc2', '#2ec9c9', '#e08a2e'];

/** A user-chosen colour override for one chart element; absent key = default colour
 *  (`OptionsModal.vue`'s "Plot Window" tab). */
export interface ChartColors {
  background?: string;
  otherLines?: string;
  labels?: string;
  xmaxLimit?: string;
  cursor?: string;
  [key: string]: string | undefined;
}

/** Shape of `ViewSnapshot.ui` (`@openisd/persistence`'s `ui: Record<string, unknown>`) that
 *  this module actually reads and writes. */
interface UiState {
  [key: string]: unknown;
  username?: string;
  unitTokens?: Record<string, string>;
  chartColors?: ChartColors;
  /** Charts stacked to the chart area's height, Original skin (`CHARTS_HIGH_OPTIONS`). Absent
   *  means `ORIGINAL_CHARTS_HIGH`. */
  originalChartsHigh?: number;
  /** Charts stacked to the chart area's height, Mobile skin. Absent means `MOBILE_CHARTS_HIGH`. */
  mobileChartsHigh?: number;
  /** The splash has been shown and dismissed once — it opens itself only for a visitor whose
   *  stored view carries nothing (`SplashModal-hooks.ts`). */
  splashSeen?: boolean;
  /** Manual, persisted skin choice from the Info menu. Absent means "follow the viewport" —
   *  `App.vue`'s `activeSkin` falls back to `narrowViewport` below. */
  skinOverride?: 'original' | 'mobile';
}

export interface PresentationState {
  /** The New Project wizard is open. Lives here, not on a shell, because the empty-state
   *  screen (no project open) also needs to open it and the shell is inside the null gate. */
  newProjectOpen: boolean;
  /** The Browse Drivers modal is open. */
  browseOpen: boolean;
  /** The Tune panel is open. */
  editDriver: boolean;
  /** The Driver Editor modal (Brand/Model/Comment/Provided by) is open. */
  editDriverInfo: boolean;
  /** Per-chart Y-axis override; absent entry = auto-scale. Keyed by the chart, so a row in
   *  the Options dialog cannot write under a key no chart reads. */
  yRanges: Partial<Record<ChartId, YRange>>;
  /** The swept frequency range every chart panel draws over — global, shared across every open
   *  project (John 2026-09-24: was per-project via `sweepFmin_hz`/`sweepFmax_hz`, but a
   *  project's chart zoom has no business surviving a switch to another project). It is also the
   *  sweep's own frequency grid (`syncedP` → `p.sweep`). Saved with the view state
   *  (`currentViewSnapshot`), like `yRanges`. */
  sweepRange: {min: number; max: number};
  /** Live `matchMedia` read of the mobile-skin breakpoint (`logic/viewport.ts`), seeded
   *  synchronously by `App.vue` before its first render and kept live thereafter. NOT part of
   *  `ui` and never persisted: it is an observation of the current device, not a choice — a
   *  device that used to be narrow must not stay "mobile" after `viewStateRepo` replays an old
   *  session on a different, wider screen. */
  narrowViewport: boolean;
  ui: UiState;
}

function buildPresentationState(): PresentationState {
  const s: PresentationState = {
    newProjectOpen: false,
    browseOpen: false,
    editDriver: false,
    editDriverInfo: false,
    yRanges: {},
    sweepRange: {min: 10, max: 20000},
    narrowViewport: false,
    ui: {
      unitTokens: {},
    },
  };
  return s;
}

/** This module's hot-reload-surviving singletons, one typed member each (`hmrSingleton.ts`). */
interface PresentationSingletons {
  state: PresentationState;
}
declare global {
  var __openisd_presentationState: Partial<PresentationSingletons> | undefined;
}
const slots = hmrSlots<PresentationSingletons>(
  () => globalThis.__openisd_presentationState,
  s => { globalThis.__openisd_presentationState = s; },
);

export const presentationState: PresentationState =
  getOrInit(slots, 'state', () => reactive(buildPresentationState()));

/** The project's own trace/legend colour, saved in its project file (`OpenISDProject.traceColor`),
 *  or the palette's first entry if `assignTraceColor` has never run for it (defensive default
 *  only — every project entering the open-project registry gets one assigned). */
export function traceColor(project: OpenISDProject): string {
  return project.traceColor.value ?? TRACE_PALETTE[0];
}

/** Give `project` its own trace colour if it has none saved: the first palette entry not already
 *  taken by one of `open`. Called once, when a project enters the open-project registry
 *  (`appState.ts`'s `addProject`/`restoreProjects`) — never recomputed from list position
 *  after that. A no-op if the project already carries one. */
export function assignTraceColor(project: OpenISDProject, open: readonly OpenISDProject[]): void {
  if (project.traceColor.value !== null) return;
  const taken = new Set(open.map(p => p.traceColor.value).filter((c): c is string => c !== null));
  project.traceColor.set(TRACE_PALETTE.find(c => !taken.has(c)) ?? TRACE_PALETTE[open.length % TRACE_PALETTE.length]);
}

/** Advance `project`'s own trace colour to the next palette entry — the toolbar's "Color" button. */
export function cycleTraceColor(project: OpenISDProject): void {
  const idx = TRACE_PALETTE.indexOf(traceColor(project));
  project.traceColor.set(TRACE_PALETTE[(idx + 1) % TRACE_PALETTE.length]);
}

// ---- Per-field display units (fields/units.ts) ------------------------------------
// The design store stays SI; these only choose how a field is shown/entered. A shell pairs a
// NumInput (or a calculated readout) with a <UnitToggle> that cycles the field's token; both
// read the token here so they agree. Keyed by field id, so the same quantity shown in more
// than one place shares one selected unit. `baseToken` is the field's own default unit (its
// historic display unit) used until the user rotates it.
/** The field's currently-selected unit token (its base unit until rotated). */
export function unitToken(field: string, baseToken: string): string {
  return presentationState.ui.unitTokens?.[field] ?? baseToken;
}
/** Rotate a field's unit to the next token in its group (persisted, survives refresh). */
export function cycleUnitToken(field: string, group: UnitGroup, baseToken: string): void {
  if (!presentationState.ui.unitTokens) presentationState.ui.unitTokens = {};
  presentationState.ui.unitTokens[field] = nextToken(group, unitToken(field, baseToken));
}
/** Reset every field's display unit back to its own default (undoes all unit toggling app-wide
 *  — cm/L/g/Hz/K/Pa etc., whatever each field's `base` prop is), in one action. Does not touch
 *  the design itself — this only affects how values are DISPLAYED, never the stored (SI) design. */
export function resetUnitTokens(): void {
  presentationState.ui.unitTokens = {};
}

// ---- Skin choice (manual, persisted half — see `narrowViewport` above for the automatic half) ----
/** Set (or, with `null`, clear) the manual skin override. `null` deletes the key rather than
 *  storing a literal `null`, so a cleared override round-trips through `viewStateRepo` as
 *  "absent" — the same state a visitor who never touched the toggle is in. */
export function setSkinOverride(skin: 'original' | 'mobile' | null): void {
  if (skin === null) delete presentationState.ui.skinOverride;
  else presentationState.ui.skinOverride = skin;
}
