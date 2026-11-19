/**
 * Several-driver wiring, slice 2 "Data, inert" (plan docs/plans/PLAN_20261116_DRIVER_WIRING.md section 4,
 * ticket 519; QO946.c129): the project file saves and loads `driverWiring` (parallel or series, in
 * `driverEmbedding`) and `winisdOneDriverImpedance` (boolean, `advanced`). Nothing reads them yet. The facade fields and the switch come in slice 3.
 */
import {describe, expect, it} from 'vitest';
import {OpenISDProject} from '../../domain/project/openISDProject.js';
import {upgradeToCurrent} from '../../domain/schemaVersion.js';
import {createEngine} from '../../engine/Engine.js';
import {sealedProject} from '../fixtures/domainBuilders.js';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function opened(text: string): OpenISDProject {
  const back = OpenISDProject.fromOwprText(text, createEngine());
  if (Array.isArray(back)) throw new Error('fromOwprText returned problems: ' + back.join(', '));
  return back;
}

function sectionOf(text: string, name: 'driverEmbedding' | 'advanced'): Record<string, unknown> {
  const session: unknown = JSON.parse(text);
  const section = isRecord(session) && isRecord(session.saved) ? session.saved[name] : undefined;
  if (!isRecord(section)) throw new Error(`no ${name} in the saved project`);
  return section;
}

function sealedProjectText(): string {
  const p = sealedProject();
  p.save();
  return p.toOwprText();
}

describe('driver wiring data (slice 2, inert): the saved file', () => {
  function withKeys(): string {
    const p = sealedProject();
    p.save();
    return p.toOwprText()
      .replace(/"driverWiring": "parallel"/, '"driverWiring": "series"')
      .replace(/"winisdOneDriverImpedance": false/, '"winisdOneDriverImpedance": true');
  }

  it('a file that carries driverWiring is accepted and writes both back as they were', () => {
    const text = withKeys();
    expect(text).toMatch(/"driverWiring": "series"/);
    const again = opened(text).toOwprText();
    expect(sectionOf(again, 'driverEmbedding').driverWiring).toBe('series');
    expect(sectionOf(again, 'advanced').winisdOneDriverImpedance).toBe(true);
  });

  it('browser storage text keeps both keys too', () => {
    const stored = opened(withKeys()).toStoredText();
    expect(sectionOf(stored, 'driverEmbedding').driverWiring).toBe('series');
    expect(sectionOf(stored, 'advanced').winisdOneDriverImpedance).toBe(true);
  });

  it('a file from before the keys existed (neither key) is accepted', () => {
    const p = sealedProject();
    p.save();
    // Every save now writes both keys (plan 4.1), so a file from before them is made by taking them out.
    const text = p.toOwprText().replace(/,?\s*"driverWiring": "parallel"/, '').replace(/,?\s*"winisdOneDriverImpedance": false/, '');
    expect(text).not.toMatch(/driverWiring|winisdOneDriverImpedance/);
    expect(Array.isArray(OpenISDProject.fromOwprText(text, createEngine()))).toBe(false);
  });

  it('a winisdOneDriverImpedance that is not a boolean is refused by the schema', () => {
    const text = sealedProjectText().replace(/"winisdOneDriverImpedance": false/, '"winisdOneDriverImpedance": "yes"');
    expect(Array.isArray(OpenISDProject.fromOwprText(text, createEngine()))).toBe(true);
  });

  it('a driverWiring that is not parallel or series is refused by the schema', () => {
    const text = sealedProjectText().replace(/"driverWiring": "parallel"/, '"driverWiring": "star"');
    expect(text).toMatch(/"driverWiring": "star"/);
    expect(Array.isArray(OpenISDProject.fromOwprText(text, createEngine()))).toBe(true);
  });
});

describe('schema version step (plan 4.2)', () => {
  function v5File(): Record<string, unknown> {
    const p = sealedProject();
    p.save();
    const parsed: unknown = JSON.parse(p.toOwprText());
    if (!isRecord(parsed)) throw new Error('not a record');
    return {...parsed, schemaVersion: 5};
  }

  it('the step from 5 to 6 is the identity on a version 5 file except schemaVersion', () => {
    const file = v5File();
    const result = upgradeToCurrent(file);
    if ('refusal' in result) throw new Error(result.refusal);
    const {schemaVersion: was, ...before} = file;
    expect(was).toBe(5);
    expect(result.value).toEqual({...before, schemaVersion: 6});
  });

  it('a version 6 file is refused by a build that reads up to 5, as made by a newer OpenISD', () => {
    const result = upgradeToCurrent({...v5File(), schemaVersion: 6}, 5);
    expect('refusal' in result && result.refusal).toMatch(/saved by a newer OpenISD/);
  });
});
