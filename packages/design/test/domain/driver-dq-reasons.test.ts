/**
 * The driver editor's two data-quality strips, answered by the driver itself.
 *
 * `chartBlockingReasons()` — what actually blanks a chart: a quantity the solver cannot derive,
 * or a mandatory field with no value. `inconsistentInputReasons()` — stated values that
 * contradict each other; every value involved exists and every chart plots from the values as
 * stated, so this is a conflict to resolve, not a blocker
 * (BUG_20260924_inconsistent-inputs-claims-charts-blank). The two lists are never merged.
 */
import {describe, expect, it} from 'vitest';
import {OpenISDDriver} from '../../domain/index.js';
import {createEngine} from '../../engine/index.js';

function completeDriver(): OpenISDDriver {
  const driver = OpenISDDriver.empty(createEngine());
  driver.specs.Fs_hz.set(40);
  driver.specs.Qes.set(0.45);
  driver.specs.Qms.set(4);
  driver.specs.Vas_m3.set(0.03);
  driver.specs.Re_ohm.set(6);
  driver.specs.Sd_m2.set(0.02);
  return driver;
}

describe('OpenISDDriver.chartBlockingReasons', () => {
  it('is empty for a complete, consistent driver', () => {
    expect(completeDriver().chartBlockingReasons()).toEqual([]);
  });

  it('names each not-set mandatory field, and not one that is set', () => {
    const driver = OpenISDDriver.empty(createEngine());
    driver.specs.Fs_hz.set(40);
    const reasons = driver.chartBlockingReasons();
    expect(reasons).toContainEqual({subject: 'Vas_m3', text: 'is not set'});
    expect(reasons).toContainEqual({subject: 'Re_ohm', text: 'is not set'});
    expect(reasons).toContainEqual({subject: 'Sd_m2', text: 'is not set'});
    expect(reasons.some(r => r.subject === 'Fs_hz')).toBe(false);
  });

  it('describes a quantity the solver cannot derive by what it still needs', () => {
    const driver = OpenISDDriver.empty(createEngine());
    driver.specs.Fs_hz.set(40);
    driver.specs.Vas_m3.set(0.03);
    driver.specs.Re_ohm.set(6);
    driver.specs.Sd_m2.set(0.02);
    const reasons = driver.chartBlockingReasons();
    expect(reasons.length).toBeGreaterThan(0);
    expect(reasons.every(r => r.text.startsWith('cannot be calculated yet — needs '))).toBe(true);
  });

  it('ignores an inconsistency — every value it names exists, so no chart is blank', () => {
    const driver = completeDriver();
    driver.specs.Qts.set(0.9);
    expect(driver.inconsistentInputReasons().length).toBeGreaterThan(0);
    expect(driver.chartBlockingReasons()).toEqual([]);
  });
});

describe('OpenISDDriver.inconsistentInputReasons', () => {
  it('is empty for a consistent driver', () => {
    expect(completeDriver().inconsistentInputReasons()).toEqual([]);
  });

  it('states the value against what the others imply', () => {
    const driver = completeDriver();
    driver.specs.Qts.set(0.9);
    const reasons = driver.inconsistentInputReasons();
    expect(reasons.some(r => r.subject === 'Qts' && /stated as 0\.9, the others imply /.test(r.text))).toBe(true);
  });

  it('ignores a quantity that merely cannot be derived — that is the chart list\'s business', () => {
    const driver = OpenISDDriver.empty(createEngine());
    driver.specs.Fs_hz.set(40);
    expect(driver.inconsistentInputReasons()).toEqual([]);
  });
});
