/**
 * bugs/archive/BUG_20260927_peaking-cut-notch-nan.md — leader ruling (2026-09-28): `gain = -Infinity` is
 * unreachable through the app (every filter's own `.update()` clamps to `FILTER_GAIN_LIMITS`, and
 * JSON text cannot carry `Infinity`/`NaN` at all — `JSON.parse('{"gain":-Infinity}')` is a syntax
 * error, never a value). The one remaining door is the LOAD schema itself
 * (`openisdSchema.ts`'s filter shapes) validating a JS object handed to it directly, bypassing
 * JSON text — e.g. a value parsed from some other source's own numeric text (a `.wpr` INI field,
 * a hostile or corrupted record).
 *
 * This file checks that door: every filter variant's every numeric field refuses `NaN`/
 * `Infinity`/`-Infinity` at `openISDProjectSessionJsonSchema.safeParse()`, the schema
 * `OpenISDProject.fromOwprText()` (the actual load entry point) calls.
 *
 * Investigation finding: this codebase's zod (v4.5.4) already makes `z.number()` reject
 * `NaN`/`±Infinity` as `invalid_type` — a bare `z.number()`, with no `.finite()`, already refuses
 * all three (this differs from zod v3, where `z.number()` accepted `Infinity` and needed an
 * explicit `.finite()`). Confirmed exhaustively below for every one of the ten filter variants'
 * numeric fields, so this is a REGRESSION LOCK — nothing here changed the filter shapes or the
 * filter math, only proved the existing schema already guards the boundary the bug named.
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import {ProjectBuilder} from '../../domain/index.js';
import {openISDProjectSessionJsonSchema} from '../../domain/openisdSchema.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';
import type {Filter} from '@openisd/design/engine';

/** A real, valid project session — built through the public domain surface, then cloned to a
 *  plain JS object (`cloneSession()`), never through JSON text: `JSON.stringify(-Infinity)` is
 *  `"null"`, which would silently turn the very value this file tests into something else. */
function sessionWithOneFilter(filter: Filter): unknown {
  const engine = createEngine();
  const driver = driverFromSpec(engine, {
    Fs_hz: 30, Qes: 0.4, Qms: 4, Sd_m2: 0.02, Cms_m_per_N: 0.0005,
  });
  const project = new ProjectBuilder(driver, engine).sealed().volume_m3(0.03).build();
  project.filters.set([filter]);
  project.save();
  return project.cloneSession();
}

/** The one peaking filter this file mutates — a valid baseline before each bad-value case. */
const validPeaking: Filter = {type: 'peaking', enabled: true, fc: 100, Q: 1, gain: 3};

/** Reaches into a cloned session's one filter and returns a fresh copy with `field` overwritten —
 *  never mutates the caller's session object. */
function withFilterField(session: unknown, field: string, value: number): unknown {
  const s = openISDProjectSessionJsonSchema.parse(session);
  const filters = s.saved.filters.filters;
  return {
    ...s,
    saved: {
      ...s.saved,
      filters: {...s.saved.filters, filters: [{...filters[0], [field]: value}]},
    },
  };
}

