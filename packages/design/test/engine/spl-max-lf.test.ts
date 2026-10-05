import type {TestSolverQuantities} from './testSolver.js';
import {solveConsistencyGroup} from './testSolver.js';
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {createEngine} from '../../engine/index.js';
import type {Air} from '../../engine/index.js';

/** The engine's one door: every calculation below is a method on this object. */
const engine = createEngine();

// TYPED, not `Record<string, number>` with a cast on each end. The cast this replaces made every
// name in this file invisible to the compiler: stale keys went in, matched nothing, and every
// derived figure came back `undefined` while the suite still built.
const solve = (d: TestSolverQuantities, air?: Air): Readonly<TestSolverQuantities> =>
  solveConsistencyGroup(d, air);

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

describe('SPLmaxLF', () => {
  describe('SPLmaxLF — the excursion-limited 20 Hz SPL, at the record\'s own air', () => {
    it('reproduces the WinISD-authored file at WinISD\'s own ρ₀', () => {
      const r = solve({ ...ORACLE_INPUTS });
      assert.equal(ORACLE.roo, 1.20095217714682, 'the oracle must carry WinISD\'s own air density');
      assert.ok(rel(derived(r.SPLmaxLF_dB, 'SPLmaxLF_dB'), ORACLE.SPLmaxLF) < 1e-12,
        `SPLmaxLF = ${r.SPLmaxLF_dB}, WinISD wrote ${ORACLE.SPLmaxLF} (relative ${rel(derived(r.SPLmaxLF_dB, 'SPLmaxLF_dB'), ORACLE.SPLmaxLF)})`);
    });

    it('tracks the ρ₀ of the air it is solved in — it is not a hardcoded 1.20095', () => {
      // Probes `splmaxlf_roo0.9` / `splmaxlf_roo1.5`: identical drivers, `roo` alone changed.
      // WinISD moves SPLmaxLF by 20·log₁₀(ρ ratio), so a constant baked into the formula would
      // print the same number twice. OpenISD takes that air from the project, never the record
      // (John, 2026-10-05), so the probes' air is handed in as the project's.
      const base = { Fs_hz: 40, Xmax_m: 0.0067, Sd_m2: 0.022, Vd_m3: 0.0001474, Mms_kg: 0.00194848430081419, Qes: 0.19251724527664, Re_ohm: 14.1525718647402 };
      const c = 343.684120962153;
      const light = solve(base, { c, rho: 0.9 });
      const heavy = solve(base, { c, rho: 1.5 });
      assert.ok(rel(derived(light.SPLmaxLF_dB, 'SPLmaxLF_dB'), 81.4286971830493) < 1e-12, `ρ₀=0.9 → ${light.SPLmaxLF_dB}`);
      assert.ok(rel(derived(heavy.SPLmaxLF_dB, 'SPLmaxLF_dB'), 85.8656721753764) < 1e-12, `ρ₀=1.5 → ${heavy.SPLmaxLF_dB}`);
    });

    it('falls back to the live reference-environment density when the record carries none', () => {
      const noAir = solve({ Fs_hz: 40, Xmax_m: 0.0067, Sd_m2: 0.022 });
      const withRho = solve({ Fs_hz: 40, Xmax_m: 0.0067, Sd_m2: 0.022, roo_kg_per_m3: engine.environment.solve({}).values.rho });
      assert.equal(noAir.SPLmaxLF_dB, withRho.SPLmaxLF_dB);
    });

    it('needs Vd — a driver with no volume displacement gets no SPLmaxLF', () => {
      assert.equal(solve({ Fs_hz: 40, Re_ohm: 6, Qes: 0.4 }).SPLmaxLF_dB, undefined);
    });

    it('never overwrites an entered value', () => {
      assert.equal(solve({ ...ORACLE_INPUTS, SPLmaxLF_dB: 42 }).SPLmaxLF_dB, 42);
    });
  });
});
