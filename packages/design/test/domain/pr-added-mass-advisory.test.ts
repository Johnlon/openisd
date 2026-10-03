/**
 * The added-mass advisory marks the added-mass field and nothing else in the PR group, whether
 * the mass was typed or solved from a target tuning, and follows the app setting live.
 */
import {describe, expect, it} from 'vitest';
import {
  type AppSettings, createEngine, DEFAULT_ENV_DEFAULTS, DEFAULT_VENTED_DESIGN_LIMITS,
  type EnvDefaults, type VentedDesignLimits,
} from '@openisd/design/engine';
import {type OpenISDProject, ProjectBuilder} from '../../domain/index.js';
import {driverFromSpec, radiatorFromSpec} from '../fixtures/recordBuilders.js';

class Settings implements AppSettings {
  constructor(public alertOn: boolean) {}
  ventedLimits(): VentedDesignLimits { return DEFAULT_VENTED_DESIGN_LIMITS; }
  envDefaults(): EnvDefaults { return DEFAULT_ENV_DEFAULTS; }
  prAddedMassAlert(): boolean { return this.alertOn; }
}

const MMD_KG = 0.0164;

function prProject(settings: Settings): OpenISDProject {
  const engine = createEngine(settings);
  const driver = driverFromSpec(engine, {
    Fs_hz: 30, Qes: 0.4, Qms: 4, Qts: 1 / (1 / 4 + 1 / 0.4), Re_ohm: 6.4,
    Sd_m2: 0.02, Cms_m_per_N: 0.0005, Vas_m3: 0.05, BL_Tm: 8, Mms_kg: 0.05, Xmax_m: 0.008, Pe_W: 100,
  });
  const project = new ProjectBuilder(driver, engine).sealed().volume_m3(0.03).build();
  project.box.boxType.set('box-passive-radiator');
  project.box.passiveRadiator.configurePR(
    radiatorFromSpec(engine, {Mms_kg: MMD_KG, Cms_m_per_N: 0.00079, Sd_m2: 0.00866}));
  project.box.passiveRadiator.count.set(1);
  project.box.passiveRadiator.volume_m3.set(0.03);
  return project;
}

const kinds = (field: {readonly dq: readonly {readonly kind: string}[]}): string[] => field.dq.map(i => i.kind);

describe('added-mass advisory on the project', () => {
  it('a typed mass within 160% carries none', () => {
    const pr = prProject(new Settings(true)).box.passiveRadiator;
    pr.addedMass_kg.set(MMD_KG * 1.5);
    expect(kinds(pr.addedMass_kg)).not.toContain('added-mass-advisory');
  });

  it('a typed mass above 160% marks the added-mass field only', () => {
    const pr = prProject(new Settings(true)).box.passiveRadiator;
    pr.addedMass_kg.set(MMD_KG * 1.7);
    expect(kinds(pr.addedMass_kg)).toContain('added-mass-advisory');
    expect(kinds(pr.tuning_goal_hz)).not.toContain('added-mass-advisory');
    expect(kinds(pr.systemTuning_hz)).not.toContain('added-mass-advisory');
    expect(kinds(pr.resonanceWithAddedMass_hz)).not.toContain('added-mass-advisory');
  });

  it('a mass solved from a low target tuning is marked the same way', () => {
    const pr = prProject(new Settings(true)).box.passiveRadiator;
    pr.tuning_goal_hz.set(5);
    expect(pr.addedMass_kg.value).toBeGreaterThan(MMD_KG * 1.6);
    expect(kinds(pr.addedMass_kg)).toContain('added-mass-advisory');
    expect(kinds(pr.tuning_goal_hz)).not.toContain('added-mass-advisory');
  });

  it('keeps the value: the advisory never changes the mass', () => {
    const pr = prProject(new Settings(true)).box.passiveRadiator;
    pr.addedMass_kg.set(MMD_KG * 5);
    expect(pr.addedMass_kg.value).toBeCloseTo(MMD_KG * 5, 12);
  });

  it('switching the alert off removes it from an open project', () => {
    const settings = new Settings(true);
    const project = prProject(settings);
    project.box.passiveRadiator.addedMass_kg.set(MMD_KG * 3);
    expect(kinds(project.box.passiveRadiator.addedMass_kg)).toContain('added-mass-advisory');
    settings.alertOn = false;
    project.appSettingsChanged();
    expect(kinds(project.box.passiveRadiator.addedMass_kg)).not.toContain('added-mass-advisory');
  });
});
