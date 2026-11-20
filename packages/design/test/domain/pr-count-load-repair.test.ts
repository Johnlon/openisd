/**
 * A passive-radiator count below 1 in a file (an OpenISD project, a WinISD `.wpr`) is repaired on
 * opening to the minimum of 1: the box shows 1, the opening message names the repair once, and the
 * charts draw. T924 added the repair (`projectLoadRepairRules.ts`); a WinISD `.wpr` with Npr=0 was still
 * repaired silently, inside the project builder, so its opening message did not name it (T928). Rule: AGENTS.md "Number inputs" (John, 18 Nov 2026, QO953.c26: "a repair is ok but
 * it has to be automatic"; c30-c31: no data-quality mark, only the opening message).
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/Engine.js';
import {OpenISDProject} from '../../domain/project/openISDProject.js';
import {NumberField} from '../../fields/field.js';
import {DEFAULT_GRID, loadProject, projectFindings, wprText} from '../fixtures/inputLimitsSweep.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';
import type {OpenedProject} from '../../domain/project/openISDProject.js';

const engine = createEngine();
const PRS = NumberField.PR_NUM.label;

/** The passive-radiator W5 project as a saved `.owpr` text, its radiator count set to `count`. */
function owprWithCount(count: number): string {
  const session = loadProject('passive radiator').cloneSession();
  const saved = session.edited ?? session.saved;
  return JSON.stringify({...session, saved: {...saved, box: {...saved.box, passiveRadiator: {...saved.box.passiveRadiator, count}}}, edited: null}, null, 2);
}

function opened(text: string): OpenedProject {
  const result = OpenISDProject.fromOwprTextRepairing(text, engine);
  if (Array.isArray(result)) throw new Error(`the project did not open: ${result.join('; ')}`);
  return result;
}

/** The passive-radiator W5 `.wpr` with `[Box] Npr` set to `n`, opened as File > Open opens it. */
function wprWithNpr(n: string): OpenedProject {
  const plain = wprText('passive radiator');
  const text = plain.replace('\nNpr=1\n', `\nNpr=${n}\n`);
  expect(text, 'the passive-radiator W5 file states Npr=1').not.toBe(plain);
  const {value, errors, loadRepairs} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
  if (value === null) throw new Error(errors.map(e => e.message).join('; '));
  return {project: value, loadRepairs};
}

describe('a passive-radiator count below 1 in a file is repaired to 1 on opening (T928)', () => {
  it('the Num. of PRs field states its own load repair: below its minimum of 1, set to 1, the fewest', () => {
    expect(NumberField.PR_NUM.loadRepair).toEqual({breaks: 'min', to: 1, described: '1, the fewest'});
    expect(NumberField.PR_NUM.limits.min).toBe(1);
  });

  for (const count of [0, -2]) {
    it(`a project file with ${count} radiators opens with 1, the repair named once, and the charts draw`, () => {
      const {project, loadRepairs} = opened(owprWithCount(count));
      expect(project.box.passiveRadiator.count.value).toBe(1);
      expect(loadRepairs.map(r => r.text)).toEqual([`${PRS} ${count} in the file: set to 1, the fewest`]);
      const result = projectFindings(project, DEFAULT_GRID);
      expect(result.findings).toEqual([]);
      expect(result.refused).toBe(false);
    });
  }

  it('a WinISD file with Npr=0 opens with 1 radiator, the repair named once, and the charts draw', () => {
    const {project, loadRepairs} = wprWithNpr('0');
    expect(project.box.passiveRadiator.count.value).toBe(1);
    expect(loadRepairs.map(r => r.text)).toEqual([`${PRS} 0 in the file: set to 1, the fewest`]);
    const result = projectFindings(project, DEFAULT_GRID);
    expect(result.findings).toEqual([]);
    expect(result.refused).toBe(false);
  });

  it('a project file with 2 radiators opens unchanged, nothing repaired', () => {
    const {project, loadRepairs} = opened(owprWithCount(2));
    expect(project.box.passiveRadiator.count.value).toBe(2);
    expect(loadRepairs).toEqual([]);
  });
});
