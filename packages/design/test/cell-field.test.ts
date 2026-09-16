import { describe, it, expect } from 'vitest';
import { entryField, nullableField, resolvingLens } from '../domain/cell.js';
import type { Lens } from '../domain/cell.js';
import type { SpecEntryJson } from '../domain/openisdSchema.js';

/** A trivial in-memory `Lens` for a test-owned slot — no record, no schema, just a box a test
 *  can read back after driving a `Field` through it. */
function fakeLens<T>(initial: T): Lens<T> {
  let current = initial;
  return {
    get: () => current,
    set: (v) => { current = v; },
  };
}

describe('entryField — a Field over a C/E-flagged entry slot (S2-7a)', () => {
  it('set(v) writes an entered entry into the lens', () => {
    const lens = fakeLens<SpecEntryJson | undefined>(undefined);
    const field = entryField(lens, 'x');
    field.set(3);
    expect(lens.get()).toEqual({ state: 'E', value: 3 });
    expect(field.get().state).toBe('entered');
  });

  it('setCalculated(v) writes a calculated entry into the lens', () => {
    const lens = fakeLens<SpecEntryJson | undefined>(undefined);
    const field = entryField(lens, 'x');
    field.setCalculated(4);
    expect(lens.get()).toEqual({ state: 'C', value: 4 });
    expect(field.get().state).toBe('calculated');
  });

  it('an entered write after a calculated one wins outright', () => {
    const lens = fakeLens<SpecEntryJson | undefined>(undefined);
    const field = entryField(lens, 'x');
    field.setCalculated(4);
    field.set(5);
    expect(lens.get()).toEqual({ state: 'E', value: 5 });
    expect(field.get().state).toBe('entered');
  });

  it('setNotAvailable() never removes an entered value', () => {
    const lens = fakeLens<SpecEntryJson | undefined>(undefined);
    const field = entryField(lens, 'x');
    field.set(5);
    field.setNotAvailable();
    expect(lens.get()).toEqual({ state: 'E', value: 5 });
    expect(field.get().state).toBe('entered');
  });

  it('setNotAvailable() clears a calculated (non-entered) value', () => {
    const lens = fakeLens<SpecEntryJson | undefined>(undefined);
    const field = entryField(lens, 'x');
    field.setCalculated(4);
    field.setNotAvailable();
    expect(lens.get()).toBeUndefined();
    expect(field.get().state).toBe('not-available');
  });

  it('setDq(list) writes dq_calculated marks whose detail is the text, read back through get().dq()', () => {
    const lens = fakeLens<SpecEntryJson | undefined>(undefined);
    const field = entryField(lens, 'x');
    field.set(5);
    field.setDq(['x']);
    expect(field.get().dq()).toEqual(['x']);
    expect(lens.get()?.dq_calculated?.[0].detail).toBe('x');
  });
});

describe('InputField — the flag-less slot nullableField/requiredField hand back (S2-7a)', () => {
  it('has no setCalculated — a slot with no C/E flag cannot be handed to a solver', () => {
    const lens = fakeLens<{ v: number | null }>({ v: null });
    const field = nullableField(lens, 'v');
    // @ts-expect-error InputField has no setCalculated — only Field (SolverField) exposes it.
    const missing = field.setCalculated;
    expect(missing).toBeUndefined();
  });
});

describe('resolvingLens — a lens that resolves after every outside write (S2-7c)', () => {
  it('runs onWrite once after an ordinary set()', () => {
    const base = fakeLens(0);
    let calls = 0;
    const lens = resolvingLens(base, () => { calls++; });
    lens.set(5);
    expect(base.get()).toBe(5);
    expect(calls).toBe(1);
  });

  it('a write made BY onWrite itself does not re-trigger onWrite (reentrancy guard)', () => {
    const base = fakeLens(0);
    let calls = 0;
    let lens!: Lens<number>;
    lens = resolvingLens(base, () => {
      calls++;
      lens.set(base.get() + 1);
    });
    lens.set(5);
    expect(calls).toBe(1);
    expect(base.get()).toBe(6);
  });

  it('a write from OUTSIDE onWrite after it has finished triggers onWrite again', () => {
    const base = fakeLens(0);
    let calls = 0;
    const lens = resolvingLens(base, () => { calls++; });
    lens.set(1);
    lens.set(2);
    expect(calls).toBe(2);
  });
});
