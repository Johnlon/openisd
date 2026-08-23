/**
 * `OpenISDBox` — every alignment is held at once, ONE is active, the rest are DORMANT with
 * their data intact (ARCHITECTURE.md, "Switching box type DELETES NOTHING").
 *
 * The rule exists because a user who flips a ported box to sealed to compare alignments has NOT
 * asked to lose their port work. Anything that clears a field on a box-type change is a defect.
 *
 * Seam under test: `setActiveAlignment` and the box shape itself. Nothing here reaches into a
 * private — the whole point is that the type makes the rule structural, so the test can assert
 * it through the public surface.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { prototypeBox, setActiveAlignment } from '../src/openisdProject.js';
import type { OpenISDBox } from '../src/openisdProject.js';

/** A box with EVERY alignment carrying values a human would recognise as their own work, so a
 *  field silently reset to a default is visible as such rather than blending in. */
function boxWithWorkInEveryAlignment(): OpenISDBox {
  const box = prototypeBox();
  box.sealed.volume_m3 = 0.021;
  box.vented.volume_m3 = 0.037;
  box.vented.Fb_hz = 33.5;
  box.vented.vents[0]!.diameter_m = 0.081;
  box.vented.vents[0]!.length_m = 0.194;
  box.vented.vents[0]!.endCorrection = 0.613;
  box.vented.vents[0]!.shape = 'slotted';
  box.vented.vents[0]!.width_m = 0.12;
  box.vented.vents[0]!.height_m = 0.04;
  box.bandpass4.rearVolume_m3 = 0.019;
  box.bandpass4.frontVolume_m3 = 0.044;
  box.bandpass4.Ff_hz = 57.5;
  box.passiveRadiator.volume_m3 = 0.052;
  box.passiveRadiator.Fp_hz = 27.25;
  box.passiveRadiator.addedMass_kg = 0.0335;
  box.passiveRadiator.count = 2;
  return box;
}

describe('OpenISDBox — switching alignment deletes nothing', () => {
  it('a ported box flipped to sealed and back is byte-identical', () => {
    const box = boxWithWorkInEveryAlignment();
    box.active = 'vented';
    const before = JSON.stringify(box.vented);

    setActiveAlignment(box, 'sealed');
    setActiveAlignment(box, 'vented');

    assert.equal(JSON.stringify(box.vented), before,
      'every port field must survive the round trip — the user asked to LOOK at a different ' +
      'alignment, not to lose their work');
  });

  it('switching through every alignment in turn disturbs none of them', () => {
    const box = boxWithWorkInEveryAlignment();
    const before = {
      sealed: JSON.stringify(box.sealed),
      vented: JSON.stringify(box.vented),
      bandpass4: JSON.stringify(box.bandpass4),
      passiveRadiator: JSON.stringify(box.passiveRadiator),
    };

    for (const kind of ['sealed', 'vented', 'bandpass4', 'passive-radiator', 'sealed'] as const) {
      setActiveAlignment(box, kind);
    }

    assert.equal(JSON.stringify(box.sealed), before.sealed);
    assert.equal(JSON.stringify(box.vented), before.vented);
    assert.equal(JSON.stringify(box.bandpass4), before.bandpass4);
    assert.equal(JSON.stringify(box.passiveRadiator), before.passiveRadiator);
  });

  it('the losses are shared, not per-alignment — one set, whichever box is active', () => {
    const box = prototypeBox();
    box.Ql = 7;
    setActiveAlignment(box, 'bandpass4');
    assert.equal(box.Ql, 7,
      'leakage/absorption/port losses describe the ENCLOSURE, so they do not belong to one ' +
      'alignment and must not be reset when another becomes active');
  });

  it('only `active` changes — switching writes nothing else', () => {
    const box = boxWithWorkInEveryAlignment();
    box.active = 'sealed';
    const whole = JSON.parse(JSON.stringify(box));

    setActiveAlignment(box, 'passive-radiator');

    whole.active = 'passive-radiator';
    assert.deepEqual(JSON.parse(JSON.stringify(box)), whole,
      'setActiveAlignment must be a single-field write. If it does anything else, some future ' +
      'edit will make that "anything else" clear a dormant value.');
  });

  it('a fresh box carries every alignment, so none has to be created on first use', () => {
    const box = prototypeBox();
    assert.ok(box.sealed && box.vented && box.bandpass4 && box.passiveRadiator,
      'lazily creating an alignment on first switch is how a default silently overwrites work ' +
      'restored from a file');
    assert.ok(box.vented.vents[0]!, 'the vented alignment owns its vent from the start');
  });
});
