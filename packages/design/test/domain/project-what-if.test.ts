/**
 * The project's What-if layer (docs/design/STATE_MODEL.md rule 3): a write while a What-if is
 * open changes the swept curve, but never the committed design, the unsaved-changes flag or the
 * persisted session; ending the What-if puts the curve back.
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import {type FrequencyGrid, ProjectBuilder} from '../../domain/index.js';
import {driverFrom, whatIfSpec} from '../fixtures/domainBuilders.js';

const GRID: FrequencyGrid = { fmin: 10, fmax: 1000, N: 50 };

function savedSealedProject() {
  const project = new ProjectBuilder(driverFrom({
    brand: 'Dayton', model: 'RS225', section: 'woofer',
    spec: whatIfSpec({ Fs_hz: 30, Vas_m3: 0.03, Qes: 0.4, Qms: 7.0, Re_ohm: 5.6 }),
  }), createEngine()).sealed().volume_m3(0.03).build();
  const w = project.driver.specs;
  w.Sd_m2.set(0.0133);
  w.Le_H.set(0.70e-3);
  w.Xmax_m.set(0.0050);
  w.Pe_W.set(60);
  project.save();
  return project;
}

function splOf(project: ReturnType<typeof savedSealedProject>): readonly number[] {
  const result = project.sweep(GRID);
  const spl = result.values?.spl;
  if (spl === undefined) throw new Error(`the project did not sweep: ${JSON.stringify(result.issues)}`);
  return spl;
}

describe('OpenISDProject What-if layer', () => {
  it('a What-if write changes the swept curve but not the project, its unsaved flag or its session', () => {
    const project = savedSealedProject();
    const curve = splOf(project);
    const session = JSON.stringify(project.cloneSession());

    project.beginWhatIf();
    project.box.sealed.volume_m3.set(0.06);

    expect(splOf(project)).not.toEqual(curve);
    expect(project.isModified()).toBe(false);
    expect(JSON.stringify(project.cloneSession())).toBe(session);
    expect(project.committedSnapshot().box.sealed.volume_m3.value).toBe(0.03);
  });

  it('ending the What-if restores the project values and the curve', () => {
    const project = savedSealedProject();
    const curve = splOf(project);

    project.beginWhatIf();
    project.box.sealed.volume_m3.set(0.06);
    project.driver.specs.Fs_hz.set(45);
    project.cancelWhatIf();

    expect(project.box.sealed.volume_m3.value).toBe(0.03);
    expect(project.driver.specs.Fs_hz.value).toBe(30);
    expect(project.isModified()).toBe(false);
    expect(splOf(project)).toEqual(curve);
  });

  it('a write with no What-if open is an ordinary edit', () => {
    const project = savedSealedProject();
    project.box.sealed.volume_m3.set(0.06);
    expect(project.isModified()).toBe(true);
  });
});
