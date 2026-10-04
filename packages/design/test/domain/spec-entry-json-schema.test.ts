import {describe, expect, it} from 'vitest';
import {specEntryJsonSchema} from '../../domain/openisdSchema.js';
import {calculatedEntry, enteredEntry} from '../../domain/specEntry.js';

describe('specEntryJsonSchema — the {state, value} sum type', () => {
  it('rejects a bare {origin, readings} shape with no state key (no legacy upgrade; the bridge builds the entry)', () => {
    const bareScraperShape: unknown = JSON.parse('{"origin":"datasheet","readings":{"datasheet":{"read_value":32.5}}}');
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
