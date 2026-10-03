/**
 * Added mass past 160% of the radiator's own moving mass is poor practice, not a limit: it is
 * advised against, never blocked. The alert is an application setting read at call time.
 */
import {describe, expect, it} from 'vitest';
import {
  type AppSettings, createEngine, DEFAULT_ENV_DEFAULTS, DEFAULT_VENTED_DESIGN_LIMITS,
  type EnvDefaults, type VentedDesignLimits,
} from '@openisd/design/engine';

class Settings implements AppSettings {
  constructor(public alertOn: boolean) {}
  ventedLimits(): VentedDesignLimits { return DEFAULT_VENTED_DESIGN_LIMITS; }
  envDefaults(): EnvDefaults { return DEFAULT_ENV_DEFAULTS; }
  prAddedMassAlert(): boolean { return this.alertOn; }
}

const MMD_KG = 0.1;

describe('PrEngine.addedMassIssue', () => {
  it('has no issue at or below 160% of the radiator mass', () => {
    const engine = createEngine(new Settings(true));
    expect(engine.pr.addedMassIssue(0, MMD_KG)).toBeNull();
    expect(engine.pr.addedMassIssue(0.16, MMD_KG)).toBeNull();
  });

  it('advises above 160%, naming the ratio and the limit', () => {
    const issue = createEngine(new Settings(true)).pr.addedMassIssue(0.2, MMD_KG);
    expect(issue).not.toBeNull();
    expect(issue?.kind).toBe('added-mass-advisory');
    expect(issue?.ratio).toBeCloseTo(2, 12);
    expect(issue?.maxRatio).toBe(1.6);
    expect(issue?.text).toContain('200%');
    expect(issue?.text).toContain('160%');
  });

  it('is silent when the alert is switched off, read at call time', () => {
    const settings = new Settings(true);
    const engine = createEngine(settings);
    expect(engine.pr.addedMassIssue(0.2, MMD_KG)).not.toBeNull();
    settings.alertOn = false;
    expect(engine.pr.addedMassIssue(0.2, MMD_KG)).toBeNull();
  });

  it('has no issue without a positive radiator mass to compare against', () => {
    const engine = createEngine(new Settings(true));
    expect(engine.pr.addedMassIssue(0.2, 0)).toBeNull();
  });
});
