import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import {OpenISDDriver, OpenISDProject, ProjectBuilder} from '@openisd/design';
import {DEFAULT_VENTED_DESIGN_LIMITS} from '../../engine/appSettings.js';
import type {EnvDefaults} from '../../engine/appSettings.js';
import {createEngine} from '@openisd/design/engine';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';

const here = dirname(fileURLToPath(import.meta.url));
const engine = createEngine();
const converter = new WinIsdProjectConverter(engine);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function build(make: (b: ProjectBuilder) => OpenISDProject): OpenISDProject {
  const driver = OpenISDDriver.empty(engine);
  driver.specs.Re_ohm.set(6);
  return make(new ProjectBuilder(driver, engine));
}

/** The project reloaded from its own record with the entries at the given box paths removed. */
function withoutEntries(project: OpenISDProject, paths: readonly (readonly string[])[], blanked: readonly (readonly string[])[] = []): OpenISDProject {
  const session: unknown = JSON.parse(project.toOwprText());
  for (const half of ['saved', 'edited']) {
    if (!isRecord(session) || !isRecord(session[half])) continue;
    for (const path of paths) {
      let parent: unknown = session[half];
      for (const key of ['box', ...path.slice(0, -1)]) parent = isRecord(parent) ? parent[key] : undefined;
      if (!isRecord(parent)) throw new Error(`no record at ${path.join('.')}`);
      delete parent[path[path.length - 1] ?? ''];
    }
    for (const path of blanked) {
      let parent: unknown = session[half];
      for (const key of ['box', ...path.slice(0, -1)]) parent = isRecord(parent) ? parent[key] : undefined;
      if (!isRecord(parent)) throw new Error(`no record at ${path.join('.')}`);
      parent[path[path.length - 1] ?? ''] = null;
    }
  }
  const loaded = OpenISDProject.fromOwprText(JSON.stringify(session), createEngine());
  if (Array.isArray(loaded)) throw new Error(`the edited record does not load: ${loaded.join(', ')}`);
  return loaded;
}

function wprTextOf(project: OpenISDProject) {
  const {value, errors} = converter.openIsdProjectToWinIsdProject(project);
  if (!value) throw new Error('expected a WinISDProject');
  return {text: value.toWpr().replace(/\r\n/g, '\n'), errors};
}

function sectionOf(text: string, section: string): string {
  const block = text.match(new RegExp(`\\[${section}\\]\\n([\\s\\S]*?)(?=\\n\\[|$)`));
  if (!block) throw new Error(`no [${section}] section`);
  return block[1];
}

describe('WinIsdProjectConverter export — a box with nothing stated in it', () => {
  it.each([
    {name: 'bandpass6', make: () => build(b => b.bandpass6().rearVolume_m3(0.02).rearTuning_hz(50).frontVolume_m3(0.01).frontTuning_hz(70).build()),
      key: 'bandpass6' as const, vents: ['rearVent', 'frontVent'], areas: ['Sdrport', 'Sdfport']},
    {name: 'abc', make: () => build(b => b.abc().rearVolume_m3(0.02).rearTuning_hz(50).frontVolume_m3(0.01).frontTuning_hz(70).build()),
      key: 'abc' as const, vents: ['rearVent', 'frontVent'], areas: ['Sdrport', 'Sdfport']},
  ])('$name writes 0 for each missing tuning, no port areas, and a warning for each missing volume', ({make, key, vents, areas}) => {
    const project = withoutEntries(make(), [
      [key, 'rear', 'tuning_goal_hz'], [key, 'front', 'tuning_goal_hz'],
      ...vents.flatMap(vent => [[key, vent, 'area_m2'], [key, vent, 'diameter_m'], [key, vent, 'length_m']]),
    ], [[key, 'rear', 'volume_m3'], [key, 'front', 'volume_m3']]);
    const {text, errors} = wprTextOf(project);
    const box = sectionOf(text, 'Box');
    expect(box).toMatch(/^Fr=0$/m);
    expect(box).toMatch(/^Ff=0$/m);
    for (const area of areas) expect(box).not.toMatch(new RegExp(`^${area}=(?!0$)`, 'm'));
    expect(errors.map(e => e.field).sort()).toEqual(expect.arrayContaining(['Box Vf', 'Box Vr']));
    expect(errors.map(e => e.message)).toContain('Front chamber volume was blank; written as 1 L so WinISD can open the file');
  });
});

