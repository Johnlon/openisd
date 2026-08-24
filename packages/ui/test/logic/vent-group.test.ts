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
 *     different double (docs/design/STATE_MODEL.md rule 3, "Cancel means byte-identical").
 *
 * Numbers come from WinISD 0.7.0.950 itself, Vents tab, Vb=0.02 m³ / Fb=40 Hz / k=0.6:
 * 0.154 m at d=5 cm and 0.318 m at d=7 cm (winisd_research/CALC_FINDINGS_FOR_REVIEW.md).
 */
import { describe, it, beforeEach } from 'vitest';
import assert from 'node:assert/strict';
import { state, applyLoadedProject, managedProject } from '../../src/logic/appState.js';
import {
  solveVentGroup, enterVentField as enterVentFieldOn, clearVentField as clearVentFieldOn,
  ventFieldState as ventFieldStateOn,
} from '../../src/logic/useVentGroup.js';
import { createProjectRepo, createMemoryStorage, type FileStorage } from '@openisd/persistence';
import { projectSchema } from '../../src/logic/schemaUpgrade.js';

/** A real repo, memory-backed — the restore tests below go through its actual read pipeline
 *  (schema upgrade, old-schema vent-field repair, `OpenISDProject` reconstruction) rather than
 *  hand-building a project, because that pipeline is exactly what is under test. */
const neverPicksAFile: FileStorage = {
  save: async () => ({ name: null, cancelled: true, written: false }),
  saveAs: async () => ({ name: null, cancelled: true, written: false }),
  openFileName: () => null,
  forget: () => {},
};
const restoreRepo = createProjectRepo(createMemoryStorage(), projectSchema, neverPicksAFile);

function enterVentField(field: Parameters<typeof enterVentFieldOn>[1], value: number): void {
  enterVentFieldOn(managedProject, field, value, state.box);
}
function clearVentField(field: Parameters<typeof clearVentFieldOn>[1]): void {
  clearVentFieldOn(managedProject, field, state.box);
}
function ventFieldState(field: Parameters<typeof ventFieldStateOn>[1]): 'E' | 'C' | 'N' {
  return ventFieldStateOn(managedProject, field, state.box);
}
function ventL(): number { return managedProject.activeVentField('length_m'); }

/** WinISD's own Vents-tab trial. */
function winisdVentsTrial(): void {
  managedProject.setBoxVolume_m3(0.02);
  managedProject.setActiveVentField('diameter_m', 0.05);
  managedProject.setActiveVentField('endCorrection', 0.6);
  managedProject.setEnteredSet({ Vb: true, ventD: true, Fb: true });
  enterVentField('Fb', 40);
}

describe('vent group — the entered set decides the direction', () => {
  beforeEach(() => {
    managedProject.setEnteredSet({ Vb: true, ventD: true, Fb: true });
  });

  it('ships WinISD\'s direction: Vb/ventD/Fb entered, vent length calculated', () => {
    assert.equal(ventFieldState('Fb'), 'E');
    assert.equal(ventFieldState('ventL'), 'C');
  });

  it('reproduces WinISD\'s own published vent lengths to within display rounding', () => {
    winisdVentsTrial();
    assert.ok(Math.abs(ventL() - 0.154) < 0.001,
      `d=5cm → ${ventL().toFixed(4)} m, WinISD shows 0.154`);

    managedProject.setActiveVentField('diameter_m', 0.07);
    solveVentGroup(managedProject, state.box);
    assert.ok(Math.abs(ventL() - 0.318) < 0.001,
      `d=7cm → ${ventL().toFixed(4)} m, WinISD shows 0.318`);
  });

  it('THE DIRECTION TEST — changing vent diameter holds the tuning and moves the length', () => {
    winisdVentsTrial();
    const lenBefore = ventL();

    managedProject.setActiveVentField('diameter_m', 0.07);
    solveVentGroup(managedProject, state.box);

    assert.equal(managedProject.boxTuning_Fb_hz(), 40, 'an entered tuning must never be rewritten by the solver');
    assert.notEqual(ventL(), lenBefore, 'the length must absorb the diameter change');
  });

  it('the reverse direction is the same solver: enter the length, the tuning is solved', () => {
    winisdVentsTrial();
    clearVentField('Fb');
    enterVentField('ventL', 0.154);

    assert.equal(ventFieldState('ventL'), 'E');
    assert.equal(ventFieldState('Fb'), 'C');

    managedProject.setActiveVentField('diameter_m', 0.07);
    solveVentGroup(managedProject, state.box);
    assert.equal(ventL(), 0.154, 'an entered length must never be rewritten');
    assert.notEqual(managedProject.boxTuning_Fb_hz(), 40, 'now the TUNING absorbs the diameter change');
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

    managedProject.setActiveVentField('diameter_m', 0.07);
    solveVentGroup(managedProject, state.box);
    assert.equal(managedProject.boxTuning_Fb_hz(), 40, 'entered values are held even when they contradict');
    assert.equal(ventL(), 0.999);
  });
});

describe('vent group — a restore is adopted verbatim', () => {
  it('THE RESTORE TEST — round-tripping through JSON returns bit-identical Fb and ventL', () => {
    managedProject.setBoxVolume_m3(0.02);
    managedProject.setActiveVentField('diameter_m', 0.05);
    managedProject.setActiveVentField('endCorrection', 0.6);
    managedProject.setEnteredSet({ Vb: true, ventD: true, Fb: true });
    enterVentField('Fb', 40);

    // Exactly what persistence does: JSON out, JSON back in, through the REAL repo (the
    // rounding that happens here is what a re-solve on restore would amplify into a different
    // double).
    const saved = JSON.stringify({
      schema: 2, v: 2, box: state.box, P: managedProject.toUiParams(),
      project: { name: '', creator: '', created: '', modified: '', description: '' },
    });
    const fbBefore = managedProject.boxTuning_Fb_hz(), lenBefore = ventL();

    managedProject.setActiveVentField('diameter_m', 0.09);   // drift the live design away
    const restored = restoreRepo.readProjectText(saved);
    assert.ok(restored, 'the just-built payload must load');
    applyLoadedProject(restored!);

    assert.equal(managedProject.boxTuning_Fb_hz(), fbBefore, 'restored tuning must be bit-identical');
    assert.equal(ventL(), lenBefore, 'restored length must be bit-identical');
  });

  it('a design saved before the vent group existed is read as length-entered', () => {
    // No `Fb`, no `entered` — its ventL WAS authoritative, because it was the only direction
    // the app had. Read at the persistence boundary into the one current shape.
    const legacyParams: Record<string, unknown> = {
      ...managedProject.toUiParams(), ventL: 0.154, Vb: 0.02, ventD: 0.05, endCorrection: 0.6,
    };
    delete legacyParams.Fb;
    delete legacyParams.entered;
    const legacy = JSON.stringify({
      schema: 2, v: 2, box: state.box, P: legacyParams,
      project: { name: '', creator: '', created: '', modified: '', description: '' },
    });

    const restored = restoreRepo.readProjectText(legacy);
    assert.ok(restored, 'the just-built payload must load');
    applyLoadedProject(restored!);

    assert.equal(ventFieldState('ventL'), 'E', 'the stored length is the authoritative fact');
    assert.equal(ventFieldState('Fb'), 'C', 'and the tuning is solved from it');
    assert.ok(managedProject.boxTuning_Fb_hz() > 39 && managedProject.boxTuning_Fb_hz() < 41,
      `tuning solved from the stored geometry → ${managedProject.boxTuning_Fb_hz().toFixed(2)} Hz, expected ≈40`);
  });
});
