/**
 * WinISD's Advanced-pane figures of merit — Rme, Mpow, gamma, SPLmax, USPL, Gloss, SPLmaxLF,
 * Mcost.
 *
 * The human's ruling (ledger QO24, 2026-08-13): on that panel `alfaVC`, `Rt` and `Ct` are the
 * only MANUAL fields; everything else is CALCULATED. Deleting Rme in WinISD makes it fill the
 * value back in, and a `Fs` edit moves the whole set — so these are not stored pass-throughs.
 *
 * Formulas, pinned in winisd_research/KNOWLEDGE_REPORT.md §4 and SOLVER_GAPS.md §2.4:
 *     Rme      = BL²/Re = 2π·Fs·Mms/Qes
 *     Mpow     = BL/√Re = √Rme
 *     gamma    = BL/Mms
 *     SPLmax   = SPL + 10·log₁₀(Pe)
 *     USPL     = SPL + 10·log₁₀(8/Re)        (8 = 2.83²)
 *     Gloss    = g/((2π·Fs)²·Xmax)           g = 9.80665, the FRACTION of Xmax
 *     SPLmaxLF = 20·log₁₀(ρ₀·(2π·20)²·Vd/(2π·√2)/20 µPa)
 *     Mcost    = Rme·(1 + Xmax/min(Hc, Hg))
 *
 * 🔒 The Rme PRECEDENCE is the load-bearing part. The two routes are algebraically identical
 * whenever `Bl = √(2π·Fs·Mms·Re/Qes)` holds, so they only diverge on a record whose stored Bl
 * does not agree with its own Fs/Mms/Re/Qes — and real records do diverge. On the Beyma
 * 10BR60/V2 fixture (winisd_research/CALC_FINDINGS_FOR_REVIEW.md, the batch-recompute session)
 * `2π·Fs·Mms/Qes` gives 18.22124 and `Bl²/Re` gives 18.27846. The first wins. `Mcost` consumes
 * whichever Rme that precedence produced; it never recomputes one of its own.
 *
 * 🔒 ORACLE for the last three: `drivers/sample/winisd/john-all-noncalc-fields-manually-entered.wdr`
 * — a file WinISD itself wrote, carrying all of Fs/Xmax/Vd/roo/Hc/Hg alongside WinISD's own
 * Rme/Gloss/SPLmaxLF/Mcost, with ParState slots 27/34/36/37 all `C` (WinISD computed them).
 * The discriminator drivers, which separate each recovered formula from a rival that fits every
 * self-consistent record, are transcribed from winisd_research/runs/advanced_formulas.jsonl by
 * probe label.
 */

import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { solveConsistencyGroup, RHO, type DriverRaw } from '@openisd/engine';

/** Beyma 10BR60/V2, the real fixture whose stored Bl disagrees with its own Fs/Mms/Re/Qes. */
const BEYMA = { Fs: 29.0, Mms: 0.044, Cms: 0.000693, Rms: 2.4, Bl: 10.9, Re: 6.5, Qes: 0.44, Qms: 3.3, Sd: 0.038 };

const solve = (d: Record<string, number>) =>
  solveConsistencyGroup(d as unknown as DriverRaw, { full: true }) as unknown as Record<string, number>;

const here = dirname(fileURLToPath(import.meta.url));
const SAMPLES = join(here, '..', '..', '..', 'drivers', 'sample', 'winisd');

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
const ORACLE_INPUTS = {
  Fs: ORACLE.Fs, Mms: ORACLE.Mms, Xmax: ORACLE.Xmax, Qes: ORACLE.Qes, Qms: ORACLE.Qms,
  Re: ORACLE.Re, Sd: ORACLE.Sd, Vd: ORACLE.Vd, Hc: ORACLE.Hc, Hg: ORACLE.Hg,
  c: ORACLE.c, roo: ORACLE.roo,
};

