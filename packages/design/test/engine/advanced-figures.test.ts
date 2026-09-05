/**
 * WinISD's Advanced-pane figures of merit — Rme, Mpow, gamma, SPLmax, USPL, Gloss, SPLmaxLF,
 * Mcost.
 *
 * The human's ruling (ledger QO24, 2026-08-13): on that panel `alfaVC`, `Rt` and `Ct` are the
 * only MANUAL fields; everything else is CALCULATED. Deleting Rme in WinISD makes it fill the
 * value back in, and a `Fs` edit moves the whole set — so these are not stored pass-throughs.
 *
 * Formulas, pinned in winisd_research/KNOWLEDGE_REPORT.md §4 and SOLVER_GAPS.md §2.4, EXCEPT
 * `Mpow`, `SPLmax` and `USPL` which that document states wrong — see the citations on each
 * describe block below for the corrected formula and its evidence:
 *     Rme      = BL²/Re = 2π·Fs·Mms/Qes
 *     Mpow     = BL/√Re                      (NOT √Rme — see "Mpow, gamma" below)
 *     gamma    = BL/Mms
 *     SPLmax   = SPL_stated + 10·log₁₀(Pe) − 3   (see "SPLmax and USPL" below)
 *     USPL     = SPL_stated + 10·log₁₀(2.83²/Re) (2.83² = 8.0089, NOT 8 — see below)
 *     Gloss    = g/((2π·Fs)²·Xmax)           g = 9.80665, the FRACTION of Xmax
 *     SPLmaxLF = 20·log₁₀(ρ₀·(2π·20)²·Vd/(2π·√2)/20 µPa)
 *     Mcost    = Rme·(1 + Xmax/min(Hc, Hg))
 *
 * 🔒 The Rme PRECEDENCE is what this test exists for. The two routes are algebraically identical
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
import { Engine } from '../../engine/index.js';
import type { SolverQuantities } from '../../engine/index.js';

/** The engine's one door: every calculation below is a method on this object. */
const engine = new Engine();

/** Beyma 10BR60/V2, the real fixture whose stored Bl disagrees with its own Fs/Mms/Re/Qes. */
const BEYMA: SolverQuantities = {
  Fs_hz: 29.0, Mms_kg: 0.044, Cms_m_per_N: 0.000693, Rms_kg_per_s: 2.4,
  BL_Tm: 10.9, Re_ohm: 6.5, Qes: 0.44, Qms: 3.3, Sd_m2: 0.038,
};

// TYPED, not `Record<string, number>` with a cast on each end. The cast this replaces made every
// name in this file invisible to the compiler: stale keys went in, matched nothing, and every
// derived figure came back `undefined` while the suite still built.
const solve = (d: SolverQuantities): Readonly<SolverQuantities> =>
  engine.solveConsistencyGroup(d);

const here = dirname(fileURLToPath(import.meta.url));
const SAMPLES = join(here, '..', '..', '..', '..', 'drivers', 'sample', 'winisd');

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
const ORACLE_INPUTS: SolverQuantities = {
  Fs_hz: ORACLE.Fs, Mms_kg: ORACLE.Mms, Xmax_m: ORACLE.Xmax, Qes: ORACLE.Qes, Qms: ORACLE.Qms,
  Re_ohm: ORACLE.Re, Sd_m2: ORACLE.Sd, Vd_m3: ORACLE.Vd, Hc_m: ORACLE.Hc, Hg_m: ORACLE.Hg,
  c_m_per_s: ORACLE.c, roo_kg_per_m3: ORACLE.roo,
};

/** A figure the solver was expected to derive. Every `SolverQuantities` member is optional —
 *  absent means "not derived" — so reading one for an assertion has to say which it is. A missing
 *  derivation then fails as `Rme_kg_per_s was not derived`, where bare arithmetic on `undefined`
 *  yielded a NaN comparison and a message that named no cause. */
function derived(v: number | undefined, name: string): number {
  assert.ok(v !== undefined, `${name} was not derived`);
  return v;
}

/** |got − want|/|want| — the residual the recovery campaign reports. */
const rel = (got: number, want: number): number => Math.abs(got - want) / Math.abs(want);

