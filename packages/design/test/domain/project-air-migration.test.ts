/**
 * The air upgrade is no event (John, 17 Oct 2026): a project saved by the build before the five-air
 * change opens in this build with no error, no repair notice and nothing modified, and shows
 * the same Advanced values (T, RH, p, c, rho) and the same chart numbers; and a project this build
 * saves shows the same numbers in the earlier build.
 *
 * Goldens, in `fixtures/air-migration/`, were captured on origin/main (c06f28f0) before the change:
 *  - `golden-main.json`: the earlier build loading `main-*.owpr`, `sample-project.owpr` and
 *    `sample_project_vented.wpr`.
 *  - `golden-t375-in-main.json`: the EARLIER build loading `saved-by-t375-*.owpr`, which this build
 *    wrote by loading and saving each of those fixtures.
 * Comparison is exact (===): the numbers are the same code path, so any difference is a change.
 * Capture and save scripts: see the T375 report; they load a fixture, sweep 10..2000 Hz at N=120
 * (`sweep` and `maxCurves`) and list every number found in the results.
 */
import {describe, expect, it} from 'vitest';
import {z} from 'zod';
import {readFileSync, readdirSync} from 'node:fs';
import {basename, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createEngine} from '../../engine/index.js';
import {OpenISDProject} from '../../domain/project/openISDProject.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';
import type {FrequencyGrid} from '../../domain/box/frequencyGrid.js';

const DIR = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'fixtures', 'air-migration');
const GRID: FrequencyGrid = {fmin: 10, fmax: 2000, N: 120};

const observedSchema = z.object({
  errors: z.unknown(),
  repaired: z.array(z.string()).readonly().optional(),
  modified: z.boolean().optional(),
  T: z.number().optional(), RH: z.number().optional(), p: z.number().optional(),
  c: z.number().nullable().optional(), rho: z.number().nullable().optional(),
  numbers: z.array(z.number().nullable()).optional(),
});
const goldenSchema = z.record(z.string(), observedSchema);
type Observed = z.infer<typeof observedSchema>;

function goldenFile(name: string): Record<string, Observed> {
  return goldenSchema.parse(JSON.parse(readFileSync(join(DIR, name), 'utf8')));
}

function collect(node: unknown, acc: (number | null)[]): void {
  if (typeof node === 'number') acc.push(Number.isFinite(node) ? node : null);
  else if (Array.isArray(node)) for (const x of node) collect(x, acc);
  else if (typeof node === 'object' && node !== null) for (const x of Object.values(node)) collect(x, acc);
}

interface Loaded { readonly project: OpenISDProject; readonly repaired: readonly string[]; }

/** The fixture loaded the way the app loads it: `.owpr` through the repairing loader, `.wpr` through the converter. */
function load(file: string): Loaded {
  const engine = createEngine();
  const text = readFileSync(join(DIR, file), 'utf8');
  if (file.endsWith('.wpr')) {
    const result = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
    if (result.value === null || result.errors.length > 0) throw new Error(`${file}: ${JSON.stringify(result.errors)}`);
    return {project: result.value, repaired: []};
  }
  const result = OpenISDProject.fromOwprTextRepairing(text, engine);
  if (Array.isArray(result)) throw new Error(`${file}: ${result.join('; ')}`);
  return {project: result.project, repaired: result.repaired.map(path => JSON.stringify(path))};
}

function observe({project, repaired}: Loaded): Observed {
  const numbers: (number | null)[] = [];
  collect(project.sweep(GRID).values, numbers);
  collect(project.maxCurves(GRID).values, numbers);
  return {
    errors: null, repaired, modified: project.isModified(),
    T: project.envTempK.value ?? NaN, RH: project.envHumidityPct.value ?? NaN, p: project.envPressurePa.value ?? NaN,
    c: project.envC_m_per_s.value, rho: project.envRoo_kg_per_m3.value, numbers,
  };
}

const FIXTURES = readdirSync(DIR).filter(f => f.endsWith('.owpr') || f.endsWith('.wpr'));
const FROM_MAIN = FIXTURES.filter(f => !f.startsWith('saved-by-t375-'));
const FROM_THIS_BUILD = FIXTURES.filter(f => f.startsWith('saved-by-t375-'));

describe('a file the earlier build saved opens here as no event', () => {
  const golden = goldenFile('golden-main.json');

  it('has a fixture of each kind: air as C, no air, the sample project, a .wpr', () => {
    expect(FROM_MAIN.map(f => basename(f))).toEqual(expect.arrayContaining([
      'main-air-c-vented.owpr', 'main-air-c-sealed.owpr', 'main-no-air-vented.owpr', 'main-no-air-sealed.owpr',
      'sample-project.owpr', 'sample_project_vented.wpr',
    ]));
  });

  it.each(FROM_MAIN)('%s: no repair notice, not modified, and every Advanced value and chart number is the earlier build\'s', file => {
    const before = golden[file];
    if (before === undefined) throw new Error(`no golden for ${file}`);
    const now = observe(load(file));
    expect(now.repaired).toEqual([]);
    expect(before.repaired).toEqual([]);
    // A project file opens unmodified; the earlier build's converter hands back a .wpr import unsaved, and so does this one.
    expect(now.modified).toBe(before.modified);
    if (file.endsWith('.owpr')) expect(now.modified).toBe(false);
    expect(now.T).toBe(before.T);
    expect(now.RH).toBe(before.RH);
    expect(now.p).toBe(before.p);
    expect(now.c).toBe(before.c);
    expect(now.rho).toBe(before.rho);
    expect(now.numbers).toEqual(before.numbers);
    expect(now.numbers?.length).toBeGreaterThan(1000);
  });
});

describe('a file this build saves opens in the earlier build with the same numbers', () => {
  const inMain = goldenFile('golden-t375-in-main.json');

  it.each(FROM_THIS_BUILD)('%s: loads here with the values the earlier build read from it', file => {
    const before = inMain[file];
    if (before === undefined) throw new Error(`no golden for ${file}`);
    const now = observe(load(file));
    expect(now.repaired).toEqual([]);
    expect(now.modified).toBe(false);
    expect(now.T).toBe(before.T);
    expect(now.RH).toBe(before.RH);
    expect(now.p).toBe(before.p);
    expect(now.c).toBe(before.c);
    expect(now.rho).toBe(before.rho);
    expect(now.numbers).toEqual(before.numbers);
  });

  it('writes the two new keys, which the earlier build\'s strict schema does not know: it drops them and says so, twice per file', () => {
    for (const file of FROM_THIS_BUILD) {
      expect(readFileSync(join(DIR, file), 'utf8'), file).toContain('"c_m_per_s"');
      expect(inMain[file]?.repaired, file).toEqual(['["saved","environment","c_m_per_s"]', '["saved","environment","roo_kg_per_m3"]']);
    }
  });
});
