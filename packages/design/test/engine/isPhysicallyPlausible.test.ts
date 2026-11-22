import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/Engine.js';
/**
 * `Engine.isPhysicallyPlausible` — D9 tier 1's one door into D5's `PHYSICAL_RANGE` table. The
 * domain layer (`selectOrigin`, `domain/selectOrigin.ts`) needs to ask "is this raw scraper
 * reading inside the field's band?" and may not import `engine/physicalRange.ts` directly
 * (`test/architecture-engine-boundary.test.ts`) — this method is the capability `Engine` offers
 * instead, matching every other calculation this class exposes.
 */
describe('Engine.isPhysicallyPlausible (D9 tier 1)', () => {
  const engine = createEngine();

  it('is true for a value inside the field band', () => {
    expect(engine.driver.isPhysicallyPlausible('Fs_hz', 45)).toBe(true);
  });

  it('is false for a value below the field band', () => {
    expect(engine.driver.isPhysicallyPlausible('Qts', 0.001)).toBe(false);
  });

  it('is false for a value above the field band', () => {
    expect(engine.driver.isPhysicallyPlausible('Fs_hz', 9000)).toBe(false);
  });

  it('is false for a field with no researched band but an entry band that rejects it', () => {
    expect(engine.driver.isPhysicallyPlausible('Gloss', -50)).toBe(false);
  });

  it('is true for a field name it does not recognise at all', () => {
    expect(engine.driver.isPhysicallyPlausible('not_a_real_field', -50)).toBe(true);
  });

  // BUG_20261021_le-rms-zero-passes-plausibility: a printed 0 is not a real Le or Rms, like Qts = 0.
  it.each(['Le_H', 'Rms_kg_per_s'])('is false for a printed 0 in %s', (field) => {
    expect(engine.driver.isPhysicallyPlausible(field, 0)).toBe(false);
  });

  it('is true for the smallest real Le (3.1 uH) and Rms (0.0458 kg/s) in the drivers db', () => {
    expect(engine.driver.isPhysicallyPlausible('Le_H', 3.1e-6)).toBe(true);
    expect(engine.driver.isPhysicallyPlausible('Rms_kg_per_s', 0.0457)).toBe(true);
  });
});
