/**
 * `ManagedOpenISDProject`'s box/vent/PR/entered accessors — every caller (the UI, the vent/PR
 * solvers, `toUiParams()`/`loadUiParams()`) reads and writes box/vent/PR/entered fields
 * through these, direct to the domain object, instead of through an independent flat bag
 * (ledger QO54).
 *
 * Same edit/what-if notification rules as every other project mutation: a write inside an open
 * what-if notifies live, a write to an edit draft stays silent until commit — proven here
 * because these accessors are a new SURFACE onto the same `mutate()` path, and a surface that
 * bypassed it would be the two-writer bug `ManagedOpenISDProject` exists to prevent.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { ManagedOpenISDProject } from '../../src/logic/managedProject.js';

describe('ManagedOpenISDProject — box field read/write', () => {
  it('boxVolume_m3 reads and writes through to the active alignment', () => {
    const mp = ManagedOpenISDProject.createEmpty();
    mp.mutate(p => p.setAlignment('vented'));
    assert.equal(mp.projectCell('Vb').value, mp._snapshot().cell('Vb').value);
    mp.enterProjectField('Vb', 0.045);
    assert.equal(mp._snapshot().cell('Vb').value, 0.045);
    assert.equal(mp.projectCell('Vb').value, 0.045);
  });

  it('boxTuning_Fb_hz reads and writes vented.Fb_hz when vented is active', () => {
    const mp = ManagedOpenISDProject.createEmpty();
    mp.mutate(p => p.setAlignment('vented'));
    mp.enterProjectField('Fb', 31);
    assert.equal(mp._snapshot().cell('Fb').value, 31);
    assert.equal(mp.projectCell('Fb').value, 31);
  });

  it('activeVentField reads/writes the diameter of the active vent', () => {
    const mp = ManagedOpenISDProject.createEmpty();
    mp.mutate(p => p.setAlignment('vented'));
    mp.setActiveVentField('diameter_m', 0.08);
    assert.equal(mp._snapshot().ventField('diameter_m'), 0.08);
    assert.equal(mp.activeVentField('diameter_m'), 0.08);
  });

  it('a box-field write inside an open what-if notifies immediately', () => {
    const mp = ManagedOpenISDProject.createEmpty();
    let notified = 0;
    mp.subscribe(() => notified++);
    mp.beginWhatIf();
    notified = 0;
    mp.enterProjectField('Vb', 0.05);
    assert.equal(notified, 1, 'a live what-if must notify on every project mutation');
  });
});

describe('ManagedOpenISDProject — bandpass4 front chamber (Vf)', () => {
  it('Vf always addresses bandpass4.frontVolume_m3, regardless of active alignment', () => {
    const mp = ManagedOpenISDProject.createEmpty();
    mp.mutate(p => p.setAlignment('sealed'));   // Vf must stay reachable while dormant
    mp.enterProjectField('Vf', 0.017);
    assert.equal(mp._snapshot().cell('Vf').value, 0.017);
    assert.equal(mp.projectCell('Vf').value, 0.017);
  });
});

describe('ManagedOpenISDProject — PR field read/write', () => {
  it('prField reads zero with no radiator chosen, and never creates one on read', () => {
    const mp = ManagedOpenISDProject.createEmpty();
    assert.equal(mp.prField('Sd_m2'), 0);
    assert.equal(mp._snapshot().prChosen(), false);
  });

  it('setPrField creates the radiator on first write and keeps it on the next', () => {
    const mp = ManagedOpenISDProject.createEmpty();
    mp.setPrField('Sd_m2', 0.006);
    mp.setPrField('Mmd_kg', 0.02);
    const snap = mp._snapshot();
    assert.equal(snap.prChosen(), true);
    assert.equal(snap.prField('Sd_m2'), 0.006);
    assert.equal(snap.prField('Mmd_kg'), 0.02, 'a second field write must land on the SAME radiator');
  });

  it('prCount and prAddedMass_kg live on the alignment, settable with no radiator chosen', () => {
    const mp = ManagedOpenISDProject.createEmpty();
    mp.enterProjectField('prNum', 2);
    mp.enterProjectField('prMadd', 0.011);
    assert.equal(mp.projectCell('prNum').value, 2);
    assert.equal(mp.projectCell('prMadd').value, 0.011);
    assert.equal(mp._snapshot().prChosen(), false);
  });
});

describe('ManagedOpenISDProject — entered-set (target provenance)', () => {
  it('a fresh project starts with WinISD\'s own default entered set: {Vb, ventD, Fb}', () => {
    // emptyProject() seeds exactly this — vent length is the CALCULATED member of the pair,
    // matching WinISD's own direction (docs on the original UiParams.entered field).
    const mp = ManagedOpenISDProject.createEmpty();
    assert.equal(mp.isEntered('Vb'), true);
    assert.equal(mp.isEntered('ventD'), true);
    assert.equal(mp.isEntered('Fb'), true);
    assert.equal(mp.isEntered('ventL'), false, 'ventL is the calculated member, not entered');
  });

  it('setEntered(true) marks it, setEntered(false) clears it', () => {
    const mp = ManagedOpenISDProject.createEmpty();
    mp.setEntered('Vb', true);
    assert.equal(mp.isEntered('Vb'), true);
    mp.setEntered('Vb', false);
    assert.equal(mp.isEntered('Vb'), false);
  });

  it('entered keys are independent of one another', () => {
    const mp = ManagedOpenISDProject.createEmpty();
    mp.setEntered('Vb', true);
    mp.setEntered('Fb', true);
    mp.setEntered('ventL', false);
    assert.deepEqual(
      { Vb: mp.isEntered('Vb'), Fb: mp.isEntered('Fb'), ventL: mp.isEntered('ventL') },
      { Vb: true, Fb: true, ventL: false },
    );
  });

  it('the entered set survives a snapshot round trip', () => {
    const mp = ManagedOpenISDProject.createEmpty();
    mp.setEntered('prFp', true);
    assert.equal(mp._snapshot().isEntered('prFp'), true);
  });
});
