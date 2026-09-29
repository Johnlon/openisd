/**
 * `VentEngine.firstResonance_hz` — the vent tube's own first (organ-pipe) resonance, the
 * open-open duct fundamental `c/(2·L)`. Moved here from UI-side math in `ventReadouts.ts`
 * (John, 2026-09-27: "UI is display only" — a shell must not carry a physics formula).
 *
 * Uses the PHYSICAL length, not `effectiveLength`'s end-corrected `Leff`, to match WinISD's own
 * "1st port resonance" readout exactly (`original-skin.browser.spec.ts`'s
 * "the Vented '1st port resonance' shows the vent pipe resonance c/(2·ventL), not the box
 * tuning" pins the same distinction at the UI layer).
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createEngine} from '../../engine/index.js';

const engine = createEngine();
const air = engine.environment.solve({}).values;

describe('VentEngine.firstResonance_hz', () => {
  it('is c/(2·L) for the physical length, not the end-corrected length', () => {
    const L = 0.15; // 15 cm
    const expected = air.c / (2 * L);
    const actual = engine.vent.firstResonance_hz(L, air);
    assert.equal(actual, expected);
  });

  it('rises as the vent shortens (inverse relationship)', () => {
    const short = engine.vent.firstResonance_hz(0.05, air);
    const long = engine.vent.firstResonance_hz(0.5, air);
    assert.ok(short !== null && long !== null && short > long);
  });

  it('is null for a zero or negative length — there is no port to resonate', () => {
    assert.equal(engine.vent.firstResonance_hz(0, air), null);
    assert.equal(engine.vent.firstResonance_hz(-0.1, air), null);
  });
});
