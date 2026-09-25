/* eslint-disable prefer-const */
import {describe, expect, it, vi} from 'vitest';
import type {Calculated, Entered, IssueRenderer, Readable, SimpleField} from '../domain/cell.js';
import {CalculatedFieldImpl, calculatedCell, entryField, inputOf, nullableField, pairedField, ReadableFieldImpl, requiredField, resolvingField, DefaultingFieldImpl, enteredCell} from '../domain/cell.js';
import type {SpecEntryJson} from '../domain/openisdSchema.js';
import type {DqIssue} from '../engine/index.js';

/** A distinct, hand-constructible `DqIssue` for fixtures — a target-unreachable issue is the
 *  simplest closed-union member to write out by hand. */
function issue(target: string, maxReachable_hz = 0): DqIssue {
  return { kind: 'target-unreachable', target, maxReachable_hz };
}

/** Mock `Engine.dqIssueText`. */
const renderIssue: IssueRenderer = {dqIssueText: vi.fn((issue: DqIssue) => `rendered: ${issue.kind}`)};

/** A trivial in-memory `SimpleField` for a test-owned slot — no record, no schema, just a box a
 *  test can read back after driving a field through it. */
function fakeSlot<T>(initial: T): SimpleField<T> {
  let current = initial;
  return {
    get value() { return current; },
    set: (v) => { current = v; },
  };
}

/** Exactly one of `entered` / `calculated` / `value === null` holds on every read. */
function assertOneProvenance(field: Readable<unknown> & Entered & Calculated): void {
  const marks = [field.entered, field.calculated, field.value === null].filter(Boolean).length;
  expect(marks, `entered=${field.entered} calculated=${field.calculated} value=${String(field.value)}`).toBe(1);
}

describe('entryField — a field over a C/E-flagged entry slot (S2-7a)', () => {
  it('set(v) writes an entered entry into the slot', () => {
    const slot = fakeSlot<SpecEntryJson | undefined>(undefined);
    const field = entryField(slot, 'x', renderIssue);
    field.set(3);
    expect(slot.value).toEqual({ state: 'E', value: 3 });
    expect(field.entered).toBe(true);
    expect(field.calculated).toBe(false);
  });

  it('setCalculated(v) writes a calculated entry into the slot', () => {
    const slot = fakeSlot<SpecEntryJson | undefined>(undefined);
    const field = entryField(slot, 'x', renderIssue);
    field.setCalculated(4);
    expect(slot.value).toEqual({ state: 'C', value: 4 });
    expect(field.calculated).toBe(true);
    expect(field.entered).toBe(false);
  });

  it('an entered write after a calculated one wins outright', () => {
    const slot = fakeSlot<SpecEntryJson | undefined>(undefined);
    const field = entryField(slot, 'x', renderIssue);
    field.setCalculated(4);
    field.set(5);
    expect(slot.value).toEqual({ state: 'E', value: 5 });
    expect(field.entered).toBe(true);
  });

  it('setNotAvailable() never removes an entered value', () => {
    const slot = fakeSlot<SpecEntryJson | undefined>(undefined);
    const field = entryField(slot, 'x', renderIssue);
    field.set(5);
    field.setNotAvailable();
    expect(slot.value).toEqual({ state: 'E', value: 5 });
    expect(field.entered).toBe(true);
  });

  it('setNotAvailable() clears a calculated (non-entered) value to null', () => {
    const slot = fakeSlot<SpecEntryJson | undefined>(undefined);
    const field = entryField(slot, 'x', renderIssue);
    field.setCalculated(4);
    field.setNotAvailable();
    expect(slot.value).toBeUndefined();
    expect(field.value).toBeNull();
    expect(field.entered).toBe(false);
    expect(field.calculated).toBe(false);
  });

  it('setDq(list) writes dq_calculated marks whose detail comes from the injected renderer, read back live through dq', () => {
    const slot = fakeSlot<SpecEntryJson | undefined>(undefined);
    const field = entryField(slot, 'x', renderIssue);
    field.set(5);
    const mark = issue('x');
    field.setDq([mark]);
    expect(field.dq).toEqual([mark]);
    expect(renderIssue.dqIssueText).toHaveBeenCalledWith(mark);
    expect(slot.value?.dq_calculated?.[0].detail).toBe('rendered: target-unreachable');
  });

  it('setDq() with no list at all clears dq to empty, the same as an explicit []', () => {
    const slot = fakeSlot<SpecEntryJson | undefined>(undefined);
    const field = entryField(slot, 'x', renderIssue);
    field.set(5);
    field.setDq([issue('stale')]);
    field.setDq();
    expect(field.dq).toEqual([]);
  });

  it('setCalculated(v, dq) attaches the dq marks in the same write as the value', () => {
    const slot = fakeSlot<SpecEntryJson | undefined>(undefined);
    const field = entryField(slot, 'x', renderIssue);
    const mark = issue('derived');
    field.setCalculated(4, [mark]);
    expect(field.dq).toEqual([mark]);
  });

  it('name reads the field\'s own name; an absent slot reads null with neither flag', () => {
    const slot = fakeSlot<SpecEntryJson | undefined>(undefined);
    const field = entryField(slot, 'x', renderIssue);
    expect(field.name).toBe('x');
    expect(field.value).toBeNull();
    expect(field.entered).toBe(false);
    expect(field.calculated).toBe(false);
  });

  it('exactly one of entered / calculated / value===null holds after every kind of write', () => {
    const slot = fakeSlot<SpecEntryJson | undefined>(undefined);
    const field = entryField(slot, 'x', renderIssue);
    assertOneProvenance(field);
    field.set(5);
    assertOneProvenance(field);
    field.setCalculated(4);
    assertOneProvenance(field);
    field.setNotAvailable();
    assertOneProvenance(field);
    field.set(6);
    field.clear();
    assertOneProvenance(field);
  });
});

