/**
 * The flat "box, vent, PR" field accessors — `activeVent`, `boxVolume_m3`, `boxTuning_Fb_hz`,
 * `passiveRadiatorOrDefault`, `ensurePassiveRadiator`.
 *
 * These exist so `state.P.Vb`/`state.P.ventD`/`state.P.Fb`/`state.P.pr*` can become accessor
 * PROPERTIES over `OpenISDBox` (ledger QO54) instead of an independent flat bag — the box is
 * the single source of truth, `state.P` becomes a VIEW. `useVentGroup.ts`/`usePrGroup.ts` and
 * every UI call site keep reading `state.P.Vb` unchanged; only what backs it moves.
 *
 * Two rules these pin, both from the field's WinISD-era flat-bag behaviour:
 *   - `Vb`/vent-shape/`Fb` are ACTIVE-ALIGNMENT-DEPENDENT for bandpass4 (front vs rear chamber)
 *     and otherwise always address the VENTED alignment — even while sealed or PR is active,
 *     so a vent can be pre-configured before switching to it (ARCHITECTURE.md "switching box
 *     type deletes nothing").
 *   - PR fields always address `passiveRadiator`, regardless of which alignment is active.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import {
  prototypeBox, activeVent, boxVolume_m3, setBoxVolume_m3,
  boxTuning_Fb_hz, setBoxTuning_Fb_hz, passiveRadiatorOrDefault, ensurePassiveRadiator,
} from '../src/openisdProject.js';
import type { OpenISDBox } from '../src/openisdProject.js';

describe('activeVent — which vent state.P\'s flat fields address', () => {
  it('targets the vented alignment\'s own vent when vented is active', () => {
    const box = prototypeBox();
    box.active = 'vented';
    box.vented.vent.diameter_m = 0.09;
    assert.equal(activeVent(box), box.vented.vent);
  });

  it('targets bandpass4\'s FRONT vent when bandpass4 is active, not the vented alignment\'s', () => {
    const box = prototypeBox();
    box.active = 'bandpass4';
    box.bandpass4.frontVent.diameter_m = 0.07;
    box.vented.vent.diameter_m = 0.09;
    assert.equal(activeVent(box), box.bandpass4.frontVent);
  });

  it('while sealed is active, still targets the DORMANT vented vent — pre-configurable, not gone', () => {
    const box = prototypeBox();
    box.active = 'sealed';
    box.vented.vent.diameter_m = 0.055;
    assert.equal(activeVent(box).diameter_m, 0.055,
      'a vent typed in before switching away from vented must stay reachable through the ' +
      'same flat field, or "switching box type deletes nothing" only holds for reads a ' +
      'human happens to make through the Dimensions tab and not through the live UI fields');
  });

  it('while passive-radiator is active, still targets the dormant vented vent', () => {
    const box = prototypeBox();
    box.active = 'passive-radiator';
    box.vented.vent.length_m = 0.21;
    assert.equal(activeVent(box).length_m, 0.21);
  });

  it('is a LIVE reference — writing through it mutates the box', () => {
    const box = prototypeBox();
    box.active = 'vented';
    activeVent(box).diameter_m = 0.11;
    assert.equal(box.vented.vent.diameter_m, 0.11);
  });
});

describe('boxVolume_m3 / setBoxVolume_m3 — Vb per active alignment', () => {
  const cases: Array<[OpenISDBox['active'], (b: OpenISDBox) => number]> = [
    ['sealed', b => b.sealed.volume_m3],
    ['vented', b => b.vented.volume_m3],
    ['bandpass4', b => b.bandpass4.rearVolume_m3],
    ['passive-radiator', b => b.passiveRadiator.volume_m3],
  ];

  for (const [active, read] of cases) {
    it(`reads and writes ${active}'s own volume`, () => {
      const box = prototypeBox();
      box.active = active;
      setBoxVolume_m3(box, 0.033);
      assert.equal(read(box), 0.033);
      assert.equal(boxVolume_m3(box), 0.033);
    });
  }

  it('bandpass4\'s Vb is the REAR chamber — the front chamber is a separate field (Vf)', () => {
    const box = prototypeBox();
    box.active = 'bandpass4';
    box.bandpass4.frontVolume_m3 = 0.02;
    setBoxVolume_m3(box, 0.05);
    assert.equal(box.bandpass4.rearVolume_m3, 0.05);
    assert.equal(box.bandpass4.frontVolume_m3, 0.02, 'Vb must not touch the front chamber');
  });

  it('switching active alignment does not touch the volume left behind', () => {
    const box = prototypeBox();
    box.active = 'vented';
    setBoxVolume_m3(box, 0.04);
    box.active = 'sealed';
    setBoxVolume_m3(box, 0.02);
    assert.equal(box.vented.volume_m3, 0.04, 'the vented volume must survive the switch');
    assert.equal(box.sealed.volume_m3, 0.02);
  });
});

describe('boxTuning_Fb_hz / setBoxTuning_Fb_hz — Fb, same active/vented/bandpass4 split as the vent', () => {
  it('addresses vented.Fb_hz when vented is active', () => {
    const box = prototypeBox();
    box.active = 'vented';
    setBoxTuning_Fb_hz(box, 32);
    assert.equal(box.vented.Fb_hz, 32);
  });

  it('addresses bandpass4.Ff_hz when bandpass4 is active — Fb IS the front tuning there', () => {
    const box = prototypeBox();
    box.active = 'bandpass4';
    setBoxTuning_Fb_hz(box, 58);
    assert.equal(box.bandpass4.Ff_hz, 58);
  });

  it('while sealed is active, still addresses the dormant vented.Fb_hz', () => {
    const box = prototypeBox();
    box.active = 'sealed';
    setBoxTuning_Fb_hz(box, 40);
    assert.equal(box.vented.Fb_hz, 40);
    assert.equal(boxTuning_Fb_hz(box), 40);
  });
});

describe('passive-radiator field access — always passiveRadiator, whatever is active', () => {
  it('passiveRadiatorOrDefault reads zeros without creating a radiator', () => {
    const box = prototypeBox();
    assert.equal(box.passiveRadiator.radiator, undefined, 'precondition: no radiator chosen yet');
    const ref = passiveRadiatorOrDefault(box.passiveRadiator);
    assert.equal(ref.Sd_m2, 0);
    assert.equal(ref.name, '');
    assert.equal(box.passiveRadiator.radiator, undefined,
      'a READ must never allocate — every reactive re-render calls this');
  });

  it('ensurePassiveRadiator creates one on first write and returns the SAME object on the next call', () => {
    const box = prototypeBox();
    const first = ensurePassiveRadiator(box.passiveRadiator);
    first.Sd_m2 = 0.005;
    const second = ensurePassiveRadiator(box.passiveRadiator);
    assert.equal(second, first, 'a second ensure must not silently replace what was just set');
    assert.equal(second.Sd_m2, 0.005);
  });

  it('count and added mass live directly on the alignment, not inside the radiator', () => {
    const box = prototypeBox();
    box.passiveRadiator.count = 2;
    box.passiveRadiator.addedMass_kg = 0.012;
    assert.equal(box.passiveRadiator.radiator, undefined,
      'count/addedMass must be settable with no radiator chosen — they describe the ' +
      'ALIGNMENT (how many, how much mass), not the component');
  });

  it('PR fields ignore box.active — they never move to another alignment', () => {
    const box = prototypeBox();
    ensurePassiveRadiator(box.passiveRadiator).Sd_m2 = 0.006;
    box.active = 'sealed';
    assert.equal(passiveRadiatorOrDefault(box.passiveRadiator).Sd_m2, 0.006,
      'a passive radiator definition is not lost or hidden by switching to another alignment');
  });
});
