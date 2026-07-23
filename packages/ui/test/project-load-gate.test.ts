/**
 * MECHANICAL GATE — everything serialize() writes, applyState() reads back.
 *
 * Class of faults prevented: a NEW field is added to the persisted snapshot and wired into
 * ONE loader while another loader silently ignores it, so a project loaded through that path
 * comes back partially blank. That is exactly how "File → Open… does nothing" happened:
 * `useDesignIO.importFile()` hand-rolled a subset of App.vue's `applyState()` (driver/box/P/
 * graphs only), so opening a saved project restored the design but dropped the project name,
 * the view, the comparison overlays and the graph cursor — with no error to see.
 *
 * The structural fix is ONE applyState() in the store that every load path calls. This gate
 * makes the drift impossible to reintroduce: every top-level key serialize() emits must be
 * covered by a PROBE that proves applyState() actually landed it, or be named in NOT_APPLIED
 * with a reason. A new serialized key with neither fails the suite.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { serialize } from '../src/utils/persist.js';
import type { AppState, SerializedState } from '../src/types.js';

beforeAll(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }));
});
afterAll(() => vi.unstubAllGlobals());

// Keys that are deliberately NOT applied to the store — each needs a reason.
const NOT_APPLIED: Record<string, string> = {
  v: 'format discriminator, not state — routes the driver payload inside setDriverFromSerialized',
};

// A comparison overlay stores the DERIVED driver (a plain number bag), not the DriverJSON —
// applyState has to re-sweep it, so the probe row carries a fully derived, finite driver.
const DERIVED_DRIVER = {
  name: 'Probe Overlay', Fs: 37, Re: 5.6, Sd: 0.0133, Vas: 0.03, Qts: 0.378, Qes: 0.40, Qms: 7.0,
  Cms: 0.0008, Mms: 0.0231, Rms: 0.767, Bl: 8.67, Le: 0.0007, Xmax: 0.005, Pe: 60, Z: 8,
};

/** A snapshot with every carried key set to a value distinguishable from the store defaults. */
function probeSnapshot(): SerializedState {
  return {
    v: 2,
    driver: { inputs: { name: 'Probe Driver', Fs: 41, Qts: 0.41, Qes: 0.44, Qms: 6.1, Vas: 0.021, Sd: 0.0121, Re: 6.1, Xmax: 0.006, Pe: 61 } } as SerializedState['driver'],
    box: 'sealed',
    P: { Vb: 0.0123, Pin: 3 } as SerializedState['P'],
    graphs: ['SPL', 'Zmag'],
    compare: [{ driver: DERIVED_DRIVER, box: 'vented', P: { Vb: 0.02 }, name: 'Copy of probe', color: '#123456', visible: false }] as unknown as SerializedState['compare'],
    ui: { skin: 'classic', originalChartTab: 'GD' } as SerializedState['ui'],
    project: { name: 'probe project', creator: 'jl', created: '2026-01-01', modified: '2026-01-02', description: 'd' },
    cursor: { f: 123.4, pinnedF: 500, locked: true, range: { fLo: 31.6, fHi: 100 } },
  };
}

/** For each carried key: what to read off the store after applyState, and what it must equal. */
type Probe = { read: (s: AppState, driverName: string | undefined) => unknown; expected: unknown };
const PROBES: Record<string, Probe> = {
  driver:  { read: (_s, driverName) => driverName,                     expected: 'Probe Driver' },
  box:     { read: (s) => s.box,                                       expected: 'sealed' },
  P:       { read: (s) => s.P.Vb,                                      expected: 0.0123 },
  graphs:  { read: (s) => s.graphs,                                    expected: ['SPL', 'Zmag'] },
  // Name AND the per-overlay trace visibility — a hidden overlay must come back hidden.
  compare: { read: (s) => s.compare.map(d => [d.name, d.visible]),     expected: [['Copy of probe', false]] },
  ui:      { read: (s) => s.ui.skin,                                   expected: 'classic' },
  project: { read: (s) => s.project.name,                              expected: 'probe project' },
  cursor:  { read: (s) => [s.cursorF, s.pinnedF, s.cursorLocked, s.dragRange?.fLo], expected: [123.4, 500, true, 31.6] },
};

describe('mechanical gate — serialize() → applyState() parity', () => {
  it('every serialized key is probed or explicitly not applied', async () => {
    const { state, driverJSON } = await import('../src/store.js');
    const carried = Object.keys(serialize(state as AppState, driverJSON.value, []));
    const uncovered = carried.filter(k => !(k in PROBES) && !(k in NOT_APPLIED));
    expect(uncovered, 'serialized key(s) with no load decision — add a PROBE proving applyState() '
      + 'restores them, or list them in NOT_APPLIED with a reason:\n' + uncovered.join('\n')).toEqual([]);
  });

  it('applyState() actually restores every probed key', async () => {
    const { state, driverJSON, applyState } = await import('../src/store.js');
    applyState(probeSnapshot());
    for (const [key, probe] of Object.entries(PROBES)) {
      expect(probe.read(state as AppState, driverJSON.value.inputs?.name as string | undefined),
        `applyState() dropped "${key}"`).toEqual(probe.expected);
    }
  });

  it('a restored comparison overlay is re-swept, not left curve-less', async () => {
    const { state, applyState } = await import('../src/store.js');
    applyState(probeSnapshot());
    // A Design with null curves draws nothing — restoring the row without its curves is the
    // same "looks loaded, shows nothing" failure at the overlay level.
    expect(state.compare[0]?.curves, 'restored compare row must carry re-computed curves').toBeTruthy();
  });
});
