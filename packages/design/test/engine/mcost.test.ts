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

describe('Mcost', () => {
  describe('Mcost — Rme scaled by how far the coil leaves the gap', () => {
    it('reproduces the WinISD-authored file, on the Rme that precedence produced', () => {
      const r = solve({ ...ORACLE_INPUTS });
      assert.ok(rel(derived(r.Rme_kg_per_s, 'Rme_kg_per_s'), ORACLE.Rme) < 1e-12, `Rme = ${r.Rme_kg_per_s}, WinISD wrote ${ORACLE.Rme}`);
      assert.ok(rel(derived(r.Mcost_kg_per_s, 'Mcost_kg_per_s'), ORACLE.Mcost) < 1e-12,
        `Mcost = ${r.Mcost_kg_per_s}, WinISD wrote ${ORACLE.Mcost} (relative ${rel(derived(r.Mcost_kg_per_s, 'Mcost_kg_per_s'), ORACLE.Mcost)})`);
    });

    it('reads Xmax itself, not the excursion the gap geometry implies', () => {
      // Probe `mcost2_xmaxincon_hi`: Xmax is written as 0.009 while |Hc−Hg|/2 is 0.003, which
      // separates Rme·(1 + Xmax/min) from the rival Rme·(Hc+Hg)/(2·min). The rival is exact
      // whenever Xmax = |Hc−Hg|/2 and 40 % out here.
      const r = solve({
        Fs_hz: 40, Xmax_m: 0.009, Hc_m: 0.012, Hg_m: 0.006, Mms_kg: 0.00194848430081419,
        Qes: 0.19251724527664, Re_ohm: 14.1525718647402, BL_Tm: 6, Sd_m2: 0.022,
        roo_kg_per_m3: 1.20095217714682, c_m_per_s: 343.684120962153,
      });
      assert.ok(rel(derived(r.Mcost_kg_per_s, 'Mcost_kg_per_s'), 6.35926818532726) < 1e-12, `Mcost = ${r.Mcost_kg_per_s}, WinISD gave 6.35926818532726`);
      const rival = derived(r.Rme_kg_per_s, 'Rme_kg_per_s') * (0.012 + 0.006) / (2 * 0.006);
      assert.ok(rel(derived(r.Mcost_kg_per_s, 'Mcost_kg_per_s'), rival) > 0.2, `Mcost must not have come from Rme·(Hc+Hg)/(2·min) (${rival})`);
    });

    it('reduces to Rme when the coil never leaves the gap', () => {
      const r = solve({ Fs_hz: 40, Mms_kg: 0.002, Qes: 0.4, Xmax_m: 0, Hc_m: 0.012, Hg_m: 0.006 });
      assert.equal(r.Mcost_kg_per_s, r.Rme_kg_per_s);
    });

    it('is ABSENT — not 0, not Infinity — when min(Hc, Hg) is zero', () => {
      // Hc and Hg are 0 on essentially every real record, which is the only reason WinISD's own
      // files read Mcost=0: min(Hc,Hg) is the divisor. A blank is honest; 0 and Infinity are
      // both a number the driver does not have.
      const gaps: Record<string, number>[] = [{ Hc_m: 0, Hg_m: 0 }, { Hc_m: 0.012, Hg_m: 0 }, { Hc_m: 0, Hg_m: 0.006 }, {}];
      for (const gap of gaps) {
        const r = solve({ Fs_hz: 40, Mms_kg: 0.002, Qes: 0.4, Xmax_m: 0.005, ...gap });
        assert.ok(derived(r.Rme_kg_per_s, 'Rme_kg_per_s') > 0, 'the Rme this scales must have been derived');
        assert.equal(r.Mcost_kg_per_s, undefined, `Mcost = ${r.Mcost_kg_per_s} for ${JSON.stringify(gap)}`);
      }
    });

    it('never overwrites an entered value', () => {
      assert.equal(solve({ ...ORACLE_INPUTS, Mcost_kg_per_s: 7 }).Mcost_kg_per_s, 7);
    });
  });
});
