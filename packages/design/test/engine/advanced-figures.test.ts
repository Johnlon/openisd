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
import { Engine } from '../../engine/index.js';

/** The engine's one door: every calculation below is a method on this object. */
const engine = new Engine();

/** Beyma 10BR60/V2, the real fixture whose stored Bl disagrees with its own Fs/Mms/Re/Qes. */
const BEYMA = { Fs: 29.0, Mms: 0.044, Cms: 0.000693, Rms: 2.4, BL: 10.9, Re: 6.5, Qes: 0.44, Qms: 3.3, Sd: 0.038 };

const solve = (d: Record<string, number>) =>
  engine.solveConsistencyGroup(d, { full: true }) as Record<string, number>;

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
    const r = solve({ BL: BEYMA.BL, Re: BEYMA.Re });
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
  // Mpow = Bl/√Re, NOT √Rme — recovered from the `inconsistent-fs` parity golden
  // (packages/winisd/test/fixtures/winisd-parity/goldens/inconsistent-fs.wpr), whose stored
  // `Fs` is written at exactly twice its true value, separating the two routes (they agree on
  // every self-consistent record, including BEYMA below — which is why this needs its own
  // discriminator). WinISD wrote `Rme=17.578125`, `Mpow=2.96463530640786` on that record;
  // `Bl/√Re` matches to the last digit, `√Rme` (4.1926274578121) does not. See
  // bugs/BUG_20260813_mpow-uses-sqrt-rme-where-winisd-uses-bl-over-sqrt-re.md.
  it('Mpow is Bl/√Re, NOT √Rme — the two happen to agree on BEYMA, so this only pins the value', () => {
    const r = solve({ ...BEYMA });
    assert.ok(Math.abs(r.Mpow - BEYMA.BL / Math.sqrt(BEYMA.Re)) < 1e-12, `Mpow = ${r.Mpow}`);
    assert.ok(Math.abs(r.Mpow - 4.275331746012412) < 1e-9);
  });

  it('Mpow = Bl/√Re disagrees with √Rme on a record whose stored Fs contradicts Mms·Cms', () => {
    // The `inconsistent-fs` discriminator, transcribed: Fs stored at 2×true, Bl=7.5, Re=6.4,
    // Qes=0.41220376440829154, Mms=0.0155 — WinISD's own Rme/Mpow pair for this record.
    const r = solve({ Fs: 74.4, Mms: 0.0155, Qes: 0.41220376440829154, BL: 7.5, Re: 6.4 });
    assert.ok(Math.abs(r.Rme - 17.578125) < 1e-9, `Rme = ${r.Rme}`);
    assert.ok(Math.abs(r.Mpow - 2.96463530640786) < 1e-9, `Mpow = ${r.Mpow}`);
    assert.ok(Math.abs(r.Mpow - Math.sqrt(r.Rme)) > 1, '√Rme must NOT be the answer here');
  });

  it('falls back to √Rme when Bl is absent', () => {
    const r = solve({ Fs: BEYMA.Fs, Mms: BEYMA.Mms, Qes: BEYMA.Qes });
    assert.ok(Math.abs(r.Mpow - Math.sqrt(r.Rme)) < 1e-12, `Mpow = ${r.Mpow}, √Rme = ${Math.sqrt(r.Rme)}`);
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

describe('SPLmax and USPL — both offsets from the ONE reference base', () => {
  // Vas and Pe complete the efficiency chain; the reference SPL itself comes from
  // efficiency.ts (via `no` → `SPLref`), which is what these two are offsets from when the
  // record carries no STATED `SPL` (BEYMA does not, so `SPLref` is the base here too).
  const FULL = { ...BEYMA, Vas: 0.055, Pe: 300 };

  // Both formulas corrected 2026-08-14 — the code used to read `SPLref + 10·log₁₀(8/Re)` /
  // `SPLref + 10·log₁₀(Pe)` (no derating). Recovered from the `winisd-parity` goldens:
  // predicting each golden's own `USPL`/`SPLmax` from its stated `SPL` and `Re`/`Pe` with
  // `2.83²` (not the bare `8`) and a flat `−3` dB agrees with WinISD's stored values to
  // 4.3e-14 / 0 and 4.3e-15 relative respectively, on every golden available. See
  // bugs/BUG_20260813_uspl-and-splmax-use-formulas-winisd-does-not-2p83-volts-and-a-3db-derating.md.
  it('SPLmax = SPLref + 10·log₁₀(Pe) − 3 dB', () => {
    const r = solve({ ...FULL });
    assert.ok(r.SPLref > 0, 'the reference sensitivity must have been derived first');
    assert.ok(Math.abs((r.SPLmax - r.SPLref) - (10 * Math.log10(300) - 3)) < 1e-12, `SPLmax = ${r.SPLmax}`);
  });

  it('USPL = SPLref + 10·log₁₀(2.83²/Re) — 2.83² = 8.0089, NOT the bare 8', () => {
    const r = solve({ ...FULL });
    assert.ok(Math.abs((r.USPL - r.SPLref) - 10 * Math.log10(2.83 * 2.83 / BEYMA.Re)) < 1e-12, `USPL = ${r.USPL}`);
    // The two constants are close enough to look interchangeable but are not: on this
    // record the bare-8 formula would be off by 0.0048 dB, well outside float noise.
    assert.ok(Math.abs((r.USPL - r.SPLref) - 10 * Math.log10(8 / BEYMA.Re)) > 1e-4,
      'USPL must not have come from the bare-8 formula');
  });

  it('USPL/SPLmax prefer a STATED SPL over the η₀-derived SPLref, when the record carries one', () => {
    // A stated SPL (the record's own `SPL` key, entered — as a WDR's `SPL=` line arrives) is
    // WinISD's own base, and disagrees with the η₀-derived SPLref on a real record exactly
    // the way `sealed-small`'s golden does (SPL=90 stated vs SPLref=87.65068346041753 derived).
    const withStated = solve({ ...FULL, SPL: 90 } as Record<string, number>);
    assert.ok(Math.abs(withStated.SPLref - 90) > 0.1, 'SPLref must stay the η₀-derived value, not 90');
    assert.ok(Math.abs((withStated.USPL - 90) - 10 * Math.log10(2.83 * 2.83 / BEYMA.Re)) < 1e-12,
      `USPL = ${withStated.USPL}, must be based on the stated SPL (90), not SPLref`);
    assert.ok(Math.abs((withStated.SPLmax - 90) - (10 * Math.log10(300) - 3)) < 1e-12,
      `SPLmax = ${withStated.SPLmax}, must be based on the stated SPL (90), not SPLref`);
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
    assert.ok(rel(r.Gloss, ORACLE.Gloss) < 1e-12,
      `Gloss = ${r.Gloss}, WinISD wrote ${ORACLE.Gloss} (relative ${rel(r.Gloss, ORACLE.Gloss)})`);
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
      Fs: 200, Xmax: 0.0067, Mms: 0.00194848430081419, Cms: 0.0013,
      Qes: 0.4812931131916, Qms: 2.1, Re: 14.1525718647402, BL: 6, Sd: 0.022,
      roo: 1.20095217714682, c: 343.684120962152,
    });
    assert.ok(rel(r.Gloss, 0.000926885620863929) < 1e-12,
      `Gloss = ${r.Gloss}, WinISD gave 0.000926885620863929`);
    const rival = 9.80665 * 0.00194848430081419 * 0.0013 / 0.0067;
    assert.ok(rel(r.Gloss, rival) > 0.5, `Gloss must not have come from g·Mms·Cms/Xmax (${rival})`);
  });

  it('needs both Fs and Xmax — neither alone invents a sag', () => {
    assert.equal(solve({ Fs: 40, Mms: 0.002 }).Gloss, undefined);
    assert.equal(solve({ Xmax: 0.0067, Sd: 0.022 }).Gloss, undefined);
  });

  it('never overwrites an entered value', () => {
    assert.equal(solve({ ...ORACLE_INPUTS, Gloss: 0.5 }).Gloss, 0.5);
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

  it('falls back to the live reference-environment density when the record carries none', () => {
    const noAir = solve({ Fs: 40, Xmax: 0.0067, Sd: 0.022 });
    const withRho = solve({ Fs: 40, Xmax: 0.0067, Sd: 0.022, roo: engine.airFor({}).rho });
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
      Qes: 0.19251724527664, Re: 14.1525718647402, BL: 6, Sd: 0.022,
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

describe('Xmax route precedence is on the RESULT, not the route (QO39 probe case G)', () => {
  it('an equal overhang is not an excursion limit — it falls through to Vd/Sd', () => {
    // Hc === Hg makes abs(Hc-Hg)/2 zero. WinISD does not accept that as Xmax; it uses the
    // other route. Expected value is independent of the code: 140e-6 / 0.0095.
    const r = engine.solveConsistencyGroup(
      { Hc: 0.012, Hg: 0.012, Vd: 140e-6, Sd: 0.0095 } as Record<string, number>,
      { full: true },
    ) as Record<string, number>;
    assert.ok(Math.abs(r.Xmax - 140e-6 / 0.0095) < 1e-15, `Xmax was ${r.Xmax}`);
  });

  it('an unequal overhang wins over Vd/Sd', () => {
    const r = engine.solveConsistencyGroup(
      { Hc: 0.0176, Hg: 0.006, Vd: 140e-6, Sd: 0.0095 } as Record<string, number>,
      { full: true },
    ) as Record<string, number>;
    assert.ok(Math.abs(r.Xmax - 0.0058) < 1e-15, `Xmax was ${r.Xmax}`);
  });
});
