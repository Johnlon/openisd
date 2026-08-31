/**
 * `Znom` — WinISD's nominal impedance is CALCULATED from `Re`, not a stored label.
 *
 *     Znom = 2 · round_half_to_even(0.75 · Re)
 *
 * 🔒 ORACLE: `winisd_research/runs/znom_state.jsonl` — 21 successful probes of real WinISD
 * (winisd.exe, wine 10.0) driven by `toys/campaign_znom_state.py`, ledger QO30. Each case writes
 * an explicit `ParState` into the project so "unset" can be expressed, fires the derived pass with
 * one typed `Le` edit, and reads the editor back. 18 of the 21 leave `Znom` unset and every one
 * comes back marked `C` with the value below. `Znom` is an integer, so the criterion is EXACT
 * integer agreement, not a residual.
 *
 * Every expected value in this file is the probe's own observation or the formula evaluated by
 * hand.
 *
 * 🔒 THE ROUNDING MODE takes all three exact-`.5` ties to pin; no one of them is decisive:
 *   Re = 6  → 0.75·Re = 4.5 → 4 (even) → 8.   Half-UP would give 5 → 10.   HALF-UP REFUTED.
 *   Re = 10 → 7.5 → 8 (even) → 16.            Half-DOWN would give 7 → 14. HALF-DOWN REFUTED.
 *   Re = 2  → 1.5 → 2 (even) → 4.             Confirms both directions.
 *
 * 🔒 THE TWO NEAR-TIES are the reason the product must be evaluated EXACTLY. WinISD is Delphi and
 * computes in 80-bit Extended, where `0.75·Re` never rounds onto the tie:
 *   Re = 7.333333333333333  → 5.49999999999999975  → 5 → 10, where a double-rounded product is
 *                             exactly 5.5 and would predict 12.
 *   Re = 3.3333333333333335 → 2.500000000000000125 → 3 → 6,  where a double-rounded product is
 *                             exactly 2.5 and would predict 4.
 * Both ride on the `PROBE` rows below, which the solver must reproduce exactly.
 */

import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { Engine } from '../../engine/index.js';

/** The engine's one door: every calculation below is a method on this object. */
const engine = new Engine();

const solve = (d: Record<string, number>) =>
  engine.solveConsistencyGroup(d) as Record<string, number>;

/**
 * The probe's Re-swept cases, transcribed from `runs/znom_state.jsonl` by label: the `Re` typed
 * in, and the `Znom` WinISD showed afterwards (all marked `C` — WinISD computed them).
 */
const PROBE: ReadonlyArray<readonly [label: string, Re: number, Znom: number]> = [
  ['Z_tie_re0.6',      0.6,                0],
  ['Z_absent_re1.5',   1.5,                2],
  ['Z_tie_re2.',       2,                  4],
  ['Z_absent_re3.2',   3.2,                4],
  ['Z_tie_re3.333333', 3.3333333333333335, 6],
  ['Z_absent_re4',     4,                  6],
  ['Z_tie_re4.666667', 4.666666666666667,  8],
  ['Z_absent_re5.5',   5.5,                8],
  ['Z_absent_re6',     6,                  8],
  ['Z_tie_re7.333333', 7.333333333333333, 10],
  ['Z_absent_re8',     8,                 12],
  ['Z_absent_re9',     9,                 14],
  ['Z_tie_re10.',      10,                16],
  ['Z_absent_re12',    12,                18],
  ['Z_absent_re27',    27,                40],
  ['Z_absent_re123',   123,              184],
];

/**
 * A driver complete enough for the full solver, minus `Re` and `Znom` — the probe's own entered
 * set for `Z_absent_re*` with those two removed.
 */
const BASE = { Fs: 40.0, Mms: 0.00194848430081419, Cms: 0.008124999999999992, Sd: 0.022, Qms: 2.1, BL: 6.0, Xmax: 0.0067, Pe: 100 };

describe('Znom in the consistency solver', () => {
  it('derives Z from Re for every probe row', () => {
    for (const [label, Re, Znom] of PROBE) {
      const r = solve({ ...BASE, Re });
      assert.equal(r.Znom_ohm, Znom, `${label}: solver must fill Z=${Znom} from Re=${Re}`);
    }
  });

  it('never corrects an entered Znom that contradicts Re', () => {
    // Z_entered_znom4_re6: Znom=4 typed beside Re=6 (whose rule gives 8) stays 4, marked E.
    const r = solve({ ...BASE, Re: 6, Znom: 4 });
    assert.equal(r.Znom_ohm, 4, 'an entered Z is pinned — the rule never overwrites it');
  });

  it('follows Re, not the damping factors', () => {
    // Z_incon_re8_qes27: Re=8 written beside Qes/Qts/Rms describing a driver with Re=27.
    const r = solve({ ...BASE, Re: 8, Qes: 0.3654, Qts: 0.3113, Rms: 0.2332 });
    assert.equal(r.Znom_ohm, 12, '2·round(0.75·8) = 12, not the 40 that Re=27 would give');
  });

  it('accepts a CALCULATED Re as its input', () => {
    // Z_re_unset: no Re typed. WinISD back-derived Re=6 (marked C) and Znom still landed on 8.
    const r = solve({ ...BASE, Qes: 0.08161791953430539 });
    assert.equal(r.Re_ohm, 6, 'Re must be back-derived from Qes/Bl/Fs/Mms first');
    assert.equal(r.Znom_ohm, 8, 'and Znom follows the derived Re');
  });

  it('leaves Z absent when Re is unknown', () => {
    const r = solve({ Fs: 40, Mms: 0.00194848430081419, Cms: 0.008124999999999992, Sd: 0.022 });
    assert.equal(r.Re_ohm, undefined, 'guard: this record cannot derive Re');
    assert.equal(r.Znom_ohm, undefined, 'no Re → no Znom (slot 0 stays N)');
  });
});
