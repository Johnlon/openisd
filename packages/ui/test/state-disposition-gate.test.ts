/**
 * MECHANICAL GATE — every AppState field has an explicit persistence disposition
 * (POST_MORTEM 2026-07-23).
 *
 * Class of faults prevented: a user-visible piece of state is added to the store but never
 * classified for persistence, so it silently drops out of local saves and share links
 * (the `dragRange` band-selection bug: the shared link reproduced the pinned cursor but
 * not the dragged frequency selection, because serialize() is a hand-maintained list that
 * had no parity check against AppState).
 *
 * The contract: every top-level key of the live `state` object is EITHER
 *   - carried by serialize() (directly, or via a documented mapping like cursor.*), OR
 *   - named in TRANSIENT below with the reason it is deliberately not persisted.
 * Adding a state field without deciding fails this test — the decision becomes mandatory.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { serialize } from '../src/utils/persist.js';
import type { AppState } from '../src/types.js';

beforeAll(() => {
  // store.ts touches matchMedia/localStorage at import time in some skins' helpers.
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }));
});
afterAll(() => vi.unstubAllGlobals());

// Keys serialize() carries under a DIFFERENT name — the mapping is the documentation.
const MAPPED: Record<string, string> = {
  cursorF: 'cursor.f',
  pinnedF: 'cursor.pinnedF',
  cursorLocked: 'cursor.locked',
  dragRange: 'cursor.range',
};

// Deliberately transient state — each entry needs a reason, and BACKLOG.md's persistence
// model (R1/R2) is the authority for what belongs here.
const TRANSIENT: Record<string, string> = {
  editDriver: 'open-editor flag — carried inside ui (originalTuneOpen/originalEditorOpen), not top-level',
  editDriverInfo: 'open-editor flag — same as editDriver',
  browseOpen: 'modal open flag — a share link should not open the driver browser',
  defineOpen: 'modal open flag — same as browseOpen',
  driverSource: 'reset-to-library snapshot — session working state, reconstructible',
  yRanges: 'per-chart Y-zoom — deliberately transient (BACKLOG persistence model)',
};

describe('mechanical gate — AppState persistence disposition', () => {
  it('every top-level state key is serialized, mapped, or explicitly transient', async () => {
    const { state, driverJSON } = await import('../src/store.js');
    const serialized = serialize(state as AppState, driverJSON.value, []);
    const carried = new Set(Object.keys(serialized));
    const undecided: string[] = [];
    for (const key of Object.keys(state)) {
      const ok = carried.has(key) || key in MAPPED || key in TRANSIENT;
      if (!ok) undecided.push(key);
    }
    expect(undecided, 'state field(s) with NO persistence decision — carry them in serialize() '
      + 'or add them to TRANSIENT with a reason (see POST_MORTEM 2026-07-23):\n'
      + undecided.join('\n')).toEqual([]);
  });

  it('the MAPPED entries really are carried (no stale mapping)', async () => {
    const { state, driverJSON } = await import('../src/store.js');
    const s = serialize(state as AppState, driverJSON.value, []) as unknown as Record<string, unknown>;
    // cursor.* mappings — the cursor object must exist and carry all four mapped fields.
    const cursor = s.cursor as Record<string, unknown>;
    expect(cursor).toBeDefined();
    for (const path of Object.values(MAPPED)) {
      const [, sub] = path.split('.');
      expect(sub in cursor, `${path} missing from serialize() output`).toBe(true);
    }
  });
});
