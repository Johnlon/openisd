/**
 * Reference efficiency η₀ and the 1 W/1 m sensitivity derived from it — the ONE
 * implementation, in `@openisd/engine`.
 *
 * 🔒 ORACLE (SPEC_ENGINE §4.7 oracle rule): `drivers/sample/winisd/John-all-manu-populated.wdr`,
 * a genuine WinISD save by johnl. It carries its OWN air properties (`c`, `roo`) alongside the
 * `no` and `SPL` WinISD computed from them, so it pins the formula AND the constant together.
 * A third-party database's export of driver data into `.wdr` shape may never be an oracle.
 *
 * Two facts this file exists to pin:
 *   1. `no` is a FRACTION, never a percent.
 *   2. The additive SPL constant is NOT a literal. It is K = 10·log₁₀(ρ·c / (2π·p_ref²)),
 *      derived from the air actually in use. 109 / 112.1 / 112.2 are rounded approximations
 *      of it, and openisd's ρ and c vary with temperature/pressure/humidity (ledger QO7), so
 *      K must move with them.
 */

import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import {
  efficiencyConstant, referenceEfficiency, splReferenceConstantDb,
  splFromEfficiency, efficiencyFromSpl, P0,
} from '@openisd/engine';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = join(here, '..', '..', '..');
const ORACLE = join(REPO, 'drivers', 'sample', 'winisd', 'John-all-manu-populated.wdr');

/** `key=value` lines of a `.wdr`, as numbers. */
function wdrNumbers(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const line of text.split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i < 0 || line[0] === '[') continue;
    const v = parseFloat(line.slice(i + 1).trim());
    if (isFinite(v)) out[line.slice(0, i).trim()] = v;
  }
  return out;
}

const W = wdrNumbers(readFileSync(ORACLE, 'utf8'));

describe('reference efficiency η₀ — WinISD oracle', () => {
  it('the oracle carries every value the formulas need (guards against a silent fixture change)', () => {
    for (const k of ['Fs', 'Vas', 'Qes', 'no', 'SPL', 'c', 'roo', 'BL', 'Sd', 'Re', 'Mms'])
      assert.ok(W[k] > 0, `oracle must carry a positive ${k}, got ${W[k]}`);
  });

  it('reproduces WinISD\'s stored `no` from Fs/Vas/Qes with the file\'s own c', () => {
    const got = referenceEfficiency(W.Fs, W.Vas, W.Qes, W.c);
    assert.ok(Math.abs(got - W.no) <= Math.abs(W.no) * 1e-12,
      `no: got ${got}, WinISD stored ${W.no} (rel ${(got - W.no) / W.no})`);
  });

  it('agrees with the independent motor-side route ρ/(2πc)·BL²Sd²/(Re·Mms²)', () => {
    // Not the formula under test — a second, physically independent route to the same η₀.
    // If both reproduce the stored value, the stored value is not a coincidence of one algebra.
    const motorSide = (W.roo / (2 * Math.PI * W.c)) * (W.BL ** 2 * W.Sd ** 2) / (W.Re * W.Mms ** 2);
    assert.ok(Math.abs(motorSide - W.no) <= Math.abs(W.no) * 1e-12,
      `motor-side route: ${motorSide} vs stored ${W.no}`);
    const got = referenceEfficiency(W.Fs, W.Vas, W.Qes, W.c);
    assert.ok(Math.abs(got - motorSide) <= Math.abs(motorSide) * 1e-12);
  });

  it('η₀ is a FRACTION — the oracle\'s value is ~8.8e-6, not ~8.8e-4', () => {
    assert.ok(W.no < 1e-3, `a percent reading would be 100× larger; stored ${W.no}`);
    assert.ok(referenceEfficiency(W.Fs, W.Vas, W.Qes, W.c) < 1e-3);
  });

  it('efficiencyConstant(c) is 4π²/c³ and moves with c', () => {
    assert.ok(Math.abs(efficiencyConstant(W.c) - 4 * Math.PI ** 2 / W.c ** 3) < 1e-30);
    assert.ok(efficiencyConstant(340) > efficiencyConstant(350), 'a faster c gives a smaller constant');
  });
});

