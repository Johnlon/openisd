/**
 * The vent group's E/C/N provenance — which of Vb / ventD / Fb / ventL is HELD and which is
 * SOLVED.
 *
 * One relation ties all four: Fb = (c/2π)·√(Sp/(Vb·Leff)), Leff = L + k·d. So exactly one
 * unknown is solvable, and WHICH one is a property of the entered set, not of the schema.
 *
 * `enterVentField`/`clearVentField`/`ventFieldState` (`useVentGroup.ts`) exercise the
 * provenance directly through `box.vented.*`'s `FieldHandle`s — real, working code. The actual
 * Helmholtz solve that would recompute the calculated member (`solveVentGroup()` on
 * `OpenISDProject`, `packages/design/domain/openisdDomain.ts`) rewrites nothing, because the
 * tuning ↔ vent-length relation is not wired; every test needing a field to read CALCULATED is
 * skipped below under QO126 rather than forced to pass.
 *
 * Numbers come from WinISD 0.7.0.950 itself, Vents tab, Vb=0.02 m³ / Fb=40 Hz / k=0.6:
 * 0.154 m at d=5 cm and 0.318 m at d=7 cm (winisd_research/CALC_FINDINGS_FOR_REVIEW.md).
 */
import { describe, it, beforeEach } from 'vitest';
import assert from 'node:assert/strict';
import { OpenISDProject, OpenISDDriver } from '@openisd/design';
import { Engine } from '@openisd/design/engine';
import {
  solveVentGroup, enterVentField as enterVentFieldOn, clearVentField as clearVentFieldOn,
  ventFieldState as ventFieldStateOn,
} from '../../src/logic/useVentGroup.js';

/** Vb=0.02 m³, round 5 cm vent, k=0.6 — WinISD's own Vents-tab trial. */
function ventedProject() {
  const engine = new Engine();
  // This test is about box/vent/filter fields, not about any driver's contents, so the driver
  // states nothing — the domain's own blank rather than a record assembled here.
  const driver = OpenISDDriver.empty(engine);
  const p = OpenISDProject.builder(driver, engine).vented().volume_m3(0.02).tuning_hz(40).build();
  p.box.vented.vent.shape.set('round');
  p.box.vented.vent.diameter_m.set(0.05);
  p.box.vented.vent.endCorrection_m.set(0.6);
  return p;
}

describe('vent group — the entered set decides the direction', () => {
  it('the length the volume/area/tuning actually require matches WinISD\'s published values', () => {
    const p = ventedProject();
    const Sp = p.box.vented.vent.area_m2();
    assert.ok(Sp != null);
    const len5cm = p.box.vented.vent.lengthForTuning_m(0.02, 40);
    assert.ok(len5cm != null && Math.abs(len5cm - 0.154) < 0.001,
      `d=5cm → ${len5cm?.toFixed(4)} m, WinISD shows 0.154`);

    p.box.vented.vent.diameter_m.set(0.07);
    const len7cm = p.box.vented.vent.lengthForTuning_m(0.02, 40);
    assert.ok(len7cm != null && Math.abs(len7cm - 0.318) < 0.001,
      `d=7cm → ${len7cm?.toFixed(4)} m, WinISD shows 0.318`);
  });

  it('clearing both of the pair leaves both N — one equation cannot solve two unknowns', () => {
    const p = ventedProject();
    clearVentFieldOn(p, 'Fb');
    clearVentFieldOn(p, 'ventL');
    assert.equal(ventFieldStateOn(p, 'Fb'), 'N');
    assert.equal(ventFieldStateOn(p, 'ventL'), 'N');
  });
});

// The following behaviour needs `OpenISDProject.solveVentGroup()` to actually solve. It does not:
// the tuning ↔ vent-length relation is not wired, so the method runs and rewrites nothing
// (`packages/design/test/vent-pr-group-stubs.test.ts` pins that interim contract). Until it is,
// nothing ever reports a vent field as CALCULATED — which is what every test here asserts.
//
// Ruled and scoped in QO126, deferred by John 2026-09-08 ("Log as a inbox / bug and carry on with
// migration"): bugs/BUG_20260908_tuning_and_its_paired_quantity_never_solve_each_other.md. Skipped
// rather than weakened, because an assertion loosened to match a stub would go green and stop
// describing the behaviour the app is supposed to have.
describe.skip('vent group — solveVentGroup() re-derives the calculated member (BLOCKED: QO126)', () => {
  let p: ReturnType<typeof ventedProject>;
  beforeEach(() => { p = ventedProject(); });

  it('ships WinISD\'s direction: tuning entered, vent length calculated', () => {
    assert.equal(ventFieldStateOn(p, 'Fb'), 'E');
    assert.equal(ventFieldStateOn(p, 'ventL'), 'C');
  });

  it('entering the second of the pair locks it E; clearing it returns it to C', () => {
    enterVentFieldOn(p, 'ventL', 0.154);
    assert.equal(ventFieldStateOn(p, 'Fb'), 'E');
    assert.equal(ventFieldStateOn(p, 'ventL'), 'E');

    clearVentFieldOn(p, 'Fb');
    assert.equal(ventFieldStateOn(p, 'Fb'), 'C');
    assert.equal(ventFieldStateOn(p, 'ventL'), 'E');
  });

  it('THE DIRECTION TEST — changing vent diameter holds the tuning and moves the length', () => {
    const lenBefore = p.box.vented.vent.length_m.get().value;
    p.box.vented.vent.diameter_m.set(0.07);
    solveVentGroup(p);
    assert.equal(p.box.vented.tuning_hz.get().value, 40, 'an entered tuning must never be rewritten by the solver');
    assert.notEqual(p.box.vented.vent.length_m.get().value, lenBefore, 'the length must absorb the diameter change');
  });

  it('the reverse direction is the same solver: enter the length, the tuning is solved', () => {
    clearVentFieldOn(p, 'Fb');
    enterVentFieldOn(p, 'ventL', 0.154);
    p.box.vented.vent.diameter_m.set(0.07);
    solveVentGroup(p);
    assert.equal(p.box.vented.vent.length_m.get().value, 0.154, 'an entered length must never be rewritten');
    assert.notEqual(p.box.vented.tuning_hz.get().value, 40, 'now the TUNING absorbs the diameter change');
  });

  it('an over-determined set solves nothing and rewrites nothing', () => {
    enterVentFieldOn(p, 'ventL', 0.999);
    p.box.vented.vent.diameter_m.set(0.07);
    solveVentGroup(p);
    assert.equal(p.box.vented.tuning_hz.get().value, 40, 'entered values are held even when they contradict');
    assert.equal(p.box.vented.vent.length_m.get().value, 0.999);
  });
});
