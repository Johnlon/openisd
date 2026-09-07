/**
 * `presentationState.ts` — PRESENTATION state: which dialog/panel is open, chart cursor and
 * selection, per-chart display prefs (ARCHITECTURE.md §"Approved state stores — there are
 * THREE, and no others"). It holds no domain value: `box`, driver, box/vent/PR fields, project
 * metadata and every other design input live on `managedProject`/`appState.ts` and are read
 * through them, never copied here.
 *
 * Same singleton-survives-HMR shape as `appState.ts`'s own `state` — a Vite hot-reload re-runs
 * this module's top-level code, and a fresh `reactive()` on every reload would orphan every
 * other module's already-captured reference to the old one.
 */
import { reactive } from 'vue';
import type { ChartTabId, DragRange, YRange } from '../types.js';
import { getOrInit, hmrSlots } from './hmrSingleton.js';
import { nextToken, type UnitGroup } from './fields/units.js';

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
  envDefaults: { tempK: number; pressurePa: number; humidityPct: number };
  chartColors?: ChartColors;
  originalChartTab?: string;
  originalChartLabel?: string;
}

export const AIR_CONSTANTS_APP_DEFAULT: UiState['envDefaults'] =
  { tempK: 293.15, pressurePa: 101325.0, humidityPct: 30.0 };

export interface PresentationState {
  /** The Browse Drivers modal is open. */
  browseOpen: boolean;
  /** The Tune panel is open. */
  editDriver: boolean;
  /** The Driver Editor modal (Brand/Model/Comment/Provided by) is open. */
  editDriverInfo: boolean;
  cursorF: number | null;
  pinnedF: number | null;
  cursorLocked: boolean;
  dragRange: DragRange | null;
  /** Per-chart Y-axis override; absent entry = auto-scale. */
  yRanges: Record<string, YRange>;
  graphs: ChartTabId[];
  /** Sealed-box loss model select (WinISD Advanced pane). A DISPLAY selection: it feeds only
   *  the Fsc/Qtc readout the box panel shows (`ManagedOpenISDProject.sealedResonance()`),
   *  never the engine sweep itself. */
  lossMode: string;
  ui: UiState;
}

function buildPresentationState(): PresentationState {
  const s: PresentationState = {
    browseOpen: false,
    editDriver: false,
    editDriverInfo: false,
    cursorF: null,
    pinnedF: null,
    cursorLocked: false,
    dragRange: null,
    yRanges: {},
    graphs: ['SPL', 'Excursion', 'Zmag', 'GD'],
    lossMode: 'winisd-lossy',
    ui: {
      unitTokens: {},
      envDefaults: { ...AIR_CONSTANTS_APP_DEFAULT },
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

/** A fresh copy of AIR_CONSTANTS_APP_DEFAULT — used both to seed presentationState's own initial
 *  ui.envDefaults and by the Options dialog's Environment reset button. Returns a new object
 *  each call so callers can freely mutate their copy (e.g. a modal's draft) without aliasing
 *  the constant. */
export function airConstantsAppDefaults(): UiState['envDefaults'] {
  return { ...AIR_CONSTANTS_APP_DEFAULT };
}