describe('SPL from η₀ — the constant is DERIVED, never a literal', () => {
  it('reproduces WinISD\'s stored SPL from its stored `no` and its own ρ and c', () => {
    const got = splFromEfficiency(W.no, W.roo, W.c);
    assert.ok(Math.abs(got - W.SPL) < 1e-9, `SPL: got ${got}, WinISD stored ${W.SPL}`);
  });

  it('reproduces the stored SPL end-to-end from Fs/Vas/Qes alone', () => {
    const no = referenceEfficiency(W.Fs, W.Vas, W.Qes, W.c);
    assert.ok(Math.abs(splFromEfficiency(no, W.roo, W.c) - W.SPL) < 1e-9);
  });

  it('K = 10·log₁₀(ρ·c/(2π·p_ref²)) — and 112.1 / 112.2 are its rounded approximations', () => {
    const K = splReferenceConstantDb(W.roo, W.c);
    assert.ok(Math.abs(K - 10 * Math.log10(W.roo * W.c / (2 * Math.PI * P0 * P0))) < 1e-12);
    // The two literals this replaces sit either side of K, by less than a rounding step.
    assert.ok(Math.abs(K - 112.1) > 0.05 && Math.abs(K - 112.1) < 0.06, `K−112.1 = ${K - 112.1}`);
    assert.ok(Math.abs(K - 112.2) > 0.04 && Math.abs(K - 112.2) < 0.05, `K−112.2 = ${K - 112.2}`);
  });

  it('K MOVES with the air — a 20 °C → 30 °C change shifts it by ~0.07 dB (QO7: ρ and c vary)', () => {
    // Dry air at 1 atm: c = 331.3·√(1+T/273.15), ρ = 1.2041·(293.15/T_K).
    const air = (tC: number) => ({ c: 331.3 * Math.sqrt(1 + tC / 273.15), rho: 1.2041 * (293.15 / (tC + 273.15)) });
    const a20 = air(20), a30 = air(30);
    const d = splReferenceConstantDb(a30.rho, a30.c) - splReferenceConstantDb(a20.rho, a20.c);
    assert.ok(Math.abs(d) > 0.05 && Math.abs(d) < 0.1, `20→30 °C must move K by ~0.07 dB, got ${d}`);
  });

  it('efficiencyFromSpl is the exact inverse of splFromEfficiency', () => {
    const back = efficiencyFromSpl(splFromEfficiency(W.no, W.roo, W.c), W.roo, W.c);
    assert.ok(Math.abs(back - W.no) <= Math.abs(W.no) * 1e-12, `${back} vs ${W.no}`);
  });
});

describe('no duplicate implementation survives', () => {
  /** Every `.ts`/`.vue` under a package's `src/`. */
  function sources(dir: string, acc: string[] = []): string[] {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) sources(p, acc);
      else if (extname(p) === '.ts' || extname(p) === '.vue') acc.push(p);
    }
    return acc;
  }

  /** Strip block and line comments so the scan reads CODE, not prose about the code. */
  function code(text: string): string {
    return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  }

  it('112.1 and 112.2 appear in no source file — the constant is derived, so no literal exists', () => {
    const offenders: string[] = [];
    for (const pkg of ['engine', 'winisd', 'ui']) {
      for (const f of sources(join(REPO, 'packages', pkg, 'src'))) {
        if (/\b112\.[12]\b/.test(code(readFileSync(f, 'utf8')))) offenders.push(f);
      }
    }
    assert.deepEqual(offenders, [], `hardcoded SPL constant still present in:\n  ${offenders.join('\n  ')}`);
  });

  it('the η₀ formula 4π²/c³ is written once — only in the engine\'s efficiency module', () => {
    const offenders: string[] = [];
    for (const pkg of ['engine', 'winisd', 'ui']) {
      for (const f of sources(join(REPO, 'packages', pkg, 'src'))) {
        if (f.endsWith(join('engine', 'src', 'efficiency.ts'))) continue;
        if (/4\s*\*\s*Math\.PI\s*\*\*\s*2\s*\/|4\s*\*\s*Math\.PI\s*\*\*\s*2\s*\)\s*\//.test(code(readFileSync(f, 'utf8'))))
          offenders.push(f);
      }
    }
    assert.deepEqual(offenders, [], `η₀ constant re-derived in:\n  ${offenders.join('\n  ')}`);
  });
});
