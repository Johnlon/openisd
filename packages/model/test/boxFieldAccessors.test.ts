/**
 * The box's field-addressing semantics, through `OpenISDProject`'s own accessors — which slot
 * `Vb`/`Fb`/the vent fields target per active alignment, and that DORMANT alignments stay
 * reachable and intact (ARCHITECTURE.md, "Switching box type DELETES NOTHING": a user who
 * flips a ported box to sealed to compare has NOT asked to lose their port work).
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { OpenISDProject } from '../src/openisdProject.js';

describe('ventField — which vent the flat fields address', () => {
  it('targets the vented alignment\'s own port while vented is active', () => {
    const p = OpenISDProject.empty();
    p.setAlignment('vented');
    p.setVentField('diameter_m', 0.09);
    assert.equal(p.ventField('diameter_m'), 0.09);
    assert.equal(p.vent(0)!.diameter_m, 0.09);
  });

  it('targets bandpass4\'s FRONT port while bandpass4 is active, not the vented alignment\'s', () => {
    const p = OpenISDProject.empty();
    p.setAlignment('vented');
    p.setVentField('diameter_m', 0.09);
    p.setAlignment('bandpass4');
    p.setVentField('diameter_m', 0.07);
    assert.equal(p.ventField('diameter_m'), 0.07);
    p.setAlignment('vented');
    assert.equal(p.ventField('diameter_m'), 0.09, 'the vented port must be untouched');
  });

  it('while sealed is active, still targets the DORMANT vented port — pre-configurable, not gone', () => {
    const p = OpenISDProject.empty();
    p.setAlignment('vented');
    p.setVentField('diameter_m', 0.055);
    p.setAlignment('sealed');
    assert.equal(p.ventField('diameter_m'), 0.055,
      'a port typed in before switching away from vented must stay reachable through the '
      + 'same flat field');
    p.setVentField('length_m', 0.21);
    p.setAlignment('vented');
    assert.equal(p.ventField('length_m'), 0.21, 'and writable while dormant');
  });
});

describe('volume_m3 — Vb per active alignment', () => {
  it('reads and writes each alignment\'s own volume, and they never bleed', () => {
    const p = OpenISDProject.empty();
    for (const [kind, v] of [['sealed', 0.021], ['vented', 0.037], ['bandpass4', 0.019], ['passive-radiator', 0.052]] as const) {
      p.setAlignment(kind);
      p.set('Vb', v);
    }
    for (const [kind, v] of [['sealed', 0.021], ['vented', 0.037], ['bandpass4', 0.019], ['passive-radiator', 0.052]] as const) {
      p.setAlignment(kind);
      assert.equal(p.cell('Vb').value, v, `${kind}'s own volume must survive the round trip`);
    }
  });

  it('bandpass4\'s Vb is the REAR chamber — the front chamber is its own field (Vf)', () => {
    const p = OpenISDProject.empty();
    p.setAlignment('bandpass4');
    p.set('Vf', 0.02);
    p.set('Vb', 0.05);
    assert.equal(p.cell('Vb').value, 0.05);
    assert.equal(p.cell('Vf').value, 0.02, 'Vf untouched by a Vb write');
  });
});

describe('tuning_Fb_hz — Fb per active alignment', () => {
  it('addresses bandpass4\'s front tuning while bandpass4 is active', () => {
    const p = OpenISDProject.empty();
    p.setAlignment('bandpass4');
    p.set('Fb', 58);
    assert.equal(p.cell('Fb').value, 58);
  });

  it('while sealed is active, still addresses the dormant vented tuning', () => {
    const p = OpenISDProject.empty();
    p.setAlignment('sealed');
    p.set('Fb', 40);
    assert.equal(p.cell('Fb').value, 40);
    p.setAlignment('vented');
    assert.equal(p.cell('Fb').value, 40, 'the same slot the sealed-active write addressed');
  });
});

describe('switching alignment deletes nothing — the whole box, field by field', () => {
  it('a ported box flipped away and back reads back identically', () => {
    const p = OpenISDProject.empty();
    p.setAlignment('vented');
    p.set('Vb', 0.037);
    p.set('Fb', 33.5);
    p.setVentField('diameter_m', 0.081);
    p.setVentField('length_m', 0.194);
    p.setVentField('endCorrection', 0.613);
    p.setVentField('shape', 'slotted');
    p.setVentField('width_m', 0.12);
    p.setVentField('height_m', 0.04);
    for (const kind of ['sealed', 'bandpass4', 'passive-radiator', 'vented'] as const) p.setAlignment(kind);
    assert.equal(p.cell('Vb').value, 0.037);
    assert.equal(p.cell('Fb').value, 33.5);
    assert.equal(p.ventField('diameter_m'), 0.081);
    assert.equal(p.ventField('length_m'), 0.194);
    assert.equal(p.ventField('endCorrection'), 0.613);
    assert.equal(p.ventField('shape'), 'slotted');
    assert.equal(p.ventField('width_m'), 0.12);
    assert.equal(p.ventField('height_m'), 0.04);
  });
});

describe('passive-radiator access — always the PR alignment, whatever is active', () => {
  it('prField reads defaults without creating a radiator — a READ must never allocate', () => {
    const p = OpenISDProject.empty();
    assert.equal(p.prChosen(), false, 'precondition: no radiator chosen yet');
    assert.equal(p.prField('Sd_m2'), 0);
    assert.equal(p.prField('name'), '');
    assert.equal(p.prChosen(), false, 'every reactive re-render reads — none may allocate');
  });

  it('the first WRITE creates the radiator, and later writes land on the same one', () => {
    const p = OpenISDProject.empty();
    p.setPrField('Sd_m2', 0.0095);
    assert.equal(p.prChosen(), true);
    p.setPrField('Mmd_kg', 0.05);
    assert.equal(p.prField('Sd_m2'), 0.0095, 'the first write must survive the second');
    assert.equal(p.prField('Mmd_kg'), 0.05);
  });
});