describe('entryField — writeEntryDq\'s persisted mark shape, per DqIssue variant (D14/D14a)', () => {
  it('inconsistent-inputs: kind calc, rule inconsistent-inputs, params name the whole finding', () => {
    const slot = fakeSlot<SpecEntryJson | undefined>(undefined);
    const field = entryField(slot, 'Qts', renderIssue);
    field.set(0.6);
    field.setDq([{
      kind: 'inconsistent-inputs', target: 'Qts', fields: ['Qts', 'Qes', 'Qms'],
      formula: 'Qts = Qes·Qms/(Qes+Qms)', expected: 0.452, actual: 0.6, relative: 0.33,
    }]);
    expect(slot.value?.dq_calculated?.[0]).toEqual({
      kind: 'calc', severity: 'error', rule: 'inconsistent-inputs',
      params: { target: 'Qts', fields: ['Qts', 'Qes', 'Qms'], formula: 'Qts = Qes·Qms/(Qes+Qms)', expected: 0.452, actual: 0.6, relative: 0.33 },
      detail: 'rendered: inconsistent-inputs',
    });
  });

  it('missing-dependencies: kind calc, rule missing-dependencies, params name the target and every route\'s missing field, deduplicated', () => {
    const slot = fakeSlot<SpecEntryJson | undefined>(undefined);
    const field = entryField(slot, 'Qts', renderIssue);
    field.set(0.4);
    field.setDq([{
      kind: 'missing-dependencies', target: 'Qts',
      routes: [
        { formula: 'Qts = Qes·Qms/(Qes+Qms)', required: ['Qes', 'Qms'], missing: ['Qes'] },
        { formula: 'Qts = Qes·Qms/(Qes+Qms) v2', required: ['Qes', 'Qms'], missing: ['Qes'] },
      ],
    }]);
    expect(slot.value?.dq_calculated?.[0]).toEqual({
      kind: 'calc', severity: 'error', rule: 'missing-dependencies',
      params: { target: 'Qts', missing: ['Qes'] },
      detail: 'rendered: missing-dependencies',
    });
  });

  it('out-of-range (driver field, D14): kind range, rule range-below-min, params name field/value/limit', () => {
    const slot = fakeSlot<SpecEntryJson | undefined>(undefined);
    const field = entryField(slot, 'Qts', renderIssue);
    field.set(0.02);
    field.setDq([{ kind: 'out-of-range', field: 'Qts', value: 0.02, limit: 0.1, side: 'below' }]);
    expect(slot.value?.dq_calculated?.[0]).toEqual({
      kind: 'range', severity: 'error', rule: 'range-below-min',
      params: { field: 'Qts', value: 0.02, limit: 0.1 },
      detail: 'rendered: out-of-range',
    });
  });

  it('out-of-range (driver field, D14): rule range-above-max on the other side', () => {
    const slot = fakeSlot<SpecEntryJson | undefined>(undefined);
    const field = entryField(slot, 'Qts', renderIssue);
    field.set(12);
    field.setDq([{ kind: 'out-of-range', field: 'Qts', value: 12, limit: 2, side: 'above' }]);
    expect(slot.value?.dq_calculated?.[0]).toMatchObject({ kind: 'range', rule: 'range-above-max' });
  });

  it('out-of-range (vented plausibility, quantity/min/max shape): keeps the pre-D14 generic calc/issue mapping', () => {
    const slot = fakeSlot<SpecEntryJson | undefined>(undefined);
    const field = entryField(slot, 'Fb', renderIssue);
    field.set(400);
    field.setDq([{ kind: 'out-of-range', quantity: 'Fb', value: 400, min: 10, max: 150 }]);
    expect(slot.value?.dq_calculated?.[0]).toEqual({
      kind: 'calc', severity: 'error', rule: 'issue', params: {},
      detail: 'rendered: out-of-range',
    });
  });

  it('non-physical: keeps the pre-D14 generic calc/issue mapping', () => {
    const slot = fakeSlot<SpecEntryJson | undefined>(undefined);
    const field = entryField(slot, 'Fb', renderIssue);
    field.set(-5);
    field.setDq([{ kind: 'non-physical', quantity: 'Fb', value: -5 }]);
    expect(slot.value?.dq_calculated?.[0]).toEqual({
      kind: 'calc', severity: 'error', rule: 'issue', params: {},
      detail: 'rendered: non-physical',
    });
  });

  it('target-unreachable: keeps the pre-D14 generic calc/issue mapping', () => {
    const slot = fakeSlot<SpecEntryJson | undefined>(undefined);
    const field = entryField(slot, 'length_m', renderIssue);
    field.set(0.5);
    field.setDq([issue('length_m', 120)]);
    expect(slot.value?.dq_calculated?.[0]).toEqual({
      kind: 'calc', severity: 'error', rule: 'issue', params: {},
      detail: 'rendered: target-unreachable',
    });
  });
});

