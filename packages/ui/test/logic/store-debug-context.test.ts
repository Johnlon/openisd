/**
 * `globalThis.__store_context` — a debug handle for browser specs that need to simulate "an
 * unrelated design edit" without going through the DOM (`persistence/original-projects.
 * browser.spec.ts`: `window.__store_context.state.P.Vb = 0.042`). Mirrors the existing
 * `globalThis.__openisd_appState` pattern (`appState.ts`) — always on, no build-flag gate,
 * since none exists in this codebase for this kind of hook.
 *
 * `state.P.Vb` is the ONE writable path: assigning it routes through the FOCUSED project's own
 * box-volume write for whichever box type is active, exactly as the Box tab's "Volume" field
 * does, so the write is real (it notifies) rather than a mutation on a dead object.
 */
import {describe, expect, it} from 'vitest';
import {newProject, requireFocusedProject} from '../../src/logic/appState.js';

describe('globalThis.__store_context', () => {
  it('is always defined, shaped {state:{P:{Vb}}}', () => {
    expect(globalThis.__store_context).toBeDefined();
    expect(globalThis.__store_context?.state.P).toBeDefined();
  });

  it('assigning state.P.Vb writes the focused project\'s own box volume for the active box type', () => {
    newProject(); // starts sealed, volume 0 (OpenISDProject.empty)
    expect(requireFocusedProject().box.boxType.get()).toBe('sealed');

    globalThis.__store_context!.state.P.Vb = 0.042;

    expect(requireFocusedProject().box.sealed.volume_m3.get()).toBeCloseTo(0.042, 12);
  });

  it('the write is real — it notifies subscribers, not a mutation on a dead object', () => {
    newProject();
    let notified = 0;
    const unsubscribe = requireFocusedProject().subscribe(() => { notified++; });

    globalThis.__store_context!.state.P.Vb = 0.037;

    expect(notified).toBeGreaterThan(0);
    unsubscribe();
  });

  it('reading state.P.Vb back reflects the live value', () => {
    newProject();
    globalThis.__store_context!.state.P.Vb = 0.055;
    expect(globalThis.__store_context!.state.P.Vb).toBeCloseTo(0.055, 12);
  });
});
