/**
 * The vent group's E/C/N provenance — which of Vb / ventD / Fb / ventL is HELD and which is
 * SOLVED.
 *
 * One relation ties all four: Fb = (c/2π)·√(Sp/(Vb·Leff)), Leff = L + k·d. So exactly one
 * unknown is solvable, and WHICH one is a property of the entered set, not of the schema.
 *
 * `enterVentField`/`clearVentField`/`ventFieldState` (`useVentGroup.ts`) exercise the
 * provenance directly through `box.vented.*`'s `FieldHandle`s — real, working code. The Helmholtz
 * solve that recomputes the calculated member lives on `OpenISDProject#resolve()`
 * (`packages/design/domain/openisdDomain.ts`, S2-7d2), run synchronously by every `.set()`/
 * `.clear()` these helpers make.
 *
 * Numbers come from WinISD 0.7.0.950 itself, Vents tab, Vb=0.02 m³ / Fb=40 Hz / k=0.6:
 * 0.154 m at d=5 cm and 0.318 m at d=7 cm (winisd_research/CALC_FINDINGS_FOR_REVIEW.md).
 */
import {beforeEach, describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {OpenISDDriver, OpenISDProject} from '@openisd/design';
import {Engine} from '@openisd/design/engine';
import {
    clearVentField as clearVentFieldOn,
    enterVentField as enterVentFieldOn,
    notifyVentChanged,
    resetVentGroupState,
    ventFieldState as ventFieldStateOn,
} from '../../src/logic/useVentGroup.js';

/** Vb=0.02 m³, round 5 cm vent, k=0.6 — WinISD's own Vents-tab trial. */
function ventedProject() {
  const engine = new Engine();
  // This test is about box/vent/filter fields, not about any driver's contents, so the driver
  // states nothing — the domain's own blank rather than a record assembled here.
  const driver = OpenISDDriver.empty(engine);
  const p = OpenISDProject.builder(driver, engine).vented().volume_m3(0.02).tuning_goal_hz(40).build();
  p.box.vented.vent.shape.set('round');
  p.box.vented.vent.diameter_m.set(0.05);
  p.box.vented.vent.endCorrection_m.set(0.6);
  p.notifyVentChanged();
  return p;
}

describe('vent group — the entered set decides the direction', () => {
  it('the length the volume/area/tuning actually require matches WinISD\'s published values', () => {
    const p = ventedProject();
    const Sp = p.box.vented.vent.area_m2.value;
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

// QO126 RESOLVED (S2-7d2, bugs/BUG_20260908_tuning_and_its_paired_quantity_never_solve_each_other.md):
// the tuning ↔ vent-length relation is now wired into `OpenISDProject#resolve()`, run
// synchronously by every `.set()`/`.clear()` `enterVentField`/`clearVentField` make. The record
// can hold only ONE stated target per pair at a time — entering either member atomically clears
// the other's entered fact and lets the solver re-derive it — so an "over-determined" pair
// (both members simultaneously 'entered' and contradictory) can no longer occur BY DESIGN; the
// old test asserting that state persisted is gone, replaced below.
describe('vent group — notifyVentChanged() re-derives the calculated member', () => {
  let p: ReturnType<typeof ventedProject>;
  beforeEach(() => { resetVentGroupState(); p = ventedProject(); });

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
    const lenBefore = p.box.vented.vent.length_m.value;
    p.box.vented.vent.diameter_m.set(0.07);
    notifyVentChanged(p);
    assert.equal(p.box.vented.tuning_goal_hz.value, 40, 'an entered tuning must never be rewritten by the solver');
    assert.notEqual(p.box.vented.vent.length_m.value, lenBefore, 'the length must absorb the diameter change');
  });

  it('the reverse direction is the same solver: enter the length, the tuning is solved', () => {
    clearVentFieldOn(p, 'Fb');
    enterVentFieldOn(p, 'ventL', 0.154);
    p.box.vented.vent.diameter_m.set(0.07);
    notifyVentChanged(p);
    assert.equal(p.box.vented.vent.length_m.value, 0.154, 'an entered length must never be rewritten');
    assert.notEqual(p.box.vented.tuning_goal_hz.value, 40, 'now the TUNING absorbs the diameter change');
  });

  it('entering a new length target retires the old tuning target, not just adds to it', () => {
    // Same relation the reverse-direction test above proves — entering ventL always displaces
    // whatever was previously the pair's stated target, even one as far off as 0.999 m.
    enterVentFieldOn(p, 'ventL', 0.999);
    p.box.vented.vent.diameter_m.set(0.07);
    notifyVentChanged(p);
    assert.equal(p.box.vented.vent.length_m.value, 0.999, 'the entered length is held exactly');
    assert.equal(p.box.vented.tuning_goal_hz.calculated, true, 'the domain re-derives tuning, not the UI');
    assert.notEqual(p.box.vented.tuning_goal_hz.value, 40, 'the old entered tuning target is gone, not held alongside it');
  });
});
