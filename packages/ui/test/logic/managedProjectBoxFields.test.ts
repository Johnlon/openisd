/**
 * `ManagedProject`'s box/vent/PR/entered accessors — the seam `state.P` accessor properties
 * (store.ts) delegate to, so `state.P.Vb`/`.ventD`/`.Fb`/`.pr*`/`.entered` become a VIEW over
 * the project instead of an independent flat bag (ledger QO54).
 *
 * Same edit/what-if notification rules as every other project mutation: a write inside an open
 * what-if notifies live, a write to an edit draft stays silent until commit — proven here
 * because these accessors are a new SURFACE onto the same `mutate()` path, and a surface that
 * bypassed it would be the two-writer bug `ManagedProject` exists to prevent.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { ManagedProject } from '../../src/logic/managedProject.js';

describe('ManagedProject — box field read/write', () => {
  it('boxVolume_m3 reads and writes through to the active alignment', () => {
    const mp = ManagedProject.createEmpty();
    mp.mutate(p => { p.box.active = 'vented'; });
    assert.equal(mp.boxVolume_m3(), mp.snapshot().box.vented.volume_m3);
    mp.setBoxVolume_m3(0.045);
    assert.equal(mp.snapshot().box.vented.volume_m3, 0.045);
    assert.equal(mp.boxVolume_m3(), 0.045);
  });

  it('boxTuning_Fb_hz reads and writes vented.Fb_hz when vented is active', () => {
    const mp = ManagedProject.createEmpty();
    mp.mutate(p => { p.box.active = 'vented'; });
    mp.setBoxTuning_Fb_hz(31);
    assert.equal(mp.snapshot().box.vented.Fb_hz, 31);
    assert.equal(mp.boxTuning_Fb_hz(), 31);
  });

  it('activeVentField reads/writes the diameter of the vent state.P.ventD addresses', () => {
    const mp = ManagedProject.createEmpty();
    mp.mutate(p => { p.box.active = 'vented'; });
    mp.setActiveVentField('diameter_m', 0.08);
    assert.equal(mp.snapshot().box.vented.vent.diameter_m, 0.08);
    assert.equal(mp.activeVentField('diameter_m'), 0.08);
  });

  it('a box-field write inside an open what-if notifies immediately', () => {
    const mp = ManagedProject.createEmpty();
    let notified = 0;
    mp.subscribe(() => notified++);
    mp.beginWhatIf();
    notified = 0;
    mp.setBoxVolume_m3(0.05);
    assert.equal(notified, 1, 'a live what-if must notify on every project mutation');
  });
});

describe('ManagedProject — bandpass4 front chamber (Vf)', () => {
  it('frontVolume_m3 always addresses bandpass4.frontVolume_m3, regardless of active alignment', () => {
    const mp = ManagedProject.createEmpty();
    mp.mutate(p => { p.box.active = 'sealed'; });   // Vf must stay reachable while dormant
    mp.setFrontVolume_m3(0.017);
    assert.equal(mp.snapshot().box.bandpass4.frontVolume_m3, 0.017);
    assert.equal(mp.frontVolume_m3(), 0.017);
  });
});

describe('ManagedProject — PR field read/write', () => {
  it('prField reads zero with no radiator chosen, and never creates one on read', () => {
    const mp = ManagedProject.createEmpty();
    assert.equal(mp.prField('Sd_m2'), 0);
    assert.equal(mp.snapshot().box.passiveRadiator.radiator, undefined);
  });

  it('setPrField creates the radiator on first write and keeps it on the next', () => {
    const mp = ManagedProject.createEmpty();
    mp.setPrField('Sd_m2', 0.006);
    mp.setPrField('Mmd_kg', 0.02);
    const radiator = mp.snapshot().box.passiveRadiator.radiator;
    assert.ok(radiator);
    assert.equal(radiator!.Sd_m2, 0.006);
    assert.equal(radiator!.Mmd_kg, 0.02, 'a second field write must land on the SAME radiator');
  });

  it('prCount and prAddedMass_kg live on the alignment, settable with no radiator chosen', () => {
    const mp = ManagedProject.createEmpty();
    mp.setPrCount(2);
    mp.setPrAddedMass_kg(0.011);
    assert.equal(mp.prCount(), 2);
    assert.equal(mp.prAddedMass_kg(), 0.011);
    assert.equal(mp.snapshot().box.passiveRadiator.radiator, undefined);
  });
});

describe('ManagedProject — entered-set (target provenance)', () => {
  it('a fresh project starts with WinISD\'s own default entered set: {Vb, ventD, Fb}', () => {
    // emptyProject() seeds exactly this — vent length is the CALCULATED member of the pair,
    // matching WinISD's own direction (docs on the original UiParams.entered field).
    const mp = ManagedProject.createEmpty();
    assert.equal(mp.isEntered('Vb'), true);
    assert.equal(mp.isEntered('ventD'), true);
    assert.equal(mp.isEntered('Fb'), true);
    assert.equal(mp.isEntered('ventL'), false, 'ventL is the calculated member, not entered');
  });

  it('setEntered(true) marks it, setEntered(false) clears it', () => {
    const mp = ManagedProject.createEmpty();
    mp.setEntered('Vb', true);
    assert.equal(mp.isEntered('Vb'), true);
    mp.setEntered('Vb', false);
    assert.equal(mp.isEntered('Vb'), false);
  });

  it('entered keys are independent of one another', () => {
    const mp = ManagedProject.createEmpty();
    mp.setEntered('Vb', true);
    mp.setEntered('Fb', true);
    mp.setEntered('ventL', false);
    assert.deepEqual(
      { Vb: mp.isEntered('Vb'), Fb: mp.isEntered('Fb'), ventL: mp.isEntered('ventL') },
      { Vb: true, Fb: true, ventL: false },
    );
  });

  it('the entered set survives a snapshot round trip', () => {
    const mp = ManagedProject.createEmpty();
    mp.setEntered('prFp', true);
    assert.equal(mp.snapshot().target.entered.prFp, true);
  });
});
