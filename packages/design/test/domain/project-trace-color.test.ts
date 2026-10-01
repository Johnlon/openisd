/**
 * A project's trace colour is given to it when it is opened; that is part of its ground state,
 * never an unsaved change, so every tab stores the same record for it.
 * bugs/BUG_20261001_boot-rewrites-open-sessions-and-other-tabs-rebuild.md
 */
import {describe, expect, it} from 'vitest';
import {ProjectBuilder} from '../../domain/index.js';
import {createEngine} from '../../engine/index.js';

const engine = createEngine();

describe('OpenISDProject.stampTraceColor', () => {
  it('on a saved project, writes the saved record and makes no edit', () => {
    const project = ProjectBuilder.empty(engine);
    project.save();

    project.stampTraceColor('#123456');

    expect(project.traceColor.value).toBe('#123456');
    expect(project.cloneSession().edited).toBeNull();
    expect(project.cloneSession().saved.charts.traceColor).toBe('#123456');
  });

  it('with unsaved edits, colours both records and keeps the edits', () => {
    const project = ProjectBuilder.empty(engine);
    project.save();
    project.name.set('edited name');

    project.stampTraceColor('#654321');

    const session = project.cloneSession();
    expect(session.saved.charts.traceColor).toBe('#654321');
    expect(session.edited?.charts.traceColor).toBe('#654321');
    expect(session.edited?.meta.name).toBe('edited name');
    expect(project.isModified()).toBe(true);
  });
});
