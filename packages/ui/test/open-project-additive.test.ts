/**
 * Opening a project ADDS it to the Projects list — it does not replace what was open.
 *
 * WinISD keeps every opened project in its Projects list, one active at a time. Human
 * directive 2026-07-24: "when I open a project it must be added to the list of open proj",
 * with the ruling that the opened project becomes the active/editable one and the
 * previously-open project stays listed (a row) so nothing open is lost.
 *
 * This is distinct from `applyState()` (whole-session restore on page load / share link),
 * which still REPLACES — reopening the same session must not accumulate phantom rows.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { SerializedState } from '../src/types.js';

beforeAll(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }));
});
afterAll(() => vi.unstubAllGlobals());

// A fully-derived driver bag, as a saved project's `driver` payload arrives (DriverJSON with
// an `inputs` map) — routed through setDriverFromSerialized.
function projectSnapshot(name: string, over: Partial<SerializedState> = {}): SerializedState {
  return {
    v: 2,
    driver: { inputs: { name: name + ' driver', Fs: 41, Qts: 0.41, Qes: 0.44, Qms: 6.1, Vas: 0.021, Sd: 0.0121, Re: 6.1, Xmax: 0.006, Pe: 61 } } as SerializedState['driver'],
    box: 'sealed',
    P: { Vb: 0.0123, Pin: 3 } as SerializedState['P'],
    graphs: ['SPL', 'Zmag'],
    compare: [],
    ui: {} as SerializedState['ui'],
    project: { name, creator: '', created: '', modified: '', description: '' },
    cursor: null as unknown as SerializedState['cursor'],
    ...over,
  };
}

describe('openProjectAdditive — Open adds to the Projects list', () => {
  it('makes the opened project active and keeps the previously-open one as a listed row', async () => {
    const { state, driverRaw, openProjectAdditive, newProject } = await import('../src/store.js');
    newProject();                          // clean baseline: the demo project, no overlays
    state.project.name = 'Bookshelf';
    const bookshelfDriver = driverRaw.value.name;
    expect(state.compare).toHaveLength(0);

    openProjectAdditive(projectSnapshot('Subwoofer'));

    // The opened project is now the active/editable design.
    expect(state.project.name).toBe('Subwoofer');
    expect(driverRaw.value.name).toBe('Subwoofer driver');
    // The previously-open project survives as a row, under its own name.
    expect(state.compare.map(d => d.name)).toContain('Bookshelf');
    const prior = state.compare.find(d => d.name === 'Bookshelf')!;
    expect(prior.driver?.name).toBe(bookshelfDriver);
  });

  it('accumulates across successive opens — three opens leave two prior projects listed', async () => {
    const { state, openProjectAdditive, newProject } = await import('../src/store.js');
    newProject();
    state.project.name = 'A';
    openProjectAdditive(projectSnapshot('B'));
    openProjectAdditive(projectSnapshot('C'));
    expect(state.project.name).toBe('C');
    expect(state.compare.map(d => d.name)).toEqual(['B', 'A']);   // most-recently-open first
  });

  it('gives the retained project re-computed curves so its trace actually draws', async () => {
    const { state, openProjectAdditive, newProject } = await import('../src/store.js');
    newProject();
    state.project.name = 'Bookshelf';
    openProjectAdditive(projectSnapshot('Subwoofer'));
    const prior = state.compare.find(d => d.name === 'Bookshelf')!;
    // A row without curves is the "loaded but invisible" failure — the whole point of the
    // list is that every open project is drawn.
    expect(prior.curves, 'retained project must carry curves').toBeTruthy();
    expect((prior.curves as { spl: number[] }).spl.some(Number.isFinite)).toBe(true);
  });

  it("brings in the opened file's own comparison overlays as well", async () => {
    const { state, openProjectAdditive, newProject } = await import('../src/store.js');
    newProject();
    state.project.name = 'Bookshelf';
    const withOverlay = projectSnapshot('Subwoofer', {
      compare: [{ driver: { name: 'ov', Fs: 30, Re: 4, Sd: 0.02, Vas: 0.05, Qts: 0.4, Qes: 0.42, Qms: 6, Cms: 0.001, Mms: 0.03, Rms: 0.8, Bl: 9, Le: 0.0005, Xmax: 0.008, Pe: 100, Z: 4 }, box: 'vented', P: { Vb: 0.04 }, name: "Subwoofer's overlay", color: '#abcdef' }] as unknown as SerializedState['compare'],
    });
    openProjectAdditive(withOverlay);
    const names = state.compare.map(d => d.name);
    expect(names).toContain('Bookshelf');              // the prior active project
    expect(names).toContain("Subwoofer's overlay");    // the opened file's own overlay
  });

  it('does not disturb the ground/modified layer differently from a normal edit', async () => {
    // Opening a project changes the design, so it reads as "modified" — same as today's
    // replace-based open (BACKLOG notes a freshly-opened project starts modified). This test
    // pins that opening does not THROW on the ground machinery, not a specific ground policy.
    const { state, openProjectAdditive, newProject, isModified } = await import('../src/store.js');
    newProject();
    openProjectAdditive(projectSnapshot('Subwoofer'));
    expect(typeof isModified.value).toBe('boolean');
    expect(state.project.name).toBe('Subwoofer');
  });
});
