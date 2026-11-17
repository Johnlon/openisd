/**
 * Data version 5 (QO941; John, QO942.c54/c56, QO946.c18/c23): "migration is just to rename the field": the project's saved
 * `wiring` key is named `VCCon` (as the driver's), its value kept exactly as saved; no notice, nothing retired. Consequence
 * (reported to John): a dual-coil series-measured driver saved with `wiring: "parallel"` (the old default, written explicitly
 * in production) opens with its coils wired in parallel: Re 1.175 ohm, BL 6.15 Tm instead of the published 4.70 and 12.30.
 *
 * Fixtures are real-shaped: the three projects copied from a production browser store (schemaVersion 3, data version 3,
 * `packages/persistence/test/fixtures/stored-v3-projects.json`: RS225-8 single coil, MX6-22 dual coil, GF 250 dual
 * coil), taken through the real upgrade steps; the test-site shapes are made from them by the same steps and the
 * fields the test-site builds wrote (`coilWiring`).
 */
import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {OpenISDProject} from '../../domain/project/openISDProject.js';
import {createEngine} from '../../engine/Engine.js';
import {CURRENT_SCHEMA_VERSION, upgradeToCurrent} from '../../domain/schemaVersion.js';

type Plain = Record<string, unknown>;
const FIXTURE = '../../../persistence/test/fixtures/stored-v3-projects.json';
function rec(v: unknown): Plain {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error('not an object');
  return Object.fromEntries(Object.entries(v));
}
const entries: readonly Plain[] = (() => {
  const list: unknown = rec(JSON.parse(readFileSync(new URL(FIXTURE, import.meta.url), 'utf8'))).entries;
  if (!Array.isArray(list)) throw new Error('no entries');
  return list.map((e: unknown) => rec(e));
})();
const engine = createEngine();

function entryNamed(model: string): Plain {
  const found = entries.find(e => typeof e.text === 'string' && e.text.includes(model));
  if (found === undefined || typeof found.text !== 'string') throw new Error(`no ${model} in the production fixture`);
  return rec(JSON.parse(found.text));
}

/** The embedding of every state (saved and edited) of a session, changed by `change`. */
function withEmbedding(session: Plain, change: (embedding: Plain) => Plain): Plain {
  const out: Plain = {...session};
  for (const state of ['saved', 'edited']) {
    const s = out[state];
    if (typeof s === 'object' && s !== null) out[state] = {...rec(s), driverEmbedding: change(rec(rec(s).driverEmbedding))};
  }
  return out;
}

function embeddingOf(session: unknown, state: 'saved' | 'edited' = 'saved'): Plain {
  return rec(rec(rec(session)[state]).driverEmbedding);
}

function loaded(session: unknown): OpenISDProject {
  const project = OpenISDProject.fromOwprText(JSON.stringify(session), engine);
  if (Array.isArray(project)) throw new Error(project.join('; '));
  return project;
}

function upgraded(session: Plain): unknown {
  const result = upgradeToCurrent(session);
  if ('refusal' in result) throw new Error(result.refusal);
  return result.value;
}

describe('data version 5', () => {
  it('is the current version', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(6);
  });

  it('production v3, MX6-22 (series-measured) saved with wiring "parallel": the key is renamed, the value kept, the coils open wired in parallel', () => {
    const v3 = entryNamed('MX6-22');
    expect(embeddingOf(v3).wiring).toBe('parallel');
    const up = upgraded(v3);
    expect(embeddingOf(up)).not.toHaveProperty('wiring');
    expect(embeddingOf(up).VCCon).toBe('parallel');
    const project = loaded(up);
    expect(project.coilWiring.mine).toBe('parallel');
    expect(project.coilWiring.atMine.Re_ohm).toBeCloseTo(1.175, 9);
    expect(project.coilWiring.atMine.BL_Tm).toBeCloseTo(6.15, 9);
    expect(project.driver.specs.Re_ohm.value).toBeCloseTo(4.7, 9);
  });

  it.each([['series'], ['parallel']] as const)('production v3, every project: wiring "%s" becomes VCCon "%s", nothing else kept', (value) => {
    for (const model of ['RS225-8', 'MX6-22', 'GF 250']) {
      const up = upgraded(withEmbedding(entryNamed(model), e => ({...e, wiring: value, nDrivers: 2})));
      expect(embeddingOf(up), model).not.toHaveProperty('wiring');
      expect(embeddingOf(up), model).not.toHaveProperty('retiredArrayWiring');
      expect(embeddingOf(up).VCCon, model).toBe(value);
    }
  });

  it('a project that saved no wiring has none after: it follows the driver\'s own VCCon', () => {
    const v3 = withEmbedding(entryNamed('MX6-22'), e => Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'wiring')));
    const up = upgraded(v3);
    expect(embeddingOf(up)).not.toHaveProperty('VCCon');
    expect(loaded(up).coilWiring.mine).toBe('series');
  });

  it('test-site v4 without coilWiring: its wiring is renamed too', () => {
    const v4 = withEmbedding(upgraded4(entryNamed('MX6-22')), e => ({...e, wiring: 'series'}));
    const up = upgraded(v4);
    expect(embeddingOf(up)).not.toHaveProperty('wiring');
    expect(embeddingOf(up).VCCon).toBe('series');
  });

  it('test-site v4 with coilWiring parallel: it is the VCCon, and the coils are wired as the user chose', () => {
    const v4 = withEmbedding(upgraded4(entryNamed('MX6-22')), e => ({...e, wiring: 'series', coilWiring: 'parallel'}));
    const up = upgraded(v4);
    expect(embeddingOf(up).VCCon).toBe('parallel');
    expect(embeddingOf(up)).not.toHaveProperty('wiring');
    expect(embeddingOf(up)).not.toHaveProperty('coilWiring');
    const project = loaded(up);
    expect(project.coilWiring.mine).toBe('parallel');
    expect(project.coilWiring.atMine.Re_ohm).toBeCloseTo(1.175, 9);
    expect(project.coilWiring.atMine.BL_Tm).toBeCloseTo(6.15, 9);
    expect(project.driver.specs.Re_ohm.value).toBeCloseTo(4.7, 9);
  });

  it('a version 5 project is not upgraded again: its VCCon stays', () => {
    const v5 = withEmbedding(rec(upgraded(entryNamed('MX6-22'))), e => ({...e, VCCon: 'parallel'}));
    expect(embeddingOf(upgraded(v5)).VCCon).toBe('parallel');
  });
});

/** A production v3 session taken through the steps below version 5 only (what a test-site build before the change wrote). */
function upgraded4(session: Plain): Plain {
  const result = upgradeToCurrent(session, 4);
  if ('refusal' in result) throw new Error(result.refusal);
  return rec(result.value);
}