describe('BUG_20260927 — filter numerics reject NaN/Infinity at the load schema', () => {
  it('a valid peaking filter parses — the baseline every mutation below starts from', () => {
    const session = sessionWithOneFilter(validPeaking);
    expect(openISDProjectSessionJsonSchema.safeParse(session).success).toBe(true);
  });

  it('withFilterField itself is not what rejects things — a finite replacement still parses', () => {
    const session = sessionWithOneFilter(validPeaking);
    const mutated = withFilterField(session, 'gain', 12.5);
    expect(openISDProjectSessionJsonSchema.safeParse(mutated).success).toBe(true);
  });

  it.each(['fc', 'Q', 'gain'] as const)('peaking.%s rejects NaN, Infinity and -Infinity', (field) => {
    const session = sessionWithOneFilter(validPeaking);
    for (const bad of [NaN, Infinity, -Infinity]) {
      const result = openISDProjectSessionJsonSchema.safeParse(withFilterField(session, field, bad));
      expect(result.success, `${field}=${bad} was accepted`).toBe(false);
    }
  });

  it('staticGain.gain rejects NaN, Infinity and -Infinity', () => {
    const session = sessionWithOneFilter({type: 'staticGain', enabled: true, gain: 3});
    for (const bad of [NaN, Infinity, -Infinity]) {
      const result = openISDProjectSessionJsonSchema.safeParse(withFilterField(session, 'gain', bad));
      expect(result.success, `gain=${bad} was accepted`).toBe(false);
    }
  });

  it('peakHighpass.fpk and .gainPk reject NaN, Infinity and -Infinity', () => {
    const session = sessionWithOneFilter({type: 'peakHighpass', enabled: true, fpk: 100, gainPk: 3});
    for (const field of ['fpk', 'gainPk']) {
      for (const bad of [NaN, Infinity, -Infinity]) {
        const result = openISDProjectSessionJsonSchema.safeParse(withFilterField(session, field, bad));
        expect(result.success, `${field}=${bad} was accepted`).toBe(false);
      }
    }
  });

  it('raisedCosine.fc/.bwOct/.gain reject NaN, Infinity and -Infinity', () => {
    const session = sessionWithOneFilter({type: 'raisedCosine', enabled: true, fc: 100, bwOct: 1, gain: 3});
    for (const field of ['fc', 'bwOct', 'gain']) {
      for (const bad of [NaN, Infinity, -Infinity]) {
        const result = openISDProjectSessionJsonSchema.safeParse(withFilterField(session, field, bad));
        expect(result.success, `${field}=${bad} was accepted`).toBe(false);
      }
    }
  });

  it.each(['lowshelf', 'highshelf'] as const)('%s.fc/.Q/.gain reject NaN, Infinity and -Infinity', (type) => {
    const session = sessionWithOneFilter({type, enabled: true, fc: 100, Q: 1, gain: 3});
    for (const field of ['fc', 'Q', 'gain']) {
      for (const bad of [NaN, Infinity, -Infinity]) {
        const result = openISDProjectSessionJsonSchema.safeParse(withFilterField(session, field, bad));
        expect(result.success, `${type}.${field}=${bad} was accepted`).toBe(false);
      }
    }
  });

  it.each(['lowpass', 'highpass'] as const)('%s.order/.fc/.Q reject NaN, Infinity and -Infinity', (type) => {
    const session = sessionWithOneFilter({type, enabled: true, family: 'butterworth', order: 2, fc: 100, Q: 1});
    for (const field of ['order', 'fc', 'Q']) {
      for (const bad of [NaN, Infinity, -Infinity]) {
        const result = openISDProjectSessionJsonSchema.safeParse(withFilterField(session, field, bad));
        expect(result.success, `${type}.${field}=${bad} was accepted`).toBe(false);
      }
    }
  });

  it('allpass.order/.t/.Q reject NaN, Infinity and -Infinity', () => {
    const session = sessionWithOneFilter({type: 'allpass', enabled: true, order: 2, t: 0.01, Q: 1});
    for (const field of ['order', 't', 'Q']) {
      for (const bad of [NaN, Infinity, -Infinity]) {
        const result = openISDProjectSessionJsonSchema.safeParse(withFilterField(session, field, bad));
        expect(result.success, `${field}=${bad} was accepted`).toBe(false);
      }
    }
  });

  it('linkwitz.f0/.Q0/.fp/.Qp reject NaN, Infinity and -Infinity', () => {
    const session = sessionWithOneFilter({type: 'linkwitz', enabled: true, f0: 100, Q0: 1, fp: 100, Qp: 1});
    for (const field of ['f0', 'Q0', 'fp', 'Qp']) {
      for (const bad of [NaN, Infinity, -Infinity]) {
        const result = openISDProjectSessionJsonSchema.safeParse(withFilterField(session, field, bad));
        expect(result.success, `${field}=${bad} was accepted`).toBe(false);
      }
    }
  });
});
