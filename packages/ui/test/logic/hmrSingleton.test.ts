import { describe, it, expect } from 'vitest';
import { hmrSlots, getOrInit } from '../../src/logic/hmrSingleton.js';

/**
 * The singleton mechanism, and the property the whole thing exists for: a slot is created ONCE.
 *
 * The value lives on `globalThis` so a Vite hot-reload — which re-runs a module's top-level code
 * — reuses the existing instance instead of building a second one that every already-captured
 * reference would then be blind to. `globalThis` rather than `window` because it is the same
 * object in a browser and also exists in Node, so there is one path and no environment branch to
 * make the app and its tests behave differently.
 */

interface Probe { count: { n: number }; label: string }

describe('hmrSlots — a module gets one slot object, not a new one per call', () => {
  it('hands back the SAME object on a second call', () => {
    let stored: Partial<Probe> | undefined;
    const slots = () => hmrSlots<Probe>(() => stored, s => { stored = s; });

    const first = slots();
    const second = slots();

    // Identity, not equality: two empty objects are deeply equal and would pass `toEqual` while
    // being exactly the bug this guards — a second slot nobody else is looking at.
    expect(second).toBe(first);
  });

  it('creates the slot on first use, not before', () => {
    let stored: Partial<Probe> | undefined;
    expect(stored).toBeUndefined();

    hmrSlots<Probe>(() => stored, s => { stored = s; });

    expect(stored).toBeDefined();
  });
});

describe('getOrInit — a slot member is built once and then reused', () => {
  it('runs init on the first read and never again', () => {
    let stored: Partial<Probe> | undefined;
    const slots = hmrSlots<Probe>(() => stored, s => { stored = s; });
    let built = 0;

    const a = getOrInit(slots, 'count', () => { built++; return { n: 1 }; });
    const b = getOrInit(slots, 'count', () => { built++; return { n: 2 }; });

    expect(built).toBe(1);
    expect(b).toBe(a);          // the same object, not a second one with the same shape
    expect(b.n).toBe(1);        // the FIRST init won; the second never ran
  });

  it('is lazy — a member nobody reads is never built', () => {
    let stored: Partial<Probe> | undefined;
    const slots = hmrSlots<Probe>(() => stored, s => { stored = s; });
    let built = 0;

    getOrInit(slots, 'label', () => { built++; return 'x'; });

    expect(built).toBe(1);
    expect(stored?.count).toBeUndefined();   // the other member was never touched
  });

  it('keeps members apart — one key does not serve another', () => {
    let stored: Partial<Probe> | undefined;
    const slots = hmrSlots<Probe>(() => stored, s => { stored = s; });

    getOrInit(slots, 'count', () => ({ n: 7 }));
    const label = getOrInit(slots, 'label', () => 'mine');

    expect(label).toBe('mine');
    expect(getOrInit(slots, 'count', () => ({ n: 99 })).n).toBe(7);
  });
});