describe('Rme — the two routes, and which one wins', () => {
  it('takes 2π·Fs·Mms/Qes (18.22124), NOT Bl²/Re (18.27846), when both are available', () => {
    const r = solve({ ...BEYMA });
    assert.ok(Math.abs(derived(r.Rme_kg_per_s, 'Rme_kg_per_s') - 18.2212373908208) < 1e-9, `Rme = ${r.Rme_kg_per_s}`);
    assert.ok(Math.abs(derived(r.Rme_kg_per_s, 'Rme_kg_per_s') - 18.27846153846154) > 0.05, 'Rme must not have come from Bl²/Re');
  });

  it('falls back to Bl²/Re when the motional route is short of an input', () => {
    const r = solve({ BL_Tm: BEYMA.BL_Tm, Re_ohm: BEYMA.Re_ohm });
    assert.ok(Math.abs(derived(r.Rme_kg_per_s, 'Rme_kg_per_s') - 18.27846153846154) < 1e-9, `Rme = ${r.Rme_kg_per_s}`);
  });

  it('is absent when neither route can be evaluated', () => {
    assert.equal(solve({ Fs_hz: 29, Mms_kg: 0.044 }).Rme_kg_per_s, undefined);
  });

  it('never overwrites an entered Rme — WinISD fixed-E semantics', () => {
    assert.equal(solve({ ...BEYMA, Rme_kg_per_s: 99 }).Rme_kg_per_s, 99);
  });
});

describe('Mpow, gamma', () => {
  // Mpow = Bl/√Re, NOT √Rme — recovered from the `inconsistent-fs` parity golden
  // (packages/winisd/test/fixtures/winisd-parity/goldens/inconsistent-fs.wpr), whose stored
  // `Fs` is written at exactly twice its true value, separating the two routes (they agree on
  // every self-consistent record, including BEYMA below — which is why this needs its own
  // discriminator). WinISD wrote `Rme=17.578125`, `Mpow=2.96463530640786` on that record;
  // `Bl/√Re` matches to the last digit, `√Rme` (4.1926274578121) does not. See
  // bugs/BUG_20260813_mpow-uses-sqrt-rme-where-winisd-uses-bl-over-sqrt-re.md.
  it('Mpow is Bl/√Re, NOT √Rme — the two happen to agree on BEYMA, so this only pins the value', () => {
    const r = solve({ ...BEYMA });
    assert.ok(Math.abs(derived(r.Mpow_N_per_sqrtW, 'Mpow_N_per_sqrtW') - derived(BEYMA.BL_Tm, 'BL_Tm') / Math.sqrt(derived(BEYMA.Re_ohm, 'Re_ohm'))) < 1e-12, `Mpow = ${r.Mpow_N_per_sqrtW}`);
    assert.ok(Math.abs(derived(r.Mpow_N_per_sqrtW, 'Mpow_N_per_sqrtW') - 4.275331746012412) < 1e-9);
  });

  it('Mpow = Bl/√Re disagrees with √Rme on a record whose stored Fs contradicts Mms·Cms', () => {
    // The `inconsistent-fs` discriminator, transcribed: Fs stored at 2×true, Bl=7.5, Re=6.4,
    // Qes=0.41220376440829154, Mms=0.0155 — WinISD's own Rme/Mpow pair for this record.
    const r = solve({ Fs_hz: 74.4, Mms_kg: 0.0155, Qes: 0.41220376440829154, BL_Tm: 7.5, Re_ohm: 6.4 });
    assert.ok(Math.abs(derived(r.Rme_kg_per_s, 'Rme_kg_per_s') - 17.578125) < 1e-9, `Rme = ${r.Rme_kg_per_s}`);
    assert.ok(Math.abs(derived(r.Mpow_N_per_sqrtW, 'Mpow_N_per_sqrtW') - 2.96463530640786) < 1e-9, `Mpow = ${r.Mpow_N_per_sqrtW}`);
    assert.ok(Math.abs(derived(r.Mpow_N_per_sqrtW, 'Mpow_N_per_sqrtW') - Math.sqrt(derived(r.Rme_kg_per_s, 'Rme_kg_per_s'))) > 1, '√Rme must NOT be the answer here');
  });

  it('falls back to √Rme when Bl is absent', () => {
    const r = solve({ Fs_hz: BEYMA.Fs_hz, Mms_kg: BEYMA.Mms_kg, Qes: BEYMA.Qes });
    assert.ok(Math.abs(derived(r.Mpow_N_per_sqrtW, 'Mpow_N_per_sqrtW') - Math.sqrt(derived(r.Rme_kg_per_s, 'Rme_kg_per_s'))) < 1e-12, `Mpow = ${r.Mpow_N_per_sqrtW}, √Rme = ${Math.sqrt(derived(r.Rme_kg_per_s, 'Rme_kg_per_s'))}`);
  });

  it('gamma = Bl/Mms', () => {
    const r = solve({ ...BEYMA });
    assert.ok(Math.abs(derived(r.gamma_m_per_s2_A, 'gamma_m_per_s2_A') - 10.9 / 0.044) < 1e-9, `gamma = ${r.gamma_m_per_s2_A}`);
  });

  it('neither overwrites an entered value', () => {
    const r = solve({ ...BEYMA, Mpow_N_per_sqrtW: 7, gamma_m_per_s2_A: 11 });
    assert.equal(r.Mpow_N_per_sqrtW, 7);
    assert.equal(r.gamma_m_per_s2_A, 11);
  });
});

