/**
 * The New-Project wizard's questions about a driver, answered by the driver itself: EBP and
 * its suitability, the Qtc a sealed volume gives, the sealed volume a Qtc needs, and the vented
 * design for an alignment. Null whenever the spec the answer needs is not resolved.
 */
import {describe, expect, it} from 'vitest';
import {OpenISDDriver} from '../../domain/driver/openISDDriver.js';
import {createEngine} from '../../engine/Engine.js';

function driver(): OpenISDDriver {
  const d = OpenISDDriver.empty(createEngine());
  d.specs.Fs_hz.set(40);
  d.specs.Qes.set(0.4);
  d.specs.Qms.set(4);
  d.specs.Vas_m3.set(0.02);
  d.specs.Re_ohm.set(6.4);
  d.specs.Sd_m2.set(0.02);
  return d;
}

describe('OpenISDDriver design queries', () => {
  const engine = createEngine();
  const Qts = 1 / (1 / 4 + 1 / 0.4);

  it('ebp() and ebpSuitability() match the engine', () => {
    const d = driver();
    expect(d.ebp()).toBe(engine.driver.ebp(40, 0.4));
    expect(d.ebpSuitability()).toBe(engine.driver.ebpSuitability(engine.driver.ebp(40, 0.4)));
  });

  it('ebp() is null without Fs or Qes, and for Qes = 0', () => {
    const empty = OpenISDDriver.empty(createEngine());
    expect(empty.ebp()).toBeNull();
    expect(empty.ebpSuitability()).toBeNull();
    const zero = driver();
    zero.specs.Qes.set(0);
    expect(zero.ebp()).toBeNull();
  });

  it('sealedFsc(volume, Rs, losses) is the Fsc of the same sealed resonance as sealedQtc, and null without a volume or specs', () => {
    const d = driver();
    const losses = {Ql: 10, Qa: 100};
    const loaded = d.sourceLoadedQts(0.1)!;
    expect(d.sealedFsc(0.03, 0.1, losses)).toBe(engine.sealed.resonance({Fs: 40, Vas: 0.02, Qts: loaded, Vb: 0.03, ...losses}).Fsc);
    expect(d.sealedFsc(0, 0.1, losses)).toBeNull();
    expect(OpenISDDriver.empty(createEngine()).sealedFsc(0.03, 0.1, losses)).toBeNull();
  });

  it('sealedQtc(volume, Rs, losses) is the lossy Qtc of the source-loaded driver, and sealedVolumeForQtc inverts it', () => {
    const d = driver();
    const losses = {Ql: 10, Qa: 100};
    const loaded = d.sourceLoadedQts(0.1)!;
    expect(d.sealedQtc(0.03, 0.1, losses)).toBe(engine.sealed.resonance({Fs: 40, Vas: 0.02, Qts: loaded, Vb: 0.03, ...losses}).Qtc);
    for (const target of [0.5, 0.707, 1]) {
      const vb = d.sealedVolumeForQtc(target, 0.1, losses);
      expect(vb, `Qtc ${target}`).not.toBeNull();
      expect(d.sealedQtc(vb!, 0.1, losses)).toBeCloseTo(target, 6);
    }
    expect(d.sealedQtc(0, 0.1, losses)).toBeNull();
    expect(d.sealedVolumeForQtc(Qts, 0.1, losses)).toBeNull();
    expect(OpenISDDriver.empty(createEngine()).sealedQtc(0.03, 0.1, losses)).toBeNull();
    expect(OpenISDDriver.empty(createEngine()).sealedVolumeForQtc(0.707, 0.1, losses)).toBeNull();
  });

  it('ventedDesign(alignment, Rs, Ql) designs for the source-loaded Qts', () => {
    const d = driver();
    const loaded = d.sourceLoadedQts(2)!;
    expect(d.ventedDesign('bb4', 2, 10)).toEqual(engine.vented.alignment('bb4', 40, loaded, 0.02, 10));
    expect(OpenISDDriver.empty(createEngine()).ventedDesign('bb4', 2, 10)).toBeNull();
  });
});
