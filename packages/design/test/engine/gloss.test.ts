import type {TestSolverQuantities} from './testSolver.js';
import {solveConsistencyGroup} from './testSolver.js';
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

// TYPED, not `Record<string, number>` with a cast on each end. The cast this replaces made every
// name in this file invisible to the compiler: stale keys went in, matched nothing, and every
// derived figure came back `undefined` while the suite still built.
const solve = (d: TestSolverQuantities): Readonly<TestSolverQuantities> =>
  solveConsistencyGroup(d);

const here = dirname(fileURLToPath(import.meta.url));

const SAMPLES = join(here, '..', '..', '..', '..', 'drivers', 'myprobes', 'per_field_and_misc');

/** Every `key=value` line of a `.wdr`, as numbers. */
function wdrNumbers(name: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const line of readFileSync(join(SAMPLES, name), 'utf8').split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i < 0 || line[0] === '[') continue;
    const n = parseFloat(line.slice(i + 1).trim());
    if (isFinite(n)) out[line.slice(0, i).trim()] = n;
  }
  return out;
}

/** The WinISD-authored oracle, and the inputs it computed its Advanced pane from. */
const ORACLE = wdrNumbers('john-all-noncalc-fields-manually-entered.wdr');

// The left of each pair is the solver's unit-suffixed name; the right is the `.wdr` key, which is
// WinISD's own spelling and is not ours to rename. This IS the mapping between the two vocabularies.
const ORACLE_INPUTS: TestSolverQuantities = {
  Fs_hz: ORACLE.Fs, Mms_kg: ORACLE.Mms, Xmax_m: ORACLE.Xmax, Qes: ORACLE.Qes, Qms: ORACLE.Qms,
  Re_ohm: ORACLE.Re, Sd_m2: ORACLE.Sd, Vd_m3: ORACLE.Vd, Hc_m: ORACLE.Hc, Hg_m: ORACLE.Hg,
  c_m_per_s: ORACLE.c, roo_kg_per_m3: ORACLE.roo,
};

/** A figure the solver was expected to derive. Every `any` member is optional —
 *  absent means "not derived" — so reading one for an assertion has to say which it is. A missing
 *  derivation then fails as `Rme_kg_per_s was not derived`, where bare arithmetic on `undefined`
 *  yielded a NaN comparison and a message that named no cause. */
function derived(v: number | undefined, name: string): number {
  assert.ok(v !== undefined, `${name} was not derived`);
  return v;
}

/** |got − want|/|want| — the residual the recovery campaign reports. */
const rel = (got: number, want: number): number => Math.abs(got - want) / Math.abs(want);

describe('Gloss', () => {
  describe('Gloss — the static cone sag, as a FRACTION of Xmax', () => {
    it('reproduces the WinISD-authored file, whose ParState marks Gloss computed', () => {
      const r = solve({ ...ORACLE_INPUTS });
      assert.ok(rel(derived(r.Gloss, 'Gloss'), ORACLE.Gloss) < 1e-12,
        `Gloss = ${r.Gloss}, WinISD wrote ${ORACLE.Gloss} (relative ${rel(derived(r.Gloss, 'Gloss'), ORACLE.Gloss)})`);
    });

    it('is written under the record\'s ONE name for the quantity, `Gloss`', () => {
      // The record field and the `.wdr` key are both `Gloss` — one name, on disk and in memory
      // alike. A second key holding the same number would be a second name for one concept.
      const r = solve({ ...ORACLE_INPUTS });
      assert.equal(Object.keys(r).includes('loss'), false,
        'the solver must not invent a second key for the quantity `Gloss` already names');
    });

    it('follows the STORED Fs, not the Fs that Mms·Cms implies', () => {
      // Probe `gloss_incon_double` (winisd_research/runs/advanced_formulas.jsonl): Fs is written
      // as 200 while Mms·Cms give 100, which separates g/((2π·Fs)²·Xmax) from the rival
      // g·Mms·Cms/Xmax. The rival is exact on every self-consistent driver and 4× out here.
      const r = solve({
        Fs_hz: 200, Xmax_m: 0.0067, Mms_kg: 0.00194848430081419, Cms_m_per_N: 0.0013,
        Qes: 0.4812931131916, Qms: 2.1, Re_ohm: 14.1525718647402, BL_Tm: 6, Sd_m2: 0.022,
        roo_kg_per_m3: 1.20095217714682, c_m_per_s: 343.684120962152,
      });
      assert.ok(rel(derived(r.Gloss, 'Gloss'), 0.000926885620863929) < 1e-12,
        `Gloss = ${r.Gloss}, WinISD gave 0.000926885620863929`);
      const rival = 9.80665 * 0.00194848430081419 * 0.0013 / 0.0067;
      assert.ok(rel(derived(r.Gloss, 'Gloss'), rival) > 0.5, `Gloss must not have come from g·Mms·Cms/Xmax (${rival})`);
    });

    it('needs both Fs and Xmax — neither alone invents a sag', () => {
      assert.equal(solve({ Fs_hz: 40, Mms_kg: 0.002 }).Gloss, undefined);
      assert.equal(solve({ Xmax_m: 0.0067, Sd_m2: 0.022 }).Gloss, undefined);
    });

    it('never overwrites an entered value', () => {
      assert.equal(solve({ ...ORACLE_INPUTS, Gloss: 0.5 }).Gloss, 0.5);
    });
  });
});
