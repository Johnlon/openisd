/**
 * A project saved while chambers stored their own Qicl: the rear chamber's value (else the
 * front's) moves to the box's one Qiclfr, and no chamber Qicl is left.
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/index.js';
import {OpenISDProject} from '../../domain/index.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';

const here = dirname(fileURLToPath(import.meta.url));
const engine = createEngine();
const wprText = readFileSync(join(here, '..', 'winisd', 'fixtures', 'abc-w5-1.wpr'), 'utf8');
/** The object itself, not a copy: the test edits the parsed JSON in place. */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function record(v: unknown): Record<string, unknown> {
  if (!isRecord(v)) throw new Error('not an object');
  return v;
}
const TWO_CHAMBER = ['bandpass4', 'bandpass6', 'abc'] as const;
const DEFAULT_QICLFR = 100;

function abcProject(): OpenISDProject {
  const {value, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(wprText);
  if (value === null) throw new Error('import failed: ' + JSON.stringify(errors));
  return value;
}

interface Legacy {readonly rear?: number; readonly front?: number; readonly qiclfr?: number}

/** The project's `.owpr` text as an older build wrote it, in both the saved and edited project. */
function legacyText(legacy: Legacy): string {
  const session = record(JSON.parse(abcProject().toOwprText()));
  for (const where of ['saved', 'edited']) {
    const rec = session[where];
    if (rec === null || rec === undefined) continue;
    const box = record(record(rec).box);
    for (const type of TWO_CHAMBER) {
      const typeBox = record(box[type]);
      if (legacy.qiclfr === undefined) delete typeBox.Qiclfr;
      else typeBox.Qiclfr = legacy.qiclfr;
      if (legacy.rear !== undefined) record(record(typeBox.rear).losses).Qicl = legacy.rear;
      if (legacy.front !== undefined) record(record(typeBox.front).losses).Qicl = legacy.front;
    }
  }
  return JSON.stringify(session);
}

function loaded(text: string): OpenISDProject {
  const result = OpenISDProject.fromOwprTextRepairing(text, engine);
  if (Array.isArray(result)) throw new Error('refused: ' + result.join('; '));
  return result.project;
}

/** Every chamber `Qicl` key left in the `.owpr` text. */
function chamberQiclKeys(text: string): number {
  const session = record(JSON.parse(text));
  let n = 0;
  for (const where of ['saved', 'edited']) {
    const rec = session[where];
    if (rec === null || rec === undefined) continue;
    const box = record(record(rec).box);
    for (const type of TWO_CHAMBER) {
      for (const chamber of ['rear', 'front']) {
        if ('Qicl' in record(record(record(box[type])[chamber]).losses)) n++;
      }
    }
  }
  return n;
}

describe('a chamber Qicl moves to the box Qiclfr on load', () => {
  for (const type of TWO_CHAMBER) {
    it(`${type}: rear Qicl 77 becomes Qiclfr 77`, () => {
      const project = loaded(legacyText({rear: 77}));
      expect(project.box[type].Qiclfr.value).toBe(77);
      expect(chamberQiclKeys(project.toOwprText())).toBe(0);
    });

    it(`${type}: front-only Qicl 55 becomes Qiclfr 55`, () => {
      const project = loaded(legacyText({front: 55}));
      expect(project.box[type].Qiclfr.value).toBe(55);
      expect(chamberQiclKeys(project.toOwprText())).toBe(0);
    });
  }

  it('the rear value wins when both are present', () => {
    expect(loaded(legacyText({rear: 77, front: 55})).box.abc.Qiclfr.value).toBe(77);
  });

  it('an already-set Qiclfr is untouched, and the chamber Qicl is still dropped', () => {
    const project = loaded(legacyText({rear: 77, front: 55, qiclfr: 33}));
    expect(project.box.abc.Qiclfr.value).toBe(33);
    expect(chamberQiclKeys(project.toOwprText())).toBe(0);
  });

  it('with neither present Qiclfr takes the default', () => {
    expect(loaded(legacyText({})).box.abc.Qiclfr.value).toBe(DEFAULT_QICLFR);
  });

  it('the plain reader moves it too', () => {
    const result = OpenISDProject.fromOwprText(legacyText({rear: 77}), engine);
    if (Array.isArray(result)) throw new Error('refused: ' + result.join('; '));
    expect(result.box.abc.Qiclfr.value).toBe(77);
  });
});