/** `text` with `key=` in `[section]` set to `value`, or its line dropped when `value` is null. */
function withKey(text: string, section: string, key: string, value: string | null): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const start = lines.indexOf(`[${section}]`);
  if (start < 0) throw new Error(`no [${section}]`);
  let end = lines.findIndex((l, i) => i > start && l.startsWith('['));
  if (end < 0) end = lines.length;
  const at = lines.findIndex((l, i) => i > start && i < end && l.startsWith(`${key}=`));
  if (at < 0) throw new Error(`no ${key}= in [${section}]`);
  if (value === null) lines.splice(at, 1); else lines[at] = `${key}=${value}`;
  return lines.join('\n');
}

function importOf(text: string): OpenISDProject {
  const {value, errors} = converter.winIsdProjectToOpenIsdProject(text);
  if (!value) throw new Error(`no project: ${JSON.stringify(errors)}`);
  return value;
}

const fixture = (name: string) => readFileSync(join(here, 'fixtures', name), 'utf8');

type Read = (p: OpenISDProject) => number | null;
const sixthOrder = (name: 'bandpass6' | 'abc') => (p: OpenISDProject) => p.box[name];

describe('WinIsdProjectConverter import — a key the file does not state leaves the box value as it was', () => {
  const rows = (name: 'bandpass6' | 'abc'): {section: string; key: string; sentinel: string; read: Read}[] => {
    const box = (p: OpenISDProject) => sixthOrder(name)(p);
    return [
      {section: 'Box', key: 'Qlr', sentinel: '31', read: p => box(p).chambers.rear.losses.Ql.value},
      {section: 'Box', key: 'Qar', sentinel: '32', read: p => box(p).chambers.rear.losses.Qa.value},
      {section: 'Box', key: 'Qpr', sentinel: '33', read: p => box(p).chambers.rear.losses.Qp.value},
      {section: 'Box', key: 'Qiclfr', sentinel: '34', read: p => box(p).Qiclfr.value},
      {section: 'Box', key: 'Qlf', sentinel: '35', read: p => box(p).chambers.front.losses.Ql.value},
      {section: 'Box', key: 'Qaf', sentinel: '36', read: p => box(p).chambers.front.losses.Qa.value},
      {section: 'Box', key: 'Qpf', sentinel: '37', read: p => box(p).chambers.front.losses.Qp.value},
      {section: 'VentRear', key: 'Num', sentinel: '3', read: p => box(p).vents.rear.count.value},
      {section: 'VentFront', key: 'Num', sentinel: '4', read: p => box(p).vents.front.count.value},
    ];
  };
  const cases = (['bandpass6', 'abc'] as const).flatMap(name => rows(name).map(row => ({name, ...row})));

  it.each(cases)('$name [$section] $key', ({name, section, key, sentinel, read}) => {
    const file = name === 'bandpass6' ? 'bp6-w5-1.wpr' : 'abc-w5-1.wpr';
    const present = importOf(withKey(fixture(file), section, key, sentinel));
    expect(read(present)).toBe(Number(sentinel));
    const absent = importOf(withKey(fixture(file), section, key, null));
    expect(read(absent)).not.toBe(Number(sentinel));
  });

  it('abc [VentIntra] Num and len', () => {
    const text = fixture('abc-w5-1.wpr');
    const present = importOf(withKey(withKey(text, 'VentIntra', 'Num', '2'), 'VentIntra', 'len', '0.2'));
    expect(present.box.abc.vents.intra.count.value).toBe(2);
    expect(present.box.abc.vents.intra.length_m.value).toBe(0.2);
    const absent = importOf(withKey(withKey(text, 'VentIntra', 'Num', null), 'VentIntra', 'len', null));
    expect(absent.box.abc.vents.intra.count.value).not.toBe(2);
    expect(absent.box.abc.vents.intra.length_m.value).not.toBe(0.2);
  });
});