describe('SPLmax and USPL — both offsets from the ONE reference base', () => {
  // Vas and Pe complete the efficiency chain; the reference SPL itself comes from
  // efficiency.ts (via `no` → `SPLref`), which is what these two are offsets from when the
  // record carries no STATED `SPL` (BEYMA does not, so `SPLref` is the base here too).
  const FULL = { ...BEYMA, Vas_m3: 0.055, Pe_W: 300 };

  // Both formulas corrected 2026-08-14 — the code used to read `SPLref + 10·log₁₀(8/Re)` /
  // `SPLref + 10·log₁₀(Pe)` (no derating). Recovered from the `winisd-parity` goldens:
  // predicting each golden's own `USPL`/`SPLmax` from its stated `SPL` and `Re`/`Pe` with
  // `2.83²` (not the bare `8`) and a flat `−3` dB agrees with WinISD's stored values to
  // 4.3e-14 / 0 and 4.3e-15 relative respectively, on every golden available. See
  // bugs/BUG_20260813_uspl-and-splmax-use-formulas-winisd-does-not-2p83-volts-and-a-3db-derating.md.
  it('SPLmax = SPLref + 10·log₁₀(Pe) − 3 dB', () => {
    const r = solve({ ...FULL });
    assert.ok(derived(r.SPLref_dB, 'SPLref_dB') > 0, 'the reference sensitivity must have been derived first');
    assert.ok(Math.abs((derived(r.SPLmax_dB, 'SPLmax_dB') - derived(r.SPLref_dB, 'SPLref_dB')) - (10 * Math.log10(300) - 3)) < 1e-12, `SPLmax = ${r.SPLmax_dB}`);
  });

  it('USPL = SPLref + 10·log₁₀(2.83²/Re) — 2.83² = 8.0089, NOT the bare 8', () => {
    const r = solve({ ...FULL });
    assert.ok(Math.abs((derived(r.USPL_dB, 'USPL_dB') - derived(r.SPLref_dB, 'SPLref_dB')) - 10 * Math.log10(2.83 * 2.83 / derived(BEYMA.Re_ohm, 'Re_ohm'))) < 1e-12, `USPL = ${r.USPL_dB}`);
    // The two constants are close enough to look interchangeable but are not: on this
    // record the bare-8 formula would be off by 0.0048 dB, well outside float noise.
    assert.ok(Math.abs((derived(r.USPL_dB, 'USPL_dB') - derived(r.SPLref_dB, 'SPLref_dB')) - 10 * Math.log10(8 / derived(BEYMA.Re_ohm, 'Re_ohm'))) > 1e-4,
      'USPL must not have come from the bare-8 formula');
  });

  it('USPL/SPLmax prefer a STATED SPL over the η₀-derived SPLref, when the record carries one', () => {
    // A stated SPL (the record's own `SPL` key, entered — as a WDR's `SPL=` line arrives) is
    // WinISD's own base, and disagrees with the η₀-derived SPLref on a real record exactly
    // the way `sealed-small`'s golden does (SPL=90 stated vs SPLref=87.65068346041753 derived).
    const withStated = solve({ ...FULL, SPL_dB: 90 });
    assert.ok(Math.abs(derived(withStated.SPLref_dB, 'SPLref_dB') - 90) > 0.1, 'SPLref must stay the η₀-derived value, not 90');
    assert.ok(Math.abs((derived(withStated.USPL_dB, 'USPL_dB') - 90) - 10 * Math.log10(2.83 * 2.83 / derived(BEYMA.Re_ohm, 'Re_ohm'))) < 1e-12,
      `USPL = ${withStated.USPL_dB}, must be based on the stated SPL (90), not SPLref`);
    assert.ok(Math.abs((derived(withStated.SPLmax_dB, 'SPLmax_dB') - 90) - (10 * Math.log10(300) - 3)) < 1e-12,
      `SPLmax = ${withStated.SPLmax_dB}, must be based on the stated SPL (90), not SPLref`);
  });

  it('SPLmax needs Pe — a driver without a power rating gets no SPLmax rather than a guess', () => {
    const { Pe_W, ...noPower } = FULL;
    assert.equal(Pe_W, 300);
    assert.equal(solve(noPower).SPLmax_dB, undefined);
  });
});

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
    assert.equal((r as Record<string, unknown>).loss, undefined,
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

describe('SPLmaxLF — the excursion-limited 20 Hz SPL, at the record\'s own air', () => {
  it('reproduces the WinISD-authored file at WinISD\'s own ρ₀', () => {
    const r = solve({ ...ORACLE_INPUTS });
    assert.equal(ORACLE.roo, 1.20095217714682, 'the oracle must carry WinISD\'s own air density');
    assert.ok(rel(derived(r.SPLmaxLF_dB, 'SPLmaxLF_dB'), ORACLE.SPLmaxLF) < 1e-12,
      `SPLmaxLF = ${r.SPLmaxLF_dB}, WinISD wrote ${ORACLE.SPLmaxLF} (relative ${rel(derived(r.SPLmaxLF_dB, 'SPLmaxLF_dB'), ORACLE.SPLmaxLF)})`);
  });

  it('tracks the ρ₀ the record carries — it is not a hardcoded 1.20095', () => {
    // Probes `splmaxlf_roo0.9` / `splmaxlf_roo1.5`: identical drivers, `roo` alone changed.
    // WinISD moves SPLmaxLF by 20·log₁₀(ρ ratio), so a constant baked into the formula would
    // print the same number twice.
    const base = { Fs_hz: 40, Xmax_m: 0.0067, Sd_m2: 0.022, Vd_m3: 0.0001474, Mms_kg: 0.00194848430081419, Qes: 0.19251724527664, Re_ohm: 14.1525718647402, c_m_per_s: 343.684120962153 };
    const light = solve({ ...base, roo_kg_per_m3: 0.9 });
    const heavy = solve({ ...base, roo_kg_per_m3: 1.5 });
    assert.ok(rel(derived(light.SPLmaxLF_dB, 'SPLmaxLF_dB'), 81.4286971830493) < 1e-12, `ρ₀=0.9 → ${light.SPLmaxLF_dB}`);
    assert.ok(rel(derived(heavy.SPLmaxLF_dB, 'SPLmaxLF_dB'), 85.8656721753764) < 1e-12, `ρ₀=1.5 → ${heavy.SPLmaxLF_dB}`);
  });

  it('falls back to the live reference-environment density when the record carries none', () => {
    const noAir = solve({ Fs_hz: 40, Xmax_m: 0.0067, Sd_m2: 0.022 });
    const withRho = solve({ Fs_hz: 40, Xmax_m: 0.0067, Sd_m2: 0.022, roo_kg_per_m3: engine.airFor({}).rho });
    assert.equal(noAir.SPLmaxLF_dB, withRho.SPLmaxLF_dB);
  });

  it('needs Vd — a driver with no volume displacement gets no SPLmaxLF', () => {
    assert.equal(solve({ Fs_hz: 40, Re_ohm: 6, Qes: 0.4 }).SPLmaxLF_dB, undefined);
  });

  it('never overwrites an entered value', () => {
    assert.equal(solve({ ...ORACLE_INPUTS, SPLmaxLF_dB: 42 }).SPLmaxLF_dB, 42);
  });
});

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

describe('Xmax route precedence is on the RESULT, not the route (QO39 probe case G)', () => {
  it('an equal overhang is not an excursion limit — it falls through to Vd/Sd', () => {
    // Hc === Hg makes abs(Hc-Hg)/2 zero. WinISD does not accept that as Xmax; it uses the
    // other route. Expected value is independent of the code: 140e-6 / 0.0095.
    const r = engine.solveConsistencyGroup({ Hc_m: 0.012, Hg_m: 0.012, Vd_m3: 140e-6, Sd_m2: 0.0095 }) as Record<string, number>;
    assert.ok(Math.abs(r.Xmax_m - 140e-6 / 0.0095) < 1e-15, `Xmax was ${r.Xmax_m}`);
  });

  it('an unequal overhang wins over Vd/Sd', () => {
    const r = engine.solveConsistencyGroup({ Hc_m: 0.0176, Hg_m: 0.006, Vd_m3: 140e-6, Sd_m2: 0.0095 }) as Record<string, number>;
    assert.ok(Math.abs(r.Xmax_m - 0.0058) < 1e-15, `Xmax was ${r.Xmax_m}`);
  });
});
