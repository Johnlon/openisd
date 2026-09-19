import {describe, expect, it} from 'vitest';
import {enteredEntry, specEntryJsonSchema} from '../../domain/openisdSchema.js';

describe('specEntryJsonSchema — the {state, value} sum type (S2-7b / T11)', () => {
  it('parses a legacy {origin, readings} JSON string into {state:"E", value, origin, readings}', () => {
    const legacy = JSON.parse('{"origin":"datasheet","readings":{"datasheet":{"read_value":32.5}}}');
    const result = specEntryJsonSchema.parse(legacy);
    expect(result).toEqual({
      state: 'E', value: 32.5, origin: 'datasheet', readings: { datasheet: { read_value: 32.5 } },
    });
  });

  it('rejects legacy input whose origin names no reading — a real parse error, not a fabricated value', () => {
    const legacy = { origin: 'missing', readings: { datasheet: { read_value: 32.5 } } };
    expect(() => specEntryJsonSchema.parse(legacy)).toThrow();
  });

  it('round-trips a calculated entry and rejects an extra key', () => {
    const calculated = { state: 'C' as const, value: 0.38 };
    expect(specEntryJsonSchema.parse(calculated)).toEqual(calculated);
    expect(() => specEntryJsonSchema.parse({ ...calculated, origin: 'nope' })).toThrow();
  });

  it('enteredEntry(v) is a bare {state:"E", value} — a hand entry carries no provenance', () => {
    expect(enteredEntry(3)).toEqual({ state: 'E', value: 3 });
  });
});