describe('entryField — precision, derived from the entry\'s own shape (D13)', () => {
  it('a calculated entry reports null precision', () => {
    const slot = fakeSlot<SpecEntryJson | undefined>(undefined);
    const field = entryField(slot, 'x', renderIssue);
    field.setCalculated(4);
    expect(field.precision).toBeNull();
  });

  it('an absent slot reports null precision', () => {
    const slot = fakeSlot<SpecEntryJson | undefined>(undefined);
    const field = entryField(slot, 'x', renderIssue);
    expect(field.precision).toBeNull();
  });

  it('an entered value with no reading falls back to the half-ulp of its own decimal', () => {
    const slot = fakeSlot<SpecEntryJson | undefined>(undefined);
    const field = entryField(slot, 'x', renderIssue);
    field.set(0.49);
    expect(field.precision).toBeCloseTo(0.005, 9);
  });

  it('an entered value with a matching reading uses that reading\'s own stated precision', () => {
    const slot = fakeSlot<SpecEntryJson | undefined>({
      state: 'E', value: 0.49, origin: 'datasheet',
      readings: { datasheet: { read_value: 0.49, read_precision: 0.01 } },
    });
    const field = entryField(slot, 'x', renderIssue);
    expect(field.precision).toBe(0.01);
  });

  it('an entered value naming an origin with no matching reading falls back to half-ulp', () => {
    const slot = fakeSlot<SpecEntryJson | undefined>({ state: 'E', value: 0.49, origin: 'datasheet' });
    const field = entryField(slot, 'x', renderIssue);
    expect(field.precision).toBeCloseTo(0.005, 9);
  });

  it('re-entering the same field after a calculated write recomputes precision fresh', () => {
    const slot = fakeSlot<SpecEntryJson | undefined>(undefined);
    const field = entryField(slot, 'x', renderIssue);
    field.setCalculated(4);
    expect(field.precision).toBeNull();
    field.set(37);
    expect(field.precision).toBeCloseTo(0.5, 9);
  });
});