describe('WinIsdProjectConverter import — odd box and vent entries', () => {
  it('refuses a box type code it does not read', () => {
    const text = '[ProjectInfo]\n[Driver]\nBrand=Test\nModel=Driver\n[Box]\nBType=9\n';
    const {value, errors} = converter.winIsdProjectToOpenIsdProject(text);
    expect(value).toBeNull();
    expect(errors.map(e => e.field)).toEqual(['BType']);
    expect(errors[0].message).toContain('BType=9');
  });

  it('refuses a project whose driver the record seam refuses, naming each reason', () => {
    const refusing = new WinIsdProjectConverter(engine, () => ['first reason', 'second reason']);
    const {value, errors} = refusing.winIsdProjectToOpenIsdProject('[ProjectInfo]\n[Driver]\nBrand=Test\nModel=Driver\n[Box]\nBType=1\n');
    expect(value).toBeNull();
    expect(errors.filter(e => e.level === 'error')).toEqual([
      {level: 'error', field: 'driver', message: 'first reason'},
      {level: 'error', field: 'driver', message: 'second reason'},
    ]);
  });

  it('a rectangular vent with no sizes stated keeps the vent\'s own sizes', () => {
    const base = '[ProjectInfo]\n[Driver]\nBrand=Test\nModel=Driver\n[Box]\nBType=1\nVr=0.03\nFr=40\n[VentRear]\nShape=2\n';
    const bare = importOf(base);
    expect(bare.box.vented.vent.shape.value).toBe('slotted');
    const sized = importOf(`${base}dia1=0.2\ndia2=0.05\n`);
    expect(sized.box.vented.vent.width_m.value).toBe(0.2);
    expect(sized.box.vented.vent.height_m.value).toBe(0.05);
    expect(bare.box.vented.vent.width_m.value).not.toBe(0.2);
    expect(bare.box.vented.vent.height_m.value).not.toBe(0.05);
  });
});

describe('WinIsdProjectConverter export — air a project cleared and the app cannot supply', () => {
  it('writes the built-in constants for T, p and phi when the project is cleared and the app setting is out of range', () => {
    let defaults: EnvDefaults = {tempK: 293.15, humidityPct: 30, pressurePa: 101325};
    const own = createEngine({ventedLimits: () => DEFAULT_VENTED_DESIGN_LIMITS, envDefaults: () => defaults});
    const driver = OpenISDDriver.empty(own);
    driver.specs.Re_ohm.set(6);
    const project = new ProjectBuilder(driver, own).sealed().volume_m3(0.03).build();
    defaults = {tempK: 0, humidityPct: 500, pressurePa: 1};
    project.envTempK.clear();
    project.envHumidityPct.clear();
    project.envPressurePa.clear();
    expect([project.envTempK.value, project.envHumidityPct.value, project.envPressurePa.value]).toEqual([293.15, 30, 101325]);
    const box = sectionOf(wprTextOf(project).text, 'Box');
    // The app's out-of-range values are the built-in constants, and those are written.
    expect(box).toMatch(/^T=293\.15$/m);
    expect(box).toMatch(/^p=101325$/m);
    expect(box).toMatch(/^phi=0\.3$/m);
    project.envTempK.set(250);
    project.envPressurePa.set(90000);
    project.envHumidityPct.set(10);
    const stated = sectionOf(wprTextOf(project).text, 'Box');
    expect(stated).toMatch(/^T=250$/m);
    expect(stated).toMatch(/^p=90000$/m);
    expect(stated).toMatch(/^phi=0\.1$/m);
  });
});

describe('WinIsdProjectConverter export — more boxes with nothing stated in them', () => {
  it('bandpass4 writes no front port area when the front vent has none', () => {
    const project = withoutEntries(
      build(b => b.bandpass4().rearVolume_m3(0.02).frontVolume_m3(0.01).frontTuning_hz(70).build()),
      [['bandpass4', 'frontVent', 'area_m2'], ['bandpass4', 'frontVent', 'diameter_m'], ['bandpass4', 'frontVent', 'length_m']],
    );
    const {text} = wprTextOf(project);
    expect(sectionOf(text, 'Box')).not.toMatch(/^Sdfport=(?!0$)/m);
  });

  it('a passive-radiator box writes its system tuning as Fr', () => {
    const project = build(b => b.passiveRadiator().volume_m3(0.02).build());
    const tuning = project.box.passiveRadiator.systemTuning_hz.value;
    if (tuning === null) throw new Error('expected a system tuning');
    const {text} = wprTextOf(project);
    expect(Number(/^Fr=(.*)$/m.exec(sectionOf(text, 'Box'))?.[1])).toBeCloseTo(tuning, 9);
  });

  it('a passive-radiator box with no volume writes no tuning and warns that the volume was blank', () => {
    const project = withoutEntries(
      build(b => b.passiveRadiator().volume_m3(0.02).build()),
      [], [['passiveRadiator', 'volume_m3']],
    );
    const {text, errors} = wprTextOf(project);
    expect(errors.map(e => e.message)).toContain('Box volume was blank; written as 1 L so WinISD can open the file');
    expect(sectionOf(text, 'Box')).toMatch(/^Fr=0$/m);
  });
});
