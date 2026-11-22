/**
 * WinISD .wpr vent shapes: `Shape=1` round, `Shape=2` rectangle (slot) import and export.
 * Facts and captures: docs/research/WPR_VENT_SHAPES.md. Fixtures are WinISD's own saved files
 * (W5-1138SMF, vented, Fb 38, Vb 10 L, one rear vent), so lengths are WinISD's own `len`.
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/Engine.js';
import type {DriverError} from '../../engine/index.js';
import {OpenISDProject} from '../../domain/project/openISDProject.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';

const DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'wpr-vent-shapes');
const converter = new WinIsdProjectConverter(createEngine());

function load(name: string): string {
  return readFileSync(join(DIR, name), 'utf8');
}

function importText(text: string): {project: OpenISDProject; errors: DriverError[]} {
  const {value, errors} = converter.winIsdProjectToOpenIsdProject(text);
  if (value === null) throw new Error('import failed: ' + JSON.stringify(errors));
  return {project: value, errors};
}

function exportText(project: OpenISDProject): string {
  const {value, errors} = converter.openIsdProjectToWinIsdProject(project);
  if (value === null) throw new Error('export failed: ' + JSON.stringify(errors));
  return value.toWpr();
}

function key(text: string, section: string, name: string): string | undefined {
  const body = text.split(`[${section}]`)[1]?.split(/\n\[/)[0] ?? '';
  return new RegExp(`^${name}=(.*)$`, 'm').exec(body)?.[1]?.trim();
}

function shapeWarnings(errors: DriverError[]): DriverError[] {
  return errors.filter((e) => e.field.endsWith('Shape'));
}

/** WinISD's `len` is stored to 15 digits and the formula reproduces it to 15 digits (research
 *  doc); 9 decimals leaves room for the engine's own float ordering. */
const LEN_DIGITS = 9;

describe('WinISD round vent (Shape=1) imports', () => {
  it.each(['round-xc1.wpr', 'round-xc0.wpr'])('%s: round, 0.08 m, no warning, WinISD length and Fb', (file) => {
    const {project, errors} = importText(load(file));
    const vent = project.box.vented.vent;
    expect(shapeWarnings(errors)).toEqual([]);
    expect(vent.shape.value).toBe('round');
    expect(vent.diameter_m.value).toBeCloseTo(0.08, 12);
    expect(vent.area_m2.value).toBeCloseTo(0.00502654824574367, 12);
    expect(vent.length_m.value).toBeCloseTo(0.982946200191273, LEN_DIGITS);
    expect(project.box.vented.tuning_goal_hz.value).toBe(38);
  });
});

describe('WinISD rectangular vent (Shape=2) imports', () => {
  // dia1 is the width, dia2 the height: WinISD only says "the two sides" and the area is symmetric.
  it.each(['rect-xc1.wpr', 'rect-xc0.wpr'])('%s: slotted, 0.08 x 0.03 m, no warning, WinISD length and Fb', (file) => {
    const {project, errors} = importText(load(file));
    const vent = project.box.vented.vent;
    expect(shapeWarnings(errors)).toEqual([]);
    expect(vent.shape.value).toBe('slotted');
    expect(vent.width_m.value).toBeCloseTo(0.08, 12);
    expect(vent.height_m.value).toBeCloseTo(0.03, 12);
    expect(vent.area_m2.value).toBeCloseTo(0.0024, 12);
    expect(vent.length_m.value).toBeCloseTo(0.456818305277811, LEN_DIGITS);
    expect(project.box.vented.tuning_goal_hz.value).toBe(38);
  });
});

describe('vent shapes export and re-import', () => {
  it('a round vent writes Shape=1 and dia1, and comes back round', () => {
    const text = exportText(importText(load('round-xc1.wpr')).project);
    expect(key(text, 'VentRear', 'Shape')).toBe('1');
    expect(Number(key(text, 'VentRear', 'dia1'))).toBeCloseTo(0.08, 12);
    const back = importText(text).project;
    expect(back.box.vented.vent.shape.value).toBe('round');
    expect(back.box.vented.vent.diameter_m.value).toBeCloseTo(0.08, 12);
    expect(back.box.vented.vent.length_m.value).toBeCloseTo(0.982946200191273, LEN_DIGITS);
    expect(back.box.vented.tuning_goal_hz.value).toBe(38);
  });

  it('a slotted vent writes Shape=2, dia1 and dia2, and comes back slotted', () => {
    const text = exportText(importText(load('rect-xc1.wpr')).project);
    expect(key(text, 'VentRear', 'Shape')).toBe('2');
    expect(Number(key(text, 'VentRear', 'dia1'))).toBeCloseTo(0.08, 12);
    expect(Number(key(text, 'VentRear', 'dia2'))).toBeCloseTo(0.03, 12);
    expect(Number(key(text, 'VentRear', 'carea'))).toBeCloseTo(0.0024, 12);
    expect(Number(key(text, 'VentRear', 'len'))).toBeCloseTo(0.456818305277811, LEN_DIGITS);
    const back = importText(text).project;
    const vent = back.box.vented.vent;
    expect(vent.shape.value).toBe('slotted');
    expect(vent.width_m.value).toBeCloseTo(0.08, 12);
    expect(vent.height_m.value).toBeCloseTo(0.03, 12);
    expect(vent.area_m2.value).toBeCloseTo(0.0024, 12);
    expect(vent.length_m.value).toBeCloseTo(0.456818305277811, LEN_DIGITS);
    expect(back.box.vented.tuning_goal_hz.value).toBe(38);
  });
});

describe('an unknown vent Shape', () => {
  it('still warns (WinISD calculates nothing for it)', () => {
    const {errors} = importText(load('rect-xc1.wpr').replace(/^Shape=2$/m, 'Shape=3'));
    expect(shapeWarnings(errors)).toHaveLength(1);
  });
});
