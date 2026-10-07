/**
 * bugs/BUG_20261007_front-chamber-qicl-stored-but-never-read.md: WinISD has one Qicl (Qiclfr), the
 * rear chamber's. A front chamber stores none; a file from before that still loads with the front
 * value dropped, and the .wpr Qiclfr still goes in and out.
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import {z} from 'zod';
import {createEngine} from '../../engine/index.js';
import {OpenISDProject} from '../../domain/index.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';

const here = dirname(fileURLToPath(import.meta.url));
const engine = createEngine();
const wprText = readFileSync(join(here, '..', 'winisd', 'fixtures', 'abc-w5-1.wpr'), 'utf8');

function abcProject(): OpenISDProject {
  const {value, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(wprText);
  if (value === null) throw new Error('import failed: ' + JSON.stringify(errors));
  return value;
}

const recordSchema = z.record(z.string(), z.unknown());
function record(v: unknown): Record<string, unknown> {
  return recordSchema.parse(v);
}
const TWO_CHAMBER = ['bandpass4', 'bandpass6', 'abc'] as const;

/** The project's `.owpr` text as an older build wrote it: every front chamber carrying a Qicl. */
function legacyText(project: OpenISDProject): string {
  const session = record(JSON.parse(project.toOwprText()));
  for (const where of ['saved', 'edited']) {
    const rec = session[where];
    if (rec === null || rec === undefined) continue;
    const box = record(record(rec).box);
    for (const type of TWO_CHAMBER) record(record(record(box[type]).front).losses).Qicl = 77;
  }
  return JSON.stringify(session);
}

/** Every `Qicl` key in the front chambers of an `.owpr` text. */
function frontQiclKeys(text: string): number {
  const session = record(JSON.parse(text));
  let n = 0;
  for (const where of ['saved', 'edited']) {
    const rec = session[where];
    if (rec === null || rec === undefined) continue;
    const box = record(record(rec).box);
    for (const type of TWO_CHAMBER) if ('Qicl' in record(record(record(box[type]).front).losses)) n++;
  }
  return n;
}

describe('the front chamber has no Qicl', () => {
  for (const type of TWO_CHAMBER) {
    it(`${type}: its front chamber stores Ql, Qa and Qp only`, () => {
      const front = abcProject().box[type].chambers.front.losses;
      expect(Object.keys(front).sort()).toEqual(['Qa', 'Ql', 'Qp']);
    });
  }

  it('a saved project writes no front Qicl', () => {
    expect(frontQiclKeys(abcProject().toOwprText())).toBe(0);
  });
});

describe('an .owpr from before, with a front Qicl, still loads', () => {
  it('is repaired, not refused: the front value is dropped and nothing else changes', () => {
    const original = abcProject();
    const result = OpenISDProject.fromOwprTextRepairing(legacyText(original), engine);
    if (Array.isArray(result)) throw new Error('refused: ' + result.join('; '));
    const {front, rear} = result.project.box.abc.chambers;
    const was = original.box.abc.chambers;
    expect([front.losses.Ql.value, front.losses.Qa.value, front.losses.Qp.value])
      .toEqual([was.front.losses.Ql.value, was.front.losses.Qa.value, was.front.losses.Qp.value]);
    expect(rear.losses.Qicl.value).toBe(was.rear.losses.Qicl.value);
    expect(frontQiclKeys(result.project.toOwprText())).toBe(0);
  });

  it('also loads by the plain reader', () => {
    const result = OpenISDProject.fromOwprText(legacyText(abcProject()), engine);
    if (Array.isArray(result)) throw new Error('refused: ' + result.join('; '));
    expect(frontQiclKeys(result.toOwprText())).toBe(0);
  });
});

describe('the .wpr Qiclfr still goes in and out', () => {
  it('imports as the rear chamber\'s Qicl and exports from it', () => {
    const project = abcProject();
    expect(project.box.abc.chambers.rear.losses.Qicl.value).toBe(20);
    project.box.abc.chambers.rear.losses.Qicl.set(33);
    const {value, errors} = new WinIsdProjectConverter(engine).openIsdProjectToWinIsdProject(project);
    if (value === null) throw new Error('export failed: ' + JSON.stringify(errors));
    expect(value.toWpr()).toMatch(/^Qiclfr=33$/m);
  });
});
