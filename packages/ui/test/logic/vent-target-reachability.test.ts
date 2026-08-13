/**
 * A TARGET TUNING THE PORT CANNOT REACH MUST BE REPORTED, NOT ABSORBED.
 *
 * `ventLength()` returns the raw signed root of L = c²·Sp/(4π²·Fb²·V) − k·d
 * (`packages/engine/src/alignments.ts`), so a target above the ceiling comes back NEGATIVE.
 * The ceiling is the tuning at L = 0: the end correction alone supplies acoustic mass, so a
 * zero-length aperture in this volume through this area already resonates somewhere, and
 * nothing shorter exists. While the LENGTH was the entered field this was invisible — nothing
 * downstream claimed the length meant a particular Fb. With the direction reversed (Fb
 * entered, length solved, winisd_research/GAPS.md §A1) it is user-facing: the Vents pane
 * would otherwise offer a dimension for a tuning it cannot produce.
 *
 * The detector asks the existing `tuningFromLength()` what the SOLVED length actually tunes
 * to and compares that with the target — there is no second copy of the physics — and treats
 * a non-positive solved length as the failure it is, since no vent has negative length.
 *
 * Trial geometry: Vb = 30 L, round vent d = 5 cm, k = 0.6 → L = 0 tunes to 80.79 Hz, so
 * 40 Hz is reachable and 90 Hz is not.
 */
import { describe, it, beforeEach } from 'vitest';
import assert from 'node:assert/strict';
import { state, enterVentField } from '../../src/logic/store.js';
import {
  ventAchievedFb, ventTargetUnreachable, ventMaxReachableFb,
} from '../../src/logic/useVentGroup.js';

/** The L = 0 ceiling for the trial geometry — the highest tuning any vent here can deliver. */
const CEILING_HZ = 80.79194836403872;

/** Vb = 30 L, round 5 cm vent, k = 0.6, tuning entered — WinISD's direction. */
function trial(targetFb: number): void {
  state.box = 'vented';
  state.P.ventShape = 'round';
  state.P.Vb = 0.03;
  state.P.ventD = 0.05;
  state.P.endCorrection = 0.6;
  state.P.entered = { Vb: true, ventD: true, Fb: true };
  enterVentField('Fb', targetFb);
}

describe('vent target reachability — an unreachable tuning must surface, not hide', () => {
  beforeEach(() => {
    state.box = 'vented';
    state.P.entered = { Vb: true, ventD: true, Fb: true };
  });

  it('a reachable target is delivered exactly by the solved length', () => {
    trial(40);
    const achieved = ventAchievedFb(state.P, state.box);
    assert.ok(achieved != null && Math.abs(achieved - 40) < 1e-6,
      `solved length ${state.P.ventL.toFixed(4)} m tunes to ${achieved?.toFixed(4)} Hz, target 40`);
    assert.equal(ventTargetUnreachable(state.P, state.box), false);
  });

  it('THE UNREACHABLE TEST — the solved length goes NEGATIVE and is reported, not floored', () => {
    trial(90);
    assert.ok(state.P.ventL < 0,
      `90 Hz needs L = ${(state.P.ventL * 1000).toFixed(2)} mm — a floor here would hide the failure`);
    assert.equal(ventTargetUnreachable(state.P, state.box), true,
      '90 Hz on a 30 L box with a 5 cm vent is above the L = 0 ceiling');
    assert.equal(ventAchievedFb(state.P, state.box), null,
      'a negative length has no achieved tuning to quote');
  });

  it('names the true ceiling — the L = 0 tuning, not an arbitrary shortest vent', () => {
    trial(90);
    const ceiling = ventMaxReachableFb(state.P, state.box);
    assert.ok(ceiling != null && Math.abs(ceiling - CEILING_HZ) < 1e-6,
      `ceiling ${ceiling?.toFixed(4)} Hz, expected ${CEILING_HZ.toFixed(4)}`);
  });

  it('THE BOUNDARY — just below the ceiling is reachable, just above it is not', () => {
    trial(CEILING_HZ * 0.999);
    assert.ok(state.P.ventL > 0, 'just below the ceiling the length is positive');
    assert.equal(ventTargetUnreachable(state.P, state.box), false);

    trial(CEILING_HZ * 1.001);
    assert.ok(state.P.ventL < 0, 'just above the ceiling the length is negative');
    assert.equal(ventTargetUnreachable(state.P, state.box), true);
  });

  it('an ENTERED length is the user\'s own choice — never reported as unreachable', () => {
    trial(90);
    enterVentField('ventL', 0.005);
    assert.equal(ventTargetUnreachable(state.P, state.box), false,
      'both members entered: the solver does not run, so there is no solver claim to contradict');
  });

  it('the bandpass front chamber is judged on its OWN volume, not the whole box', () => {
    state.box = 'bandpass4';
    state.P.ventShape = 'round';
    state.P.Vb = 0.03;
    state.P.Vf = 0.002;          // small front chamber → the same 40 Hz target is far easier
    state.P.ventD = 0.05;
    state.P.endCorrection = 0.6;
    state.P.entered = { ventD: true, Fb: true };
    enterVentField('Fb', 40);

    const achieved = ventAchievedFb(state.P, state.box);
    assert.ok(achieved != null && Math.abs(achieved - 40) < 1e-6,
      `front-chamber solve must use Vf: got ${achieved?.toFixed(4)} Hz`);
    assert.equal(ventTargetUnreachable(state.P, state.box), false);

    state.P.Vf = 0.03;           // now the same geometry as the unreachable single-chamber case
    enterVentField('Fb', 90);
    assert.equal(ventTargetUnreachable(state.P, state.box), true);
  });
});
