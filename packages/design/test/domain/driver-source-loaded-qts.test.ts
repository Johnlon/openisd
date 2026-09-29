import { describe, expect, it } from 'vitest';
import { createEngine } from '../../engine/index.js';
import { OpenISDDriver } from '../../domain/index.js';

function driver(): OpenISDDriver {
  const d = OpenISDDriver.empty(createEngine());
  d.specs.Fs_hz.set(40);
  d.specs.Qes.set(0.4);
  d.specs.Qms.set(4);
  d.specs.Vas_m3.set(0.03);
  d.specs.Re_ohm.set(6.4);
  d.specs.Sd_m2.set(0.02);
  return d;
}

describe('OpenISDDriver.sourceLoadedQts', () => {
  const Qts = 1 / (1 / 4 + 1 / 0.4);

  it('is the datasheet Qts for a perfect voltage source', () => {
    expect(driver().sourceLoadedQts(0)!).toBeCloseTo(Qts, 10);
  });

  it('folds a series resistance into Qes', () => {
    const d = driver();
    expect(d.sourceLoadedQts(2)).toBe(createEngine().driver.sourceLoadedQts(4, 0.4, 6.4, 2, Qts));
    expect(d.sourceLoadedQts(2)!).toBeGreaterThan(d.sourceLoadedQts(0)!);
  });

  it('is the bare Qts when Qms/Qes/Re cannot be resolved but Qts is entered', () => {
    const d = OpenISDDriver.empty(createEngine());
    d.specs.Qts.set(0.35);
    expect(d.sourceLoadedQts(2)).toBe(0.35);
  });

  it('is null when Qts cannot be resolved', () => {
    const d = OpenISDDriver.empty(createEngine());
    d.specs.Fs_hz.set(30);
    expect(d.sourceLoadedQts(2)).toBeNull();
  });
});