describe('nullableField — a writable field over storage no solver ever touches (S2-7a)', () => {
  it('has no setCalculated — no engine code ever computes this quantity, so the type omits the method rather than no-op it', () => {
    const slot = fakeSlot<{ v: number | null }>({ v: 5 });
    const field = nullableField(slot, 'v');
    // @ts-expect-error no Calculatable atom — a solver write here has no meaning.
    const missing = field.setCalculated;
    expect(missing).toBeUndefined();
  });

  it('has no setDq — dq is recomputed live from the getDq callback on every read instead', () => {
    const slot = fakeSlot<{ v: number | null }>({ v: 5 });
    const field = nullableField(slot, 'v', (v) => (v !== null && v > 10 ? issue('too big') : null));
    // @ts-expect-error no Calculatable atom — dq is derived, never stored.
    const missing = field.setDq;
    expect(missing).toBeUndefined();
  });

  it('name/entered read the slot directly; an empty slot is null and not entered', () => {
    const slot = fakeSlot<{ v: number | null }>({ v: null });
    const field = nullableField(slot, 'v');
    expect(field.name).toBe('v');
    expect(field.value).toBeNull();
    expect(field.entered).toBe(false);

    field.set(5);
    expect(field.value).toBe(5);
    expect(field.entered).toBe(true);

    field.clear();
    expect(field.value).toBeNull();
    expect(field.entered).toBe(false);
  });

  it('nullableField\'s getDq callback runs on every read, its dq mark present only when the callback names one', () => {
    const slot = fakeSlot<{ v: number | null }>({ v: 5 });
    const tooBig = issue('too big');
    const field = nullableField(slot, 'v', (v) => (v !== null && v > 10 ? tooBig : null));
    expect(field.dq).toEqual([]);

    field.set(20);
    expect(field.dq).toEqual([tooBig]);
  });
});

describe('requiredField — an always-entered slot with no "not entered" state to clear to', () => {
  it('name/entered read the slot directly, value is a plain non-null number', () => {
    const slot = fakeSlot<{ v: number }>({ v: 5 });
    const field = requiredField(slot, 'v');
    expect(field.name).toBe('v');
    expect(field.entered).toBe(true);
    // `Readable<number>`'s `value` is `number`, not `number | null` — no null-check needed.
    const value: number = field.value;
    expect(value).toBe(5);
  });

  it('its getDq callback runs on every read, its dq mark present only when the callback names one', () => {
    const slot = fakeSlot<{ v: number }>({ v: 5 });
    const tooBig = issue('too big');
    const field = requiredField(slot, 'v', (v) => (v > 10 ? tooBig : null));
    expect(field.dq).toEqual([]);

    slot.set({ v: 20 });
    expect(field.dq).toEqual([tooBig]);
  });

  it('set() writes a new value straight through the slot', () => {
    const slot = fakeSlot<{ v: number }>({ v: 5 });
    const field = requiredField(slot, 'v');
    field.set(9);
    expect(slot.value.v).toBe(9);
    expect(field.value).toBe(9);
  });

  it('has no clear() — there is no "not entered" state for a required field to return to', () => {
    const slot = fakeSlot<{ v: number }>({ v: 5 });
    const field = requiredField(slot, 'v');
    // @ts-expect-error no Clearable atom — the write is impossible, so the type omits the
    // method rather than expose one that throws.
    const missing = field.clear;
    expect(missing).toBeUndefined();
  });
});

describe('inputOf — a plain no-flag SolverInput over a read with no C/E state of its own', () => {
  it('entered is true exactly when the underlying read is not null', () => {
    expect(inputOf(() => 5).entered).toBe(true);
    expect(inputOf(() => null).entered).toBe(false);
  });

  it('value reads straight through', () => {
    expect(inputOf(() => 5).value).toBe(5);
  });
});

