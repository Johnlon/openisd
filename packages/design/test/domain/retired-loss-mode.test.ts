/**
 * A project saved while the sealed-box loss model was a choice (John, 2026-10-05: removed; the
 * only model is WinISD's lossy one and Ql/Qa control the losses) still loads. The retired
 * `advanced.lossMode` key is read, turned into Ql/Qa where it changed the numbers, dropped, and
 * named as a repair.
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import {OpenISDProject, ProjectBuilder} from '../../domain/index.js';
import {parseOwprSession} from '../../domain/project/projectSerialization.js';
import type {OpenISDProjectJson} from '../../domain/openisdSchema.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';

const engine = createEngine();

function sealedProject(): OpenISDProject {
  const driver = driverFromSpec(engine, {Fs_hz: 30, Qes: 0.4, Qms: 4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Re_ohm: 6});
  const p = new ProjectBuilder(driver, engine).sealed().volume_m3(0.03).build();
  p.box.lossGroupsOf('sealed')[0]!.Ql.set(10);
  p.box.lossGroupsOf('sealed')[0]!.Qa.set(100);
  p.save();
  return p;
}

/** The project's `.owpr` text as an older build wrote it: with `advanced.lossMode` stated. */
function legacyText(lossMode: 'lossless' | 'conventional-lossy' | 'winisd-lossy'): string {
  const parsed = parseOwprSession(sealedProject().toOwprText());
  if ('errors' in parsed) throw new Error(parsed.errors.join('; '));
  const stated = (p: OpenISDProjectJson): OpenISDProjectJson => ({...p, advanced: {...p.advanced, lossMode}});
  const {session} = parsed;
  return JSON.stringify({...session, saved: stated(session.saved), edited: session.edited === null ? null : stated(session.edited)});
}

function load(text: string) {
  const result = OpenISDProject.fromOwprTextRepairing(text, engine);
  if (Array.isArray(result)) throw new Error(result.join('; '));
  return result;
}

describe('a saved lossMode is repaired on load', () => {
  const winisd = sealedProject();
  const ratio = Math.sqrt(1 + winisd.driver.specs.Vas_m3.value! / 0.03);

  it("'lossless' loads with Ql and Qa at the lossless sentinel, giving the textbook Fsc", () => {
    const {project, repaired} = load(legacyText('lossless'));
    const losses = project.box.lossGroupsOf('sealed')[0]!;
    expect(losses.Ql.value).toBe(1e6);
    expect(losses.Qa.value).toBe(1e6);
    expect(project.box.sealed.resonance_hz.value).toBeCloseTo(winisd.driver.specs.Fs_hz.value! * ratio, 9);
    expect(repaired).toContainEqual(['saved', 'advanced', 'lossMode']);
  });

  it("'conventional-lossy' loads as WinISD lossy with the project's own Ql/Qa", () => {
    const {project, repaired} = load(legacyText('conventional-lossy'));
    const losses = project.box.lossGroupsOf('sealed')[0]!;
    expect(losses.Ql.value).toBe(10);
    expect(losses.Qa.value).toBe(100);
    expect(project.box.sealed.resonance_hz.value).toBe(winisd.box.sealed.resonance_hz.value);
    expect(project.box.sealed.q_tc.value).toBe(winisd.box.sealed.q_tc.value);
    expect(repaired).toContainEqual(['saved', 'advanced', 'lossMode']);
  });

  it("'winisd-lossy' loads untouched and needs no note", () => {
    const {project, repaired} = load(legacyText('winisd-lossy'));
    expect(project.box.sealed.resonance_hz.value).toBe(winisd.box.sealed.resonance_hz.value);
    expect(repaired).toEqual([]);
  });

  it('the plain loader also accepts the old key', () => {
    const project = OpenISDProject.fromOwprText(legacyText('lossless'), engine);
    if (Array.isArray(project)) throw new Error(project.join('; '));
    expect(project.box.lossGroupsOf('sealed')[0]!.Ql.value).toBe(1e6);
  });

  it('the writer no longer states lossMode', () => {
    const {project} = load(legacyText('lossless'));
    expect(project.toOwprText()).not.toContain('lossMode');
  });
});