/** |got − want|/|want| — the residual the recovery campaign reports. */
const rel = (got: number, want: number): number => Math.abs(got - want) / Math.abs(want);

describe('Rme — the two routes, and which one wins', () => {
  it('takes 2π·Fs·Mms/Qes (18.22124), NOT Bl²/Re (18.27846), when both are available', () => {
    const r = solve({ ...BEYMA });
    assert.ok(Math.abs(r.Rme - 18.2212373908208) < 1e-9, `Rme = ${r.Rme}`);
    assert.ok(Math.abs(r.Rme - 18.27846153846154) > 0.05, 'Rme must not have come from Bl²/Re');
  });

  it('falls back to Bl²/Re when the motional route is short of an input', () => {
    const r = solve({ Bl: BEYMA.Bl, Re: BEYMA.Re });
    assert.ok(Math.abs(r.Rme - 18.27846153846154) < 1e-9, `Rme = ${r.Rme}`);
  });

  it('is absent when neither route can be evaluated', () => {
    assert.equal(solve({ Fs: 29, Mms: 0.044 }).Rme, undefined);
  });

  it('never overwrites an entered Rme — WinISD fixed-E semantics', () => {
    assert.equal(solve({ ...BEYMA, Rme: 99 }).Rme, 99);
  });
});

describe('Mpow, gamma', () => {
  it('Mpow is √Rme, so it follows the same route Rme took', () => {
    const r = solve({ ...BEYMA });
    assert.ok(Math.abs(r.Mpow - Math.sqrt(r.Rme)) < 1e-12, `Mpow = ${r.Mpow}, √Rme = ${Math.sqrt(r.Rme)}`);
    assert.ok(Math.abs(r.Mpow - 4.268634136444677) < 1e-9);
  });

  it('gamma = Bl/Mms', () => {
    const r = solve({ ...BEYMA });
    assert.ok(Math.abs(r.gamma - 10.9 / 0.044) < 1e-9, `gamma = ${r.gamma}`);
  });

  it('neither overwrites an entered value', () => {
    const r = solve({ ...BEYMA, Mpow: 7, gamma: 11 });
    assert.equal(r.Mpow, 7);
    assert.equal(r.gamma, 11);
  });
});

describe('SPLmax and USPL — both offsets from the ONE reference sensitivity', () => {
  // Vas and Pe complete the efficiency chain; the reference SPL itself comes from
  // efficiency.ts (via `no` → `SPLref`), which is what these two are offsets from.
  const FULL = { ...BEYMA, Vas: 0.055, Pe: 300 };

  it('SPLmax = SPLref + 10·log₁₀(Pe)', () => {
    const r = solve({ ...FULL });
    assert.ok(r.SPLref > 0, 'the reference sensitivity must have been derived first');
    assert.ok(Math.abs((r.SPLmax - r.SPLref) - 10 * Math.log10(300)) < 1e-12, `SPLmax = ${r.SPLmax}`);
  });

  it('USPL = SPLref + 10·log₁₀(8/Re), with 8 = 2.83²', () => {
    const r = solve({ ...FULL });
    assert.ok(Math.abs((r.USPL - r.SPLref) - 10 * Math.log10(8 / BEYMA.Re)) < 1e-12, `USPL = ${r.USPL}`);
  });

  it('SPLmax needs Pe — a driver without a power rating gets no SPLmax rather than a guess', () => {
    const { Pe, ...noPower } = FULL;
    assert.equal(Pe, 300);
    assert.equal(solve(noPower).SPLmax, undefined);
  });
});

