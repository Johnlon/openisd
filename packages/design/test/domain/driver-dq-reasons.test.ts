/**
 * The driver editor's two data-quality strips, answered by the driver itself.
 *
 * `chartBlockingReasons()` — what actually blanks a chart: a quantity the solver cannot derive,
 * or a mandatory field with no value. `inconsistentInputReasons()` — stated values that
 * contradict each other; every value involved exists and every chart plots from the values as
 * stated, so this is a conflict to resolve, not a blocker
 * (BUG_20260924_inconsistent-inputs-claims-charts-blank). The two lists are never merged.
 */
import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {OpenISDDriver} from '../../domain/driver/openISDDriver.js';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {createEngine} from '../../engine/Engine.js';

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
    expect(reasons).toContainEqual({subject: 'equivalent volume (Vas)', text: 'is not set'});
    expect(reasons).toContainEqual({subject: 'coil resistance (Re)', text: 'is not set'});
    expect(reasons).toContainEqual({subject: 'cone area (Sd)', text: 'is not set'});
    expect(reasons.some(r => r.subject === 'resonance (Fs)')).toBe(false);
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
    expect(reasons.some(r => r.subject === 'Qts' && /stated as 0\.9\d*, the others imply .*, .*% apart$/.test(r.text))).toBe(true);
  });

  it('ignores a quantity that merely cannot be derived — that is the chart list\'s business', () => {
    const driver = OpenISDDriver.empty(createEngine());
    driver.specs.Fs_hz.set(40);
    expect(driver.inconsistentInputReasons()).toEqual([]);
  });

  it('reads the issues from a project\'s embedded driver, rebuilt fresh on every access', () => {
    const engine = createEngine();
    const project = new ProjectBuilder(completeDriver(), engine).sealed().volume_m3(0.03).build();
    project.driver.specs.Qts.set(0.9);
    expect(project.driver.inconsistentInputReasons()).toContainEqual(expect.objectContaining({subject: 'Qts'}));
  });

  it('names the field plainly and gives the stated and implied values rounded, with unit and gap (18NW100-4)', () => {
    const record: unknown = JSON.parse(readFileSync(
      new URL('../../../ui/public/drivers/b-c-speakers/18nw100-4.json', import.meta.url), 'utf-8'));
    const driver = OpenISDDriver.fromConformingRecord(record, createEngine());
    if (Array.isArray(driver)) throw new Error(driver.join('; '));
    const reasons = driver.inconsistentInputReasons();
    expect(reasons).toContainEqual({
      subject: 'force factor (BL)',
      text: 'stated as 24.7 Tm, the others imply 26.7 Tm, 7.7% apart',
    });
    expect(reasons).toContainEqual({
      subject: 'resonance (Fs)',
      text: 'stated as 30.0 Hz, the others imply 32.5 Hz, 7.8% apart',
    });
  });
});