describe('ReadableFieldImpl — a bare read with no entered/calculated status of its own', () => {
  it('exposes name/value/dq, sourced from the one cell', () => {
    const mark = issue('note');
    const cell = calculatedCell<number | null>('r', 7, [mark]);
    const field = new ReadableFieldImpl(() => cell);
    expect(field.name).toBe('r');
    expect(field.value).toBe(7);
    expect(field.dq).toEqual([mark]);
  });
});

describe('CalculatedFieldImpl — a read-only field the solver derives or reports absent', () => {
  it('exposes name/value/calculated/dq, all sourced from the one cell', () => {
    const mark = issue('note');
    const cell = calculatedCell<number | null>('r', 7, [mark]);
    const field = new CalculatedFieldImpl(() => cell);
    expect(field.name).toBe('r');
    expect(field.value).toBe(7);
    expect(field.calculated).toBe(true);
    expect(field.dq).toEqual([mark]);
  });
});

describe('pairedField — a member of a mutually-exclusive entered pair (diameter/area, tuning/length)', () => {
  it('setDq(list) forwards the marks to the underlying entry, read back live through dq', () => {
    const slot = fakeSlot<SpecEntryJson | undefined>(undefined);
    const ownEntry = entryField(slot, 'x', renderIssue);
    const field = pairedField(() => {}, ownEntry);
    field.set(5);
    const mark = issue('x');
    field.setDq([mark]);
    expect(field.dq).toEqual([mark]);
  });
});

describe('DefaultingFieldImpl — owner and solver write; never absent, clear() returns the default', () => {
  function fakeField(initial: number | null) {
    let current = initial;
    let state: 'E' | 'C' = 'C';
    const dqCalls: (readonly DqIssue[])[] = [];
    const writes = {
      entered: (v: number) => { current = v; state = 'E'; },
      clear: () => { current = null; },
      calculated: (v: number) => { current = v; state = 'C'; },
      dq: (list: readonly DqIssue[]) => { dqCalls.push(list); },
    };
    const field = new DefaultingFieldImpl<number>(
      () => current === null ? calculatedCell('v', 1) : state === 'E' ? enteredCell('v', current) : calculatedCell('v', current),
      writes,
    );
    return {field, dqCalls: () => dqCalls};
  }

  it('pre: empty | read | post: the default, calculated', () => {
    const {field} = fakeField(null);
    expect(field.value).toBe(1);
    expect(field.calculated).toBe(true);
    expect(field.entered).toBe(false);
  });

  it('pre: 1 C | set(4) | post: 4 E; then clear() | post: 1 C', () => {
    const {field} = fakeField(null);
    field.set(4);
    expect(field.value).toBe(4);
    expect(field.entered).toBe(true);
    field.clear();
    expect(field.value).toBe(1);
    expect(field.calculated).toBe(true);
  });

  it('setCalculated(v, dq) writes the value and the dq marks; setDq() forwards an empty list', () => {
    const mark = issue('note');
    const {field, dqCalls} = fakeField(null);
    field.setCalculated(4, [mark]);
    expect(field.value).toBe(4);
    expect(field.calculated).toBe(true);
    field.setCalculated(5);
    field.setDq();
    expect(dqCalls()).toEqual([[mark], []]);
  });
});

describe('resolvingField — a slot that resolves after every outside write (S2-7c)', () => {
  it('runs onWrite once after an ordinary set()', () => {
    const base = fakeSlot(0);
    let calls = 0;
    const slot = resolvingField(base, () => { calls++; });
    slot.set(5);
    expect(base.value).toBe(5);
    expect(calls).toBe(1);
  });

  it('a write made BY onWrite itself does not re-trigger onWrite (reentrancy guard)', () => {
    const base = fakeSlot(0);
    let calls = 0;
    let slot!: SimpleField<number>;
    slot = resolvingField(base, () => {
      calls++;
      slot.set(base.value + 1);
    });
    slot.set(5);
    expect(calls).toBe(1);
    expect(base.value).toBe(6);
  });

  it('a write from OUTSIDE onWrite after it has finished triggers onWrite again', () => {
    const base = fakeSlot(0);
    let calls = 0;
    const slot = resolvingField(base, () => { calls++; });
    slot.set(1);
    slot.set(2);
    expect(calls).toBe(2);
  });
});
