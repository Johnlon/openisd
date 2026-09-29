/**
 * The New-Project wizard's questions about a driver, answered by the driver itself: EBP and
 * its suitability, the Qtc a sealed volume gives, the sealed volume a Qtc needs, and the vented
 * design for an alignment. Null whenever the spec the answer needs is not resolved.
 */
import {describe, expect, it} from 'vitest';
import {OpenISDDriver} from '../../domain/index.js';
import {createEngine} from '../../engine/index.js';

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

  it('sealedQtc(volume) and sealedVolumeForQtc(target) match the engine', () => {
    const d = driver();
    expect(d.sealedQtc(0.03)).toBe(engine.sealed.qtcFromVolume(Qts, 0.02, 0.03));
    expect(d.sealedVolumeForQtc(0.707)).toBe(engine.sealed.volumeForQtc(Qts, 0.02, 0.707));
    expect(d.sealedQtc(0)).toBeNull();
    expect(OpenISDDriver.empty(createEngine()).sealedQtc(0.03)).toBeNull();
    expect(OpenISDDriver.empty(createEngine()).sealedVolumeForQtc(0.707)).toBeNull();
  });

  it('ventedDesign(alignment, Rs, Ql) designs for the source-loaded Qts', () => {
    const d = driver();
    const loaded = d.sourceLoadedQts(2)!;
    expect(d.ventedDesign('bb4', 2, 10)).toEqual(engine.vented.alignment('bb4', 40, loaded, 0.02, 10));
    expect(OpenISDDriver.empty(createEngine()).ventedDesign('bb4', 2, 10)).toBeNull();
  });
});