describe('Gloss — the static cone sag, as a FRACTION of Xmax', () => {
  it('reproduces the WinISD-authored file, whose ParState marks Gloss computed', () => {
    const r = solve({ ...ORACLE_INPUTS });
    assert.ok(rel(r.loss, ORACLE.Gloss) < 1e-12,
      `Gloss = ${r.loss}, WinISD wrote ${ORACLE.Gloss} (relative ${rel(r.loss, ORACLE.Gloss)})`);
  });

  it('is written under the record\'s ONE name for the quantity, `loss`', () => {
    // The `.wdr` key is `Gloss`; the record field is `loss` (DriverRaw, and the WDR_META
    // pairing in @openisd/winisd). A second key holding the same number would be a second
    // name for one concept.
    const r = solve({ ...ORACLE_INPUTS });
    assert.equal((r as Record<string, unknown>).Gloss, undefined,
      'the solver must not invent a second key for the quantity `loss` already names');
  });

  it('follows the STORED Fs, not the Fs that Mms·Cms implies', () => {
    // Probe `gloss_incon_double` (winisd_research/runs/advanced_formulas.jsonl): Fs is written
    // as 200 while Mms·Cms give 100, which separates g/((2π·Fs)²·Xmax) from the rival
    // g·Mms·Cms/Xmax. The rival is exact on every self-consistent driver and 4× out here.
    const r = solve({
      Fs: 200, Xmax: 0.0067, Mms: 0.00194848430081419, Cms: 0.0013,
      Qes: 0.4812931131916, Qms: 2.1, Re: 14.1525718647402, Bl: 6, Sd: 0.022,
      roo: 1.20095217714682, c: 343.684120962153,
    });
    assert.ok(rel(r.loss, 0.000926885620863929) < 1e-12,
      `Gloss = ${r.loss}, WinISD gave 0.000926885620863929`);
    const rival = 9.80665 * 0.00194848430081419 * 0.0013 / 0.0067;
    assert.ok(rel(r.loss, rival) > 0.5, `Gloss must not have come from g·Mms·Cms/Xmax (${rival})`);
  });

  it('needs both Fs and Xmax — neither alone invents a sag', () => {
    assert.equal(solve({ Fs: 40, Mms: 0.002 }).loss, undefined);
    assert.equal(solve({ Xmax: 0.0067, Sd: 0.022 }).loss, undefined);
  });

  it('never overwrites an entered value', () => {
    assert.equal(solve({ ...ORACLE_INPUTS, loss: 0.5 }).loss, 0.5);
  });
});

describe('SPLmaxLF — the excursion-limited 20 Hz SPL, at the record\'s own air', () => {
  it('reproduces the WinISD-authored file at WinISD\'s own ρ₀', () => {
    const r = solve({ ...ORACLE_INPUTS });
    assert.equal(ORACLE.roo, 1.20095217714682, 'the oracle must carry WinISD\'s own air density');
    assert.ok(rel(r.SPLmaxLF, ORACLE.SPLmaxLF) < 1e-12,
      `SPLmaxLF = ${r.SPLmaxLF}, WinISD wrote ${ORACLE.SPLmaxLF} (relative ${rel(r.SPLmaxLF, ORACLE.SPLmaxLF)})`);
  });

  it('tracks the ρ₀ the record carries — it is not a hardcoded 1.20095', () => {
    // Probes `splmaxlf_roo0.9` / `splmaxlf_roo1.5`: identical drivers, `roo` alone changed.
    // WinISD moves SPLmaxLF by 20·log₁₀(ρ ratio), so a constant baked into the formula would
    // print the same number twice.
    const base = { Fs: 40, Xmax: 0.0067, Sd: 0.022, Vd: 0.0001474, Mms: 0.00194848430081419, Qes: 0.19251724527664, Re: 14.1525718647402, c: 343.684120962153 };
    const light = solve({ ...base, roo: 0.9 });
    const heavy = solve({ ...base, roo: 1.5 });
    assert.ok(rel(light.SPLmaxLF, 81.4286971830493) < 1e-12, `ρ₀=0.9 → ${light.SPLmaxLF}`);
    assert.ok(rel(heavy.SPLmaxLF, 85.8656721753764) < 1e-12, `ρ₀=1.5 → ${heavy.SPLmaxLF}`);
  });

  it('falls back to the engine\'s air constant when the record carries none', () => {
    const noAir = solve({ Fs: 40, Xmax: 0.0067, Sd: 0.022 });
    const withRho = solve({ Fs: 40, Xmax: 0.0067, Sd: 0.022, roo: RHO });
    assert.equal(noAir.SPLmaxLF, withRho.SPLmaxLF);
  });

  it('needs Vd — a driver with no volume displacement gets no SPLmaxLF', () => {
    assert.equal(solve({ Fs: 40, Re: 6, Qes: 0.4 }).SPLmaxLF, undefined);
  });

  it('never overwrites an entered value', () => {
    assert.equal(solve({ ...ORACLE_INPUTS, SPLmaxLF: 42 }).SPLmaxLF, 42);
  });
});

