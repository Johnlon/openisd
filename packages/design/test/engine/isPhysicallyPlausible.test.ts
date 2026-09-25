import {describe, expect, it} from 'vitest';
import {Engine} from '../../engine/index.js';

/**
 * `Engine.isPhysicallyPlausible` — D9 tier 1's one door into D5's `PHYSICAL_RANGE` table. The
 * domain layer (`selectOrigin`, `domain/selectOrigin.ts`) needs to ask "is this raw scraper
 * reading inside the field's band?" and may not import `engine/physicalRange.ts` directly
 * (`test/architecture-engine-boundary.test.ts`) — this method is the capability `Engine` offers
 * instead, matching every other calculation this class exposes.
 */
describe('Engine.isPhysicallyPlausible (D9 tier 1)', () => {
  const engine = new Engine();

  it('is true for a value inside the field band', () => {
    expect(engine.isPhysicallyPlausible('Fs_hz', 45)).toBe(true);
  });

  it('is false for a value below the field band', () => {
    expect(engine.isPhysicallyPlausible('Qts', 0.001)).toBe(false);
  });

  it('is false for a value above the field band', () => {
    expect(engine.isPhysicallyPlausible('Fs_hz', 9000)).toBe(false);
  });

  it('is true for a field PHYSICAL_RANGE has no band for', () => {
    expect(engine.isPhysicallyPlausible('Gloss', -50)).toBe(true);
  });

  it('is true for a field name it does not recognise at all', () => {
    expect(engine.isPhysicallyPlausible('not_a_real_field', -50)).toBe(true);
  });
});
