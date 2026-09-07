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
 * `OpenISDProject`, `packages/design/domain/openisdDomain.ts`) is a documented stub that throws
 * `not implemented`; tests that need it to run are skipped below rather than forced to pass.
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

function blankDriverRecord(): unknown {
  const bookkeeping = { value: '' };
  return {
    uuid: { value: crypto.randomUUID() },
    quality: {
      confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
    manufacturer: { value: '' }, brand: { value: '' }, model: { value: '' },
    sku: { value: '', grounds: [{ origin: 'entered', reading: '' }] },
    driver_type: { value: '' },
    data_sources: bookkeeping,
    authoritative: bookkeeping,
    specs: {},
  };
}

/** Vb=0.02 m³, round 5 cm vent, k=0.6 — WinISD's own Vents-tab trial. */
function ventedProject() {
  const engine = new Engine();
  const driver = OpenISDDriver.fromConformingRecord(blankDriverRecord(), engine);
  if (Array.isArray(driver)) throw new Error(`blankDriverRecord() does not conform: ${driver.join('; ')}`);
  const p = OpenISDProject.builder(driver, engine).vented().volume_m3(0.02).tuning_hz(40).build();
  p.box.vented.vent.shape.set('round');
  p.box.vented.vent.diameter_m.set(0.05);
  p.box.vented.vent.endCorrection_m.set(0.6);
  return p;
}

describe('vent group — the entered set decides the direction', () => {
  it('ships WinISD\'s direction: tuning entered, vent length calculated', () => {
    const p = ventedProject();
    assert.equal(ventFieldStateOn(p, 'Fb'), 'E');
    assert.equal(ventFieldStateOn(p, 'ventL'), 'C');
  });

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

  it('entering the second of the pair locks it E; clearing it returns it to C', () => {
    const p = ventedProject();
    enterVentFieldOn(p, 'ventL', 0.154);
    assert.equal(ventFieldStateOn(p, 'Fb'), 'E');
    assert.equal(ventFieldStateOn(p, 'ventL'), 'E');

    clearVentFieldOn(p, 'Fb');
    assert.equal(ventFieldStateOn(p, 'Fb'), 'C');
    assert.equal(ventFieldStateOn(p, 'ventL'), 'E');
  });

  it('clearing both of the pair leaves both N — one equation cannot solve two unknowns', () => {
    const p = ventedProject();
    clearVentFieldOn(p, 'Fb');
    clearVentFieldOn(p, 'ventL');
    assert.equal(ventFieldStateOn(p, 'Fb'), 'N');
    assert.equal(ventFieldStateOn(p, 'ventL'), 'N');
  });
});

// The following behavior needs `OpenISDProject.solveVentGroup()`, a documented stub
// (`packages/design/domain/openisdDomain.ts` "ledger 2026-09-06 — STUBS, not yet implemented") that
// throws `not implemented`. Skipped rather than forced to pass — implementing the solver is a
// physics/design decision reserved for the human.
describe.skip('vent group — solveVentGroup() re-derives the calculated member (BLOCKED: stub)', () => {
  let p: ReturnType<typeof ventedProject>;
  beforeEach(() => { p = ventedProject(); });

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
