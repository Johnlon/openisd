/**
 * `OpenISDProject.fromOwprTextRepairing` — a stored project with bad fields loads with those
 * fields reset, and says which (John, 2026-10-01: repair and recover, never reset a whole record).
 * BUG_20261001_one-bad-field-refuses-a-whole-project.
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import {OpenISDProject, ProjectBuilder} from '../../domain/index.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';

const engine = createEngine();

/** A saved sealed project, 30 L, port-velocity limit 25 m/s, as `.owpr` text. */
function savedText(): string {
  const driver = driverFromSpec(engine, {Fs_hz: 30, Qes: 0.4, Qms: 4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Re_ohm: 6});
  const p = new ProjectBuilder(driver, engine).sealed().volume_m3(0.03).build();
  p.portVelocityLimit_m_per_s.set(25);
  p.save();
  return p.toOwprText();
}

describe('OpenISDProject.fromOwprTextRepairing', () => {
  it('a clean project loads with nothing repaired', () => {
    const result = OpenISDProject.fromOwprTextRepairing(savedText(), engine);
    if (Array.isArray(result)) throw new Error(result.join('; '));
    expect(result.repaired).toEqual([]);
  });

  it('a bad field is reset and named; every other field survives', () => {
    const text = savedText();
    const broken = text.replace(/"portVelocityLimit_m_per_s":\s*25/, '"portVelocityLimit_m_per_s": "fast"');
    expect(broken).not.toBe(text);
    expect(Array.isArray(OpenISDProject.fromOwprText(broken, engine))).toBe(true); // the old loader refuses it

    const result = OpenISDProject.fromOwprTextRepairing(broken, engine);
    if (Array.isArray(result)) throw new Error(result.join('; '));
    expect(result.repaired).toEqual([['saved', 'box', 'portVelocityLimit_m_per_s']]);
    expect(result.project.portVelocityLimit_m_per_s.value).toBe(17);   // the field's own default
    expect(result.project.box.sealed.volume_m3.value).toBeCloseTo(0.03, 9); // the design survives
  });

  it('a key the schema does not know is dropped and named', () => {
    const broken = savedText().replace('"saved": {', '"saved": {"notAField": 1,');
    const result = OpenISDProject.fromOwprTextRepairing(broken, engine);
    if (Array.isArray(result)) throw new Error(result.join('; '));
    expect(result.repaired).toEqual([['saved', 'notAField']]);
    expect(result.project.box.sealed.volume_m3.value).toBeCloseTo(0.03, 9);
  });

  it('text that is not a project at all is still refused', () => {
    expect(Array.isArray(OpenISDProject.fromOwprTextRepairing('not json', engine))).toBe(true);
    expect(Array.isArray(OpenISDProject.fromOwprTextRepairing('[1,2]', engine))).toBe(true);
  });
});
