/**
 * A project's trace colour is saved in the project file (John, 2026-09-26,
 * bugs/BUG_20260926_trace-colour-not-persisted.md). It is chart view state, so setting it is not
 * an unsaved change.
 */
import {describe, expect, it} from 'vitest';
import {createEngine, OpenISDProject, ProjectBuilder} from '../../domain/index.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';

describe('OpenISDProject.traceColor', () => {
  const engine = createEngine();
  const project = (): OpenISDProject => new ProjectBuilder(driverFromSpec(engine, {
    Fs_hz: 29, Vas_m3: 0.142, Sd_m2: 0.038, Re_ohm: 6.5, Qes: 0.44, Qms: 3.3,
  }), engine).sealed().volume_m3(0.021).build();

  it('is null until set', () => {
    expect(project().traceColor.value).toBeNull();
  });

  it('survives a save and reload of the project file', () => {
    const p = project();
    p.traceColor.set('#111111');
    const back = OpenISDProject.fromOwprText(p.toOwprText(), engine);
    if (Array.isArray(back)) throw new Error('fromOwprText returned problems: ' + back.join(', '));
    expect(back.traceColor.value).toBe('#111111');
  });

  it('setting it is not an unsaved change', () => {
    const p = project();
    const text = p.toOwprText();
    const reopened = OpenISDProject.fromOwprText(text, engine);
    if (Array.isArray(reopened)) throw new Error('fromOwprText returned problems: ' + reopened.join(', '));
    reopened.traceColor.set('#222222');
    expect(reopened.isModified()).toBe(false);
  });
});
