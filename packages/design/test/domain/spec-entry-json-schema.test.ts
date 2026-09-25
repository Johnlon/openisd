import {describe, expect, it} from 'vitest';
import {
  calculatedEntry, enteredEntry, specEntryJsonSchema, sortKeysDeep,
  wiringFromRecord, VoiceCoilWiring, openISDProjectJsonSchema,
} from '../../domain/openisdSchema.js';

describe('specEntryJsonSchema — the {state, value} sum type (S2-7b / T11)', () => {
  it('rejects a bare {origin, readings} shape with no state key (D15 — no legacy upgrade; the bridge builds the entry)', () => {
    const bareScraperShape = JSON.parse('{"origin":"datasheet","readings":{"datasheet":{"read_value":32.5}}}');
    expect(() => specEntryJsonSchema.parse(bareScraperShape)).toThrow();
  });

  it('parses an entry the bridge already built: {state:"E", value, origin, readings}', () => {
    const built = {
      state: 'E' as const, value: 32.5, origin: 'datasheet',
      readings: { datasheet: { read_value: 32.5 } },
    };
    expect(specEntryJsonSchema.parse(built)).toEqual(built);
  });

  it('a record with neither state nor any recognised shape is a parse error', () => {
    expect(() => specEntryJsonSchema.parse({})).toThrow();
    expect(() => specEntryJsonSchema.parse({ origin: 42, readings: { x: { read_value: 1 } } })).toThrow();
  });

  it('round-trips a calculated entry and rejects an extra key', () => {
    const calculated = { state: 'C' as const, value: 0.38 };
    expect(specEntryJsonSchema.parse(calculated)).toEqual(calculated);
    expect(() => specEntryJsonSchema.parse({ ...calculated, origin: 'nope' })).toThrow();
  });

  it('enteredEntry(v) is a bare {state:"E", value} — a hand entry carries no provenance', () => {
    expect(enteredEntry(3)).toEqual({ state: 'E', value: 3 });
  });

  it('calculatedEntry(v) is a bare {state:"C", value} — a solver-derived value carries no provenance either', () => {
    expect(calculatedEntry(0.38)).toEqual({ state: 'C', value: 0.38 });
  });
});

describe('wiringFromRecord — the VCCon 1|2 encoding, absence is not a wiring', () => {
  it('maps 1 to Parallel and 2 to Series', () => {
    expect(wiringFromRecord(1)).toBe(VoiceCoilWiring.Parallel);
    expect(wiringFromRecord(2)).toBe(VoiceCoilWiring.Series);
  });

  it('a number the encoding does not define, or null, reads as absence', () => {
    expect(wiringFromRecord(3)).toBeNull();
    expect(wiringFromRecord(null)).toBeNull();
  });
});

describe('openISDEnvironmentJsonSchema — legacy migration preprocess', () => {
  it('passes a non-record environment value through unchanged, so the object schema reports the real parse error', () => {
    const envSchema = openISDProjectJsonSchema.shape.environment;
    expect(() => envSchema.parse('not-a-record')).toThrow();
  });
});

describe('sortKeysDeep — canonical A→Z key order, recursively', () => {
  it('sorts an object whose own keys arrive out of order, in both directions', () => {
    // Three keys, not already ascending and not fully reversed: sorting them exercises the
    // comparator's a<b, a>b AND a===b arms, not just one.
    const sorted = sortKeysDeep({ b: 1, a: 2, c: 3 });
    expect(sorted).toEqual({ a: 2, b: 1, c: 3 });
    expect(Object.keys(sorted as object)).toEqual(['a', 'b', 'c']);
  });

  it('sorts nested objects and the objects inside arrays, leaving non-objects untouched', () => {
    expect(sortKeysDeep({ z: [{ y: 1, x: 2 }], a: 1 })).toEqual({ a: 1, z: [{ x: 2, y: 1 }] });
    expect(sortKeysDeep(5)).toBe(5);
    expect(sortKeysDeep(null)).toBe(null);
  });
});