describe('Mcost — Rme scaled by how far the coil leaves the gap', () => {
  it('reproduces the WinISD-authored file, on the Rme that precedence produced', () => {
    const r = solve({ ...ORACLE_INPUTS });
    assert.ok(rel(r.Rme, ORACLE.Rme) < 1e-12, `Rme = ${r.Rme}, WinISD wrote ${ORACLE.Rme}`);
    assert.ok(rel(r.Mcost, ORACLE.Mcost) < 1e-12,
      `Mcost = ${r.Mcost}, WinISD wrote ${ORACLE.Mcost} (relative ${rel(r.Mcost, ORACLE.Mcost)})`);
  });

  it('reads Xmax itself, not the excursion the gap geometry implies', () => {
    // Probe `mcost2_xmaxincon_hi`: Xmax is written as 0.009 while |Hc−Hg|/2 is 0.003, which
    // separates Rme·(1 + Xmax/min) from the rival Rme·(Hc+Hg)/(2·min). The rival is exact
    // whenever Xmax = |Hc−Hg|/2 and 40 % out here.
    const r = solve({
      Fs: 40, Xmax: 0.009, Hc: 0.012, Hg: 0.006, Mms: 0.00194848430081419,
      Qes: 0.19251724527664, Re: 14.1525718647402, Bl: 6, Sd: 0.022,
      roo: 1.20095217714682, c: 343.684120962153,
    });
    assert.ok(rel(r.Mcost, 6.35926818532726) < 1e-12, `Mcost = ${r.Mcost}, WinISD gave 6.35926818532726`);
    const rival = r.Rme * (0.012 + 0.006) / (2 * 0.006);
    assert.ok(rel(r.Mcost, rival) > 0.2, `Mcost must not have come from Rme·(Hc+Hg)/(2·min) (${rival})`);
  });

  it('reduces to Rme when the coil never leaves the gap', () => {
    const r = solve({ Fs: 40, Mms: 0.002, Qes: 0.4, Xmax: 0, Hc: 0.012, Hg: 0.006 });
    assert.equal(r.Mcost, r.Rme);
  });

  it('is ABSENT — not 0, not Infinity — when min(Hc, Hg) is zero', () => {
    // Hc and Hg are 0 on essentially every real record, which is the only reason WinISD's own
    // files read Mcost=0: min(Hc,Hg) is the divisor. A blank is honest; 0 and Infinity are
    // both a number the driver does not have.
    const gaps: Record<string, number>[] = [{ Hc: 0, Hg: 0 }, { Hc: 0.012, Hg: 0 }, { Hc: 0, Hg: 0.006 }, {}];
    for (const gap of gaps) {
      const r = solve({ Fs: 40, Mms: 0.002, Qes: 0.4, Xmax: 0.005, ...gap });
      assert.ok(r.Rme > 0, 'the Rme this scales must have been derived');
      assert.equal(r.Mcost, undefined, `Mcost = ${r.Mcost} for ${JSON.stringify(gap)}`);
    }
  });

  it('never overwrites an entered value', () => {
    assert.equal(solve({ ...ORACLE_INPUTS, Mcost: 7 }).Mcost, 7);
  });
});
