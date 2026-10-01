/**
 * `OpenISDProject.portVelocityLimit_m_per_s` — the port air velocity the port-velocity charts draw
 * as their limit line. Per project (John, 2026-10-01), default 17 m/s; a project saved before the
 * field existed reads as 17. Whether WinISD has such a setting is unverified.
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import {OpenISDProject, ProjectBuilder} from '../../domain/index.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';

const engine = createEngine();
function vented() {
  const driver = driverFromSpec(engine, {Fs_hz: 30, Qes: 0.4, Qms: 4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Re_ohm: 6});
  return new ProjectBuilder(driver, engine).sealed().volume_m3(0.03).build();
}

describe('OpenISDProject.portVelocityLimit_m_per_s', () => {
  it('defaults to 17 m/s', () => {
    expect(vented().portVelocityLimit_m_per_s.value).toBe(17);
  });

  it('a set value survives an .owpr round trip', () => {
    const p = vented();
    p.portVelocityLimit_m_per_s.set(25);
    p.save();
    const back = OpenISDProject.fromOwprText(p.toOwprText(), engine);
    if (Array.isArray(back)) throw new Error(back.join('; '));
    expect(back.portVelocityLimit_m_per_s.value).toBe(25);
  });

  it('a project saved before the field existed reads as 17 m/s', () => {
    const p = vented();
    const text = p.toOwprText();
    expect(text).not.toMatch(/portVelocityLimit/);
    const back = OpenISDProject.fromOwprText(text, engine);
    if (Array.isArray(back)) throw new Error(back.join('; '));
    expect(back.portVelocityLimit_m_per_s.value).toBe(17);
  });
});
