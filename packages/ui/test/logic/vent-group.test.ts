/**
 * The vent group's E/C/N provenance — which of Vb / ventD / Fb / ventL is HELD and which is
 * SOLVED.
 *
 * One relation ties all four: Fb = (c/2π)·√(Sp/(Vb·Leff)), Leff = L + k·d. So exactly one
 * unknown is solvable, and WHICH one is a property of the entered set, not of the schema.
 * That is the point of storing provenance rather than picking a direction: WinISD's default
 * (tuning entered, length solved) and the reverse come from the same solver.
 *
 * Two tests here are load-bearing and would each pass a WRONG implementation of the other:
 *
 *   - "changing vent diameter holds the tuning" fails any implementation that stores `ventL`
 *     as the authoritative fact and derives `Fb` for display.
 *   - "a restore is bit-identical" fails any implementation that re-solves on restore. That
 *     defect is what broke three original-skin Revert specs the first time this shipped —
 *     the solver reproduced the calculated member from a JSON-rounded value and landed on a
 *     different double (STATE_MODEL.md rule 3, "Cancel means byte-identical").
 *
 * Numbers come from WinISD 0.7.0.950 itself, Vents tab, Vb=0.02 m³ / Fb=40 Hz / k=0.6:
 * 0.154 m at d=5 cm and 0.318 m at d=7 cm (winisd_research/CALC_FINDINGS_FOR_REVIEW.md).
 */
import { describe, it, beforeEach } from 'vitest';
import assert from 'node:assert/strict';
import {
  state, applyState, enterVentField, clearVentField, ventFieldState,
} from '../../src/logic/store.js';
import { solveVentGroup } from '../../src/logic/useVentGroup.js';

/** WinISD's own Vents-tab trial. */
function winisdVentsTrial(): void {
  state.P.Vb = 0.02;
  state.P.ventD = 0.05;
  state.P.endCorrection = 0.6;
  state.P.entered = { Vb: true, ventD: true, Fb: true };
  enterVentField('Fb', 40);
}

describe('vent group — the entered set decides the direction', () => {
  beforeEach(() => {
    state.P.entered = { Vb: true, ventD: true, Fb: true };
  });

  it('ships WinISD\'s direction: Vb/ventD/Fb entered, vent length calculated', () => {
    assert.equal(ventFieldState('Fb'), 'E');
    assert.equal(ventFieldState('ventL'), 'C');
  });

  it('reproduces WinISD\'s own published vent lengths to within display rounding', () => {
    winisdVentsTrial();
    assert.ok(Math.abs(state.P.ventL - 0.154) < 0.001,
      `d=5cm → ${state.P.ventL.toFixed(4)} m, WinISD shows 0.154`);

    state.P.ventD = 0.07;
    solveVentGroup(state.P);
    assert.ok(Math.abs(state.P.ventL - 0.318) < 0.001,
      `d=7cm → ${state.P.ventL.toFixed(4)} m, WinISD shows 0.318`);
  });

  it('THE DIRECTION TEST — changing vent diameter holds the tuning and moves the length', () => {
    winisdVentsTrial();
    const lenBefore = state.P.ventL;

    state.P.ventD = 0.07;
    solveVentGroup(state.P);

    assert.equal(state.P.Fb, 40, 'an entered tuning must never be rewritten by the solver');
    assert.notEqual(state.P.ventL, lenBefore, 'the length must absorb the diameter change');
  });

  it('the reverse direction is the same solver: enter the length, the tuning is solved', () => {
    winisdVentsTrial();
    clearVentField('Fb');
    enterVentField('ventL', 0.154);

    assert.equal(ventFieldState('ventL'), 'E');
    assert.equal(ventFieldState('Fb'), 'C');

    state.P.ventD = 0.07;
    solveVentGroup(state.P);
    assert.equal(state.P.ventL, 0.154, 'an entered length must never be rewritten');
    assert.notEqual(state.P.Fb, 40, 'now the TUNING absorbs the diameter change');
  });

  it('entering the second of the pair locks it E; clearing it returns it to C', () => {
    winisdVentsTrial();
    enterVentField('ventL', 0.154);
    assert.equal(ventFieldState('Fb'), 'E');
    assert.equal(ventFieldState('ventL'), 'E');

    clearVentField('Fb');
    assert.equal(ventFieldState('Fb'), 'C');
    assert.equal(ventFieldState('ventL'), 'E');
  });

  it('clearing both of the pair leaves both N — one equation cannot solve two unknowns', () => {
    winisdVentsTrial();
    clearVentField('Fb');
    clearVentField('ventL');
    assert.equal(ventFieldState('Fb'), 'N');
    assert.equal(ventFieldState('ventL'), 'N');
  });

  it('ventD cleared is N, not a silently wrong C — it has no closed form', () => {
    winisdVentsTrial();
    enterVentField('ventL', 0.154);
    clearVentField('ventD');
    assert.equal(ventFieldState('ventD'), 'N',
      'ventD appears in both Sp and Leff, so solving for it is not closed-form');
  });

  it('an over-determined set solves nothing and rewrites nothing', () => {
    winisdVentsTrial();
    enterVentField('ventL', 0.999);          // both entered, and contradictory
    assert.equal(ventFieldState('Fb'), 'E');
    assert.equal(ventFieldState('ventL'), 'E');

    state.P.ventD = 0.07;
    solveVentGroup(state.P);
    assert.equal(state.P.Fb, 40, 'entered values are held even when they contradict');
    assert.equal(state.P.ventL, 0.999);
  });
});

describe('vent group — a restore is adopted verbatim', () => {
  it('THE RESTORE TEST — round-tripping through JSON returns bit-identical Fb and ventL', () => {
    state.P.Vb = 0.02;
    state.P.ventD = 0.05;
    state.P.endCorrection = 0.6;
    state.P.entered = { Vb: true, ventD: true, Fb: true };
    enterVentField('Fb', 40);

    // Exactly what persistence does: JSON out, JSON back in. The rounding that happens here
    // is what a re-solve on restore would amplify into a different double.
    const saved = JSON.parse(JSON.stringify({ P: state.P }));
    const fbBefore = state.P.Fb, lenBefore = state.P.ventL;

    state.P.ventD = 0.09;                     // drift the live design away
    applyState(saved);

    assert.equal(state.P.Fb, fbBefore, 'restored tuning must be bit-identical');
    assert.equal(state.P.ventL, lenBefore, 'restored length must be bit-identical');
  });

  it('a design saved before the vent group existed is read as length-entered', () => {
    // No `Fb`, no `entered` — its ventL WAS authoritative, because it was the only direction
    // the app had. Read at the persistence boundary into the one current shape.
    const legacy = { P: { ...state.P, ventL: 0.154, Vb: 0.02, ventD: 0.05, endCorrection: 0.6 } };
    delete (legacy.P as Record<string, unknown>).Fb;
    delete (legacy.P as Record<string, unknown>).entered;

    applyState(JSON.parse(JSON.stringify(legacy)));

    assert.equal(ventFieldState('ventL'), 'E', 'the stored length is the authoritative fact');
    assert.equal(ventFieldState('Fb'), 'C', 'and the tuning is solved from it');
    assert.ok(state.P.Fb > 39 && state.P.Fb < 41,
      `tuning solved from the stored geometry → ${state.P.Fb.toFixed(2)} Hz, expected ≈40`);
  });
});
