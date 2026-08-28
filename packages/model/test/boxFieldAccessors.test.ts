/**
 * The box's field-addressing semantics, through `OpenISDProject`'s own accessors — which slot
 * `Vb`/`Fb`/the vent fields target per active box type, and that DORMANT box types stay
 * reachable and intact (ARCHITECTURE.md, "Switching box type DELETES NOTHING": a user who
 * flips a ported box to sealed to compare has NOT asked to lose their port work).
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { OpenISDProject } from '../src/openisdProject.js';
import { OpenISDDriver } from '../src/openisdDriver.js';

describe('ventDiameter_m — which vent the flat fields address', () => {
  it('targets the vented box type\'s own port while vented is active', () => {
    const p = OpenISDProject.empty(OpenISDDriver.empty());
    p.setBoxType('vented');
    p.setVentDiameter_m(0.09);
    assert.equal(p.ventDiameter_m(), 0.09);
    assert.equal(p.vent(0)!.diameter_m, 0.09);
  });

  it('targets bandpass4\'s FRONT port while bandpass4 is active, not the vented box type\'s', () => {
    const p = OpenISDProject.empty(OpenISDDriver.empty());
    p.setBoxType('vented');
    p.setVentDiameter_m(0.09);
    p.setBoxType('bandpass4');
    p.setVentDiameter_m(0.07);
    assert.equal(p.ventDiameter_m(), 0.07);
    p.setBoxType('vented');
    assert.equal(p.ventDiameter_m(), 0.09, 'the vented port must be untouched');
  });

  it('while sealed is active, still targets the DORMANT vented port — pre-configurable, not gone', () => {
    const p = OpenISDProject.empty(OpenISDDriver.empty());
    p.setBoxType('vented');
    p.setVentDiameter_m(0.055);
    p.setBoxType('sealed');
    assert.equal(p.ventDiameter_m(), 0.055,
      'a port typed in before switching away from vented must stay reachable through the '
      + 'same flat field');
    p.setVentLength_m(0.21);
    p.setBoxType('vented');
    assert.equal(p.ventLength_m(), 0.21, 'and writable while dormant');
  });
});

describe('volume_m3 — Vb per active box type', () => {
  it('reads and writes each box type\'s own volume, and they never bleed', () => {
    const p = OpenISDProject.empty(OpenISDDriver.empty());
    for (const [kind, v] of [['sealed', 0.021], ['vented', 0.037], ['bandpass4', 0.019], ['box-passive-radiator', 0.052]] as const) {
      p.setBoxType(kind);
      p.setVolume_m3(v);
    }
    for (const [kind, v] of [['sealed', 0.021], ['vented', 0.037], ['bandpass4', 0.019], ['box-passive-radiator', 0.052]] as const) {
      p.setBoxType(kind);
      assert.equal(p.volume_m3(), v, `${kind}'s own volume must survive the round trip`);
    }
  });

  it('bandpass4\'s Vb is the REAR chamber — the front chamber is its own field (Vf)', () => {
    const p = OpenISDProject.empty(OpenISDDriver.empty());
    p.setBoxType('bandpass4');
    p.setFrontVolume_m3(0.02);
    p.setVolume_m3(0.05);
    assert.equal(p.volume_m3(), 0.05);
    assert.equal(p.frontVolume_m3(), 0.02, 'Vf untouched by a Vb write');
  });
});

describe('tuning_Fb_hz — Fb per active box type', () => {
  it('addresses bandpass4\'s front tuning while bandpass4 is active', () => {
    const p = OpenISDProject.empty(OpenISDDriver.empty());
    p.setBoxType('bandpass4');
    p.setTuning_Fb_hz(58);
    assert.equal(p.tuning_Fb_hz(), 58);
  });

  it('while sealed is active, still addresses the dormant vented tuning', () => {
    const p = OpenISDProject.empty(OpenISDDriver.empty());
    p.setBoxType('sealed');
    p.setTuning_Fb_hz(40);
    assert.equal(p.tuning_Fb_hz(), 40);
    p.setBoxType('vented');
    assert.equal(p.tuning_Fb_hz(), 40, 'the same slot the sealed-active write addressed');
  });
});

describe('switching box type deletes nothing — the whole box, field by field', () => {
  it('a ported box flipped away and back reads back identically', () => {
    const p = OpenISDProject.empty(OpenISDDriver.empty());
    p.setBoxType('vented');
    p.setVolume_m3(0.037);
    p.setTuning_Fb_hz(33.5);
    p.setVentDiameter_m(0.081);
    p.setVentLength_m(0.194);
    p.setVentEndCorrection(0.613);
    p.setVentShape('slotted');
    p.setVentWidth_m(0.12);
    p.setVentHeight_m(0.04);
    for (const kind of ['sealed', 'bandpass4', 'box-passive-radiator', 'vented'] as const) p.setBoxType(kind);
    assert.equal(p.volume_m3(), 0.037);
    assert.equal(p.tuning_Fb_hz(), 33.5);
    assert.equal(p.ventDiameter_m(), 0.081);
    assert.equal(p.ventLength_m(), 0.194);
    assert.equal(p.ventEndCorrection(), 0.613);
    assert.equal(p.ventShape(), 'slotted');
    assert.equal(p.ventWidth_m(), 0.12);
    assert.equal(p.ventHeight_m(), 0.04);
  });
});

describe('passive-radiator access — always the PR box type, whatever is active', () => {
  it('prSd_m2/prName read defaults without creating a radiator — a READ must never allocate', () => {
    const p = OpenISDProject.empty(OpenISDDriver.empty());
    assert.equal(p.prChosen(), false, 'precondition: no radiator chosen yet');
    assert.equal(p.prSd_m2(), 0);
    assert.equal(p.prName(), '');
    assert.equal(p.prChosen(), false, 'every reactive re-render reads — none may allocate');
  });

  it('the first WRITE creates the radiator, and later writes land on the same one', () => {
    const p = OpenISDProject.empty(OpenISDDriver.empty());
    p.setPrSd_m2(0.0095);
    assert.equal(p.prChosen(), true);
    p.setPrMmd_kg(0.05);
    assert.equal(p.prSd_m2(), 0.0095, 'the first write must survive the second');
    assert.equal(p.prMmd_kg(), 0.05);
  });
});
