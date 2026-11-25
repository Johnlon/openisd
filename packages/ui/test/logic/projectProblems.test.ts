import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import {ProjectBuilder} from '@openisd/design';
import {chartProblemDestination, collectProjectProblems, marksForProblemFields, projectProblemFieldId, projectProblemFields} from '../../src/logic/projectProblems.js';

describe('collectProjectProblems', () => {
  it('combines the same issue attached to related fields while retaining their destinations', () => {
    const issue = {kind: 'inconsistent-inputs', text: 'The values disagree.'};
    expect(collectProjectProblems([
      {issue, destination: {tab: 'driver', field: 'Fs_hz'}},
      {issue, destination: {tab: 'driver', field: 'Mms_kg'}},
    ])).toEqual([{kind: issue.kind, text: issue.text, destinations: [
      {tab: 'driver', field: 'Fs_hz'}, {tab: 'driver', field: 'Mms_kg'},
    ]}]);
  });

  it('keeps the same wording for independent fields as separate problems', () => {
    const issue = {kind: 'invalid-value', text: 'Must be greater than zero.'};
    expect(collectProjectProblems([
      {issue, destination: {tab: 'box', field: 'volume'}},
      {issue: {...issue}, destination: {tab: 'enclosure', field: 'tuning'}},
    ])).toHaveLength(2);
  });

  it('counts one shared unreachable tuning once across the affected fields', () => {
    const issue = {kind: 'target-unreachable', text: 'The tuning cannot be reached.'};
    expect(collectProjectProblems([
      {issue, destination: {tab: 'enclosure', field: 'tuning'}},
      {issue, destination: {tab: 'enclosure', field: 'mass'}},
    ])).toHaveLength(1);
  });

  it('prefers the issue target when several fields carry the same mark', () => {
    const issue = {kind: 'missing-dependencies', text: 'Vent length needs an area.', target: 'length_m'};
    const problems = collectProjectProblems([
      {issue, destination: {tab: 'enclosure', field: 'Vent.tuning'}},
      {issue, destination: {tab: 'enclosure', field: 'Vent.length_m'}},
    ]);
    expect(problems[0]?.destinations[0]).toEqual({tab: 'enclosure', field: 'Vent.length_m'});
  });

  it('reads current warnings from each field and keeps the destination', () => {
    const issue = {kind: 'outside-normal-band', text: 'Temperature is unusually high.'};
    const fields = [{cell: {dq: [issue]}, destination: {tab: 'advanced' as const, field: 'temperature'}}];
    expect(collectProjectProblems(marksForProblemFields(fields))).toEqual([
      {kind: issue.kind, text: issue.text, destinations: [{tab: 'advanced', field: 'temperature'}]},
    ]);
    fields[0]!.cell.dq = [];
    expect(collectProjectProblems(marksForProblemFields(fields))).toEqual([]);
  });

  it('finds an invalid driver dimension at its Driver Editor destination', () => {
    const project = ProjectBuilder.empty(createEngine());
    project.driver.specs.weight_kg.set(-1);
    const problems = collectProjectProblems(marksForProblemFields(projectProblemFields(project)));
    expect(problems.some(problem => problem.destinations.some(destination =>
      destination.tab === 'driver' && destination.field === 'weight_kg'))).toBe(true);
  });

  it('excludes warnings from inactive box types', () => {
    const project = ProjectBuilder.empty(createEngine());
    project.box.boxType.set('sealed');
    project.box.sealed.volume_m3.set(0.02);
    project.box.vented.volume_m3.set(-1);
    const problems = collectProjectProblems(marksForProblemFields(projectProblemFields(project)));
    expect(problems.some(problem => problem.destinations.some(destination =>
      destination.tab === 'box' && destination.field === 'volume'))).toBe(false);
  });

  it('omits inactive vent dimensions when the vent shape changes', () => {
    const project = ProjectBuilder.empty(createEngine());
    project.box.boxType.set('vented');
    project.box.vented.vent.shape.set('round');
    const fields = () => projectProblemFields(project).map(field => field.destination.field);
    expect(fields()).toContain('Vent.diameter_m');
    expect(fields()).not.toContain('Vent.width_m');
    project.box.vented.vent.shape.set('slotted');
    expect(fields()).toContain('Vent.width_m');
    expect(fields()).not.toContain('Vent.diameter_m');
  });

  it('finds an invalid passive radiator field only when that box type is active', () => {
    const project = ProjectBuilder.empty(createEngine());
    project.box.boxType.set('box-passive-radiator');
    project.box.passiveRadiator.radiator.spec.Fs_hz.set(-1);
    const problems = () => collectProjectProblems(marksForProblemFields(projectProblemFields(project)));
    const hasRadiatorIssue = () => problems().some(problem => problem.destinations.some(destination =>
      destination.tab === 'enclosure' && destination.field === 'radiator.Fs_hz'));
    expect(hasRadiatorIssue()).toBe(true);
    project.box.boxType.set('sealed');
    expect(hasRadiatorIssue()).toBe(false);
  });

  it('updates the air-field destination when an unusual temperature changes', () => {
    const project = ProjectBuilder.empty(createEngine());
    project.envTempK.set(410);
    const problems = () => collectProjectProblems(marksForProblemFields(projectProblemFields(project)));
    expect(problems().some(problem => problem.destinations.some(destination =>
      destination.tab === 'advanced' && destination.field === 'temperature'))).toBe(true);
    project.envTempK.set(293.15);
    expect(problems().some(problem => problem.destinations.some(destination =>
      destination.tab === 'advanced' && destination.field === 'temperature'))).toBe(false);
  });

  it('locates single and multi-port vent fields', () => {
    expect(projectProblemFieldId({tab: 'enclosure', field: 'Vent.length_m'}, 1)).toBe('og-vent-length');
    expect(projectProblemFieldId({tab: 'enclosure', field: 'Rear.length_m'}, 2)).toBe('og-vent-length-rear');
    expect(projectProblemFieldId({tab: 'enclosure', field: 'Front.width_m'}, 2)).toBe('og-vent-width-front');
  });

  it('routes chart diagnostics to the matching driver or enclosure setting', () => {
    const marks = [{issue: {kind: 'required-value', text: 'Enter Fs.'}, destination: {tab: 'driver' as const, field: 'Fs_hz'}}];
    expect(chartProblemDestination('Fs_hz', marks)).toEqual({tab: 'driver', field: 'Fs_hz'});
    expect(chartProblemDestination('Vb', marks)).toEqual({tab: 'box', field: 'volume'});
    expect(chartProblemDestination('prCms', marks)).toEqual({tab: 'enclosure', field: 'radiator.Cms_m_per_N'});
    expect(chartProblemDestination('Qlr', marks)).toEqual({tab: 'box', field: 'losses.rear.Ql'});
    expect(chartProblemDestination('Qpf', marks)).toEqual({tab: 'box', field: 'losses.front.Qp'});
    expect(chartProblemDestination('nDrivers', marks)).toEqual({tab: 'driver', field: 'project.nDrivers'});
    expect(chartProblemDestination('SpIntra', marks)).toEqual({tab: 'enclosure', field: 'Intra.area_m2'});
    expect(projectProblemFieldId({tab: 'box', field: 'losses.rear.Ql'}, 0)).toBe('og-losses-rear-ql');
    expect(chartProblemDestination('unrecognised', marks)).toEqual({tab: 'chart', field: 'unrecognised'});
  });
});
