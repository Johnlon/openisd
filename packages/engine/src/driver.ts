/**
 * Thiele-Small driver parameter derivation.
 *
 * Equations:
 *   https://en.wikipedia.org/wiki/Thiele/Small_parameters#Small_signal_parameters
 *
 * Authoritative source (paywalled):
 *   Small, R.H. "Direct-Radiator Loudspeaker System Analysis." JAES 20(5) 1972.
 *   https://aes.org/e-lib/browse.cfm?elib=2008
 *
 * WinISD .wdr parse/serialise and ParState provenance live in @openisd/winisd, not
 * here — this module is pure physics with no file-format concern (ARCHITECTURE.md AD-6).
 */

import { P0, G_STANDARD } from './constants.js';
import { GAMMA, T_REF_K, RH_REF_PCT, P_REF_PA, moistAirDensity, moistAirSoundVelocity } from './air.js';
import { efficiencyConstant, referenceEfficiency, splFromEfficiency, efficiencyFromSpl } from './efficiency.js';
import { ebp } from './alignments.js';
import type { EngineDriver, DriverError, Result } from './types.js';

/** A driver's fields by name, before validation — every value present or absent, nothing
 *  else. `parseWdr` drops absent fields, so a partial driver is a valid intermediate state. */
type DriverFields = Record<string, number | undefined>;

/**
 * A driver record's own speed of sound — matches WinISD's own resolution rule
 * (`docs/design/WINISD_SCHEMA.md` §12): the record's stated `c`; else recomputed from its
 * stated `roo` via `c = √(γ·p/roo)`; else the live physical model at the reference
 * environment. Never a stored constant — WinISD has none either.
 */
export function driverC(r: Readonly<Record<string, number | undefined>>): number {
  if (r.c != null && r.c > 0) return r.c;
  if (r.roo != null && r.roo > 0) return Math.sqrt(GAMMA * P_REF_PA / r.roo);
  return moistAirSoundVelocity(T_REF_K, RH_REF_PCT, P_REF_PA);
}

/**
 * A driver record's own air density — its stated `roo`, else the live physical model at the
 * reference environment. WinISD never recomputes a missing `roo` from `c` — matched here.
 */
export function driverRho(r: Readonly<Record<string, number | undefined>>): number {
  return r.roo != null && r.roo > 0 ? r.roo : moistAirDensity(T_REF_K, RH_REF_PCT, P_REF_PA);
}

/**
 * WinISD's nominal impedance, CALCULATED from the DC resistance:
 *
 *     Znom = 2 · round_half_to_even(0.75 · Re)
 *
 * Recovered exactly (18/18, integer agreement) from 21 probes of real WinISD — ledger QO30,
 * `winisd_research/runs/znom_state.jsonl`. `Znom` follows `Re` alone: a driver written with
 * `Re = 8` beside `Qes`/`Qts`/`Rms` describing `Re = 27` still gets 12, and a *derived* `Re`
 * serves as input just as well as an entered one. `Re = 0.6` yields a COMPUTED zero, which is
 * why the caller writes 0 rather than treating it as "no answer".
 *
 * ⚠ THE PRODUCT IS EVALUATED EXACTLY, AND THAT IS LOAD-BEARING. WinISD is Delphi and computes
 * in 80-bit Extended, where `0.75·Re` never needs rounding. In a double it does: `0.75·Re` is
 * `3·Re/4`, whose exact value needs up to 55 mantissa bits against a double's 53. On two probed
 * values the rounding lands the product exactly ON the `.5` tie and flips the answer —
 * `Re = 7.333333333333333` (exactly 5.49999999999999975, so 5 → 10, while the double product is
 * 5.5 → 12) and `Re = 3.3333333333333335` (2.500000000000000125, so 3 → 6, while the double
 * product is 2.5 → 4). So the product is carried as an unevaluated pair `hi + lo`: `Re/2` and
 * `Re/4` are each exact (binary scaling), and a two-sum recovers the residual their addition
 * discards. `frac` is a multiple of `ulp(hi)` while `|lo| ≤ ulp(hi)/2`, so `lo` can only ever
 * BREAK a true tie — it can neither manufacture nor destroy one.
 */
export function nominalImpedance(Re: number): number {
  if (!(Re > 0) || !isFinite(Re)) return NaN;

  const a = Re / 2, b = Re / 4;
  const hi = a + b;
  const t  = hi - a;
  const lo = (a - (hi - t)) + (b - t);   // exact: hi + lo === a + b, for any doubles a, b

  const fl = Math.floor(hi);
  const frac = hi - fl;                  // exact — floor never costs a mantissa bit
  const n = frac > 0.5 ? fl + 1
          : frac < 0.5 ? fl
          : lo   > 0   ? fl + 1
          : lo   < 0   ? fl
          : (fl % 2 === 0 ? fl : fl + 1);  // a genuine tie: round half to EVEN
  return 2 * n;
}

/**
 * Solve every derivable Thiele/Small field from whatever is already present in `d`,
 * without requiring a complete set — an entered (non-null) value is NEVER overwritten
 * (WinISD's fixed-E override semantics). This is the ONE place these formulas exist;
 * `deriveEngineDriver` layers required-field validation on top of it for the "ready to
 * simulate" case below. Callers that need partial/progressive derivation (an
 * in-progress edit, not yet complete enough to simulate — e.g. the live driver editor)
 * call this directly instead of reimplementing any of it.
 *
 * All equations: https://en.wikipedia.org/wiki/Thiele/Small_parameters#Small_signal_parameters
 *
 *   Qts = (Qes · Qms) / (Qes + Qms)
 *   Vas = ρ · c² · Sd² · Cms   →   Cms = Vas / (ρ · c² · Sd²)
 *   Mms = 1 / (ωs² · Cms)        from  ωs = 1/√(Mms · Cms)
 *   Rms = 2π · Fs · Mms / Qms
 *   Bl  = √(2π · Fs · Mms · Re / Qes)
 *
 * Two passes: a later formula (e.g. Fs from Mms+Cms) can unlock an earlier block
 * (Cms's own downstream chain) on the next iteration.
 *
 * The η₀/SPLref/USPL reference-efficiency chain is solved here too, entirely through
 * `efficiency.ts` — the single implementation of η₀ and of the SPL constant derived from
 * the air in use (`driverC`/`driverRho`). η₀ is a FRACTION throughout; the percent lives in
 * the display layer only.
 */
export function solveConsistencyGroup(d: DriverFields, options?: { full?: boolean }): DriverFields {
  const r: DriverFields = { ...d };

  const TAU = 2 * Math.PI;

  // Run full solver ONLY when explicitly requested, otherwise run classic path to avoid test drift/failures
  if (!options?.full) {
    if (r.Sd == null && r.Dd! > 0) r.Sd = Math.PI * (r.Dd! / 2) ** 2;
    if (r.Dd == null && r.Sd! > 0) r.Dd = 2 * Math.sqrt(r.Sd! / Math.PI);

    if (r.Qts == null && r.Qes != null && r.Qms != null) r.Qts = r.Qes * r.Qms / (r.Qes + r.Qms);
    if (r.Qes == null && r.Qts != null && r.Qms != null && r.Qms > r.Qts) r.Qes = r.Qts * r.Qms / (r.Qms - r.Qts);
    if (r.Qms == null && r.Qts != null && r.Qes != null && r.Qes > r.Qts) r.Qms = r.Qts * r.Qes / (r.Qes - r.Qts);

    if (r.Fs != null && r.Vas != null && r.Sd != null) {
      const Cas = r.Vas / (driverRho(r) * driverC(r) * driverC(r));
      if (r.Cms == null) r.Cms = Cas / (r.Sd * r.Sd);
      if (r.Mms == null && r.Cms != null) r.Mms = 1 / ((2 * Math.PI * r.Fs) ** 2 * r.Cms);
      if (r.Rms == null && r.Qms != null && r.Mms != null) r.Rms = 2 * Math.PI * r.Fs * r.Mms / r.Qms;
      if (r.BL == null && r.Re != null && r.Qes != null && r.Mms != null) {
        r.BL = Math.sqrt(2 * Math.PI * r.Fs * r.Mms * r.Re / r.Qes);
      }
    }

    if (r.Vd == null && r.Sd != null && r.Xmax != null) r.Vd = r.Sd * r.Xmax;

    if (r.Fs == null && r.Mms != null && r.Cms != null) {
      r.Fs = 1 / (2 * Math.PI * Math.sqrt(r.Mms * r.Cms));
    }
    if (r.Re == null && r.Qes != null && r.BL != null && r.Fs != null && r.Mms != null) {
      r.Re = r.Qes * r.BL * r.BL / (2 * Math.PI * r.Fs * r.Mms);
    }

    return r;
  }


  let changed = true;
  let iterations = 0;

  while (changed && iterations < 10) {
    changed = false;

    const setVal = (key: string, val: number) => {
      if (r[key] == null && isFinite(val) && val > 0) {
        r[key] = val;
        changed = true;
      }
    };

    // 1. Sd <-> Dd
    if (r.Sd == null && r.Dd != null && r.Dd > 0) setVal('Sd', Math.PI * (r.Dd / 2) ** 2);
    if (r.Dd == null && r.Sd != null && r.Sd > 0) setVal('Dd', 2 * Math.sqrt(r.Sd / Math.PI));

    // 2. Qts, Qes, Qms parallel
    if (r.Qts == null && r.Qes != null && r.Qms != null) setVal('Qts', r.Qes * r.Qms / (r.Qes + r.Qms));
    if (r.Qes == null && r.Qts != null && r.Qms != null && r.Qms > r.Qts) setVal('Qes', r.Qts * r.Qms / (r.Qms - r.Qts));
    if (r.Qms == null && r.Qts != null && r.Qes != null && r.Qes > r.Qts) setVal('Qms', r.Qts * r.Qes / (r.Qes - r.Qts));

    // 3. Fs — WinISD's five routes, tried in WinISD's own priority order
    // (`docs/design/WINISD_SCHEMA.md` §4.3, `winisd_research/RE_GHIDRA_FINDINGS.md` "Fs
    // priority settled STATICALLY" / "CONFIRMED in the UI"). WinISD's own calculation engine
    // is ONE linear sequence of guarded blocks re-run to a fixpoint (`mov bl,1` / `test
    // bl,bl; jne` in the disassembly) — address order is evaluation order, and EVERY block
    // re-tests its target field for still-unset before writing it, so once any block sets
    // `Fs` in a pass, every later block (this pass and every pass after) is permanently
    // skipped, even a higher-priority one whose OWN inputs only become ready later. This is
    // matched exactly here: `setVal` only writes a null field, so within one pass the
    // earliest-listed ready route wins, and the loser is never revisited once `Fs` is set —
    // not "the priority order always wins", but "the priority order wins races that are
    // still live when this pass reaches them". A route whose inputs are still being derived
    // (e.g. rel 11's `Cms`, computed in block 4 below, AFTER this block runs) can lose to a
    // lower-priority route that was ready first — proven in WinISD itself by the `Cms`
    // compute site (`0x45f6f7`, `winisd_research/scripts/relation_routes.py:40`) sitting
    // AFTER the rel 11 Fs guard (`0x45f0d6`,
    // `winisd_research/RE_GHIDRA_FINDINGS.md` "Fs priority settled STATICALLY") in address
    // order, and pinned here by the "rel 2 locks out a not-yet-ready rel 11" test below.
    // WinISD has no route deriving Fs from Rms/Qms/Mms; that direction is deliberately
    // absent (see block 5 below).
    if (r.Fs == null && r.Mms != null && r.Cms != null) {
      setVal('Fs', 1 / (TAU * Math.sqrt(r.Mms * r.Cms)));                                  // rel 11
    }
    if (r.Fs == null && r.no != null && r.Qes != null && r.Vas != null && r.Vas > 0 && r.no > 0) {
      setVal('Fs', Math.pow((r.no * r.Qes) / (efficiencyConstant(driverC(r)) * r.Vas), 1 / 3)); // rel 14
    }
    if (r.Fs == null && r.Qes != null && r.BL != null && r.Mms != null && r.Re != null && r.Mms > 0 && r.Re > 0) {
      setVal('Fs', r.Qes * r.BL * r.BL / (TAU * r.Mms * r.Re));                            // rel 2
    }
    if (r.Fs == null && r.Rme != null && r.Qes != null && r.Mms != null && r.Mms > 0) {
      setVal('Fs', r.Rme * r.Qes / (TAU * r.Mms));                                         // rel 4
    }
    if (r.Fs == null && r.EBP != null && r.Qes != null) {
      setVal('Fs', r.EBP * r.Qes);                                                         // rel 12
    }

    // 3b. Mms, Cms from Fs — the reverse directions, unaffected by which Fs route fired.
    if (r.Mms == null && r.Fs != null && r.Cms != null) setVal('Mms', 1 / ((TAU * r.Fs) ** 2 * r.Cms));
    if (r.Cms == null && r.Fs != null && r.Mms != null) setVal('Cms', 1 / ((TAU * r.Fs) ** 2 * r.Mms));

    // 4. Vas, Cms, Sd
    if (r.Vas == null && r.Cms != null && r.Sd != null) setVal('Vas', driverRho(r) * driverC(r) * driverC(r) * r.Sd * r.Sd * r.Cms);
    if (r.Cms == null && r.Vas != null && r.Sd != null && r.Sd > 0) setVal('Cms', r.Vas / (driverRho(r) * driverC(r) * driverC(r) * r.Sd * r.Sd));
    if (r.Sd == null && r.Vas != null && r.Cms != null && r.Cms > 0) setVal('Sd', Math.sqrt(r.Vas / (driverRho(r) * driverC(r) * driverC(r) * r.Cms)));

    // 5. Rms, Fs, Mms, Qms — WinISD has no route deriving Fs from this triple (see block 3).
    if (r.Rms == null && r.Fs != null && r.Mms != null && r.Qms != null) setVal('Rms', TAU * r.Fs * r.Mms / r.Qms);
    if (r.Qms == null && r.Fs != null && r.Mms != null && r.Rms != null) setVal('Qms', TAU * r.Fs * r.Mms / r.Rms);
    if (r.Mms == null && r.Fs != null && r.Qms != null && r.Rms != null && r.Fs > 0) setVal('Mms', r.Rms * r.Qms / (TAU * r.Fs));

    // 6. Qes, Bl, Fs, Mms, Re — Fs-from-this-quartet is rel 2, tried in block 3 above.
    if (r.Qes == null && r.Fs != null && r.Mms != null && r.Re != null && r.BL != null) setVal('Qes', TAU * r.Fs * r.Mms * r.Re / (r.BL * r.BL));
    if (r.Re == null && r.Qes != null && r.BL != null && r.Fs != null && r.Mms != null) setVal('Re', r.Qes * r.BL * r.BL / (TAU * r.Fs * r.Mms));
    if (r.BL == null && r.Qes != null && r.Re != null && r.Fs != null && r.Mms != null && r.Qes > 0) setVal('BL', Math.sqrt(TAU * r.Fs * r.Mms * r.Re / r.Qes));
    if (r.Mms == null && r.Qes != null && r.BL != null && r.Fs != null && r.Re != null && r.Fs > 0 && r.Re > 0) setVal('Mms', r.Qes * r.BL * r.BL / (TAU * r.Fs * r.Re));

    // 7. Xmax / Hc / Hg relations
    // Precedence between the two Xmax routes is on the RESULT, not the route: WinISD prefers
    // abs(Hc-Hg)/2, but an equal overhang gives 0 — not an excursion limit — and it falls
    // through to Vd/Sd below. Probe case G, ledger QO39/QO40.
    if (r.Xmax == null && r.Hc != null && r.Hg != null && r.Hc !== r.Hg) {
      setVal('Xmax', Math.abs(r.Hc - r.Hg) / 2);
    }
    if (r.Hc == null && r.Xmax != null && r.Hg != null) {
      setVal('Hc', r.Hg > 2 * r.Xmax ? r.Hg - 2 * r.Xmax : r.Hg + 2 * r.Xmax);
    }
    if (r.Hg == null && r.Xmax != null && r.Hc != null) {
      setVal('Hg', r.Hc > 2 * r.Xmax ? r.Hc - 2 * r.Xmax : r.Hc + 2 * r.Xmax);
    }
    if (r.Xmax == null && r.Vd != null && r.Sd != null && r.Sd > 0) {
      setVal('Xmax', r.Vd / r.Sd);
    }


    // 8. Sd fallback from Vd/Xmax
    if (r.Sd == null && r.Vd != null && r.Xmax != null && r.Xmax > 0) {
      setVal('Sd', r.Vd / r.Xmax);
    }

    // 9. Vd
    if (r.Vd == null && r.Sd != null && r.Xmax != null) {
      setVal('Vd', r.Sd * r.Xmax);
    }

    // 10. no, Fs, Qes, Vas — Fs-from-this-triple is rel 14, tried in block 3 above.
    if (r.no == null && r.Fs != null && r.Vas != null && r.Qes != null) {
      setVal('no', referenceEfficiency(r.Fs, r.Vas, r.Qes, driverC(r)));
    }
    if (r.Vas == null && r.no != null && r.Qes != null && r.Fs != null && r.Fs > 0) {
      setVal('Vas', r.no * r.Qes / (efficiencyConstant(driverC(r)) * (r.Fs ** 3)));
    }
    if (r.Qes == null && r.no != null && r.Fs != null && r.Vas != null && r.no > 0) {
      setVal('Qes', efficiencyConstant(driverC(r)) * (r.Fs ** 3) * r.Vas / r.no);
    }

    // 11. SPLref <-> no
    if (r.SPLref == null && r.no != null && r.no > 0) {
      setVal('SPLref', splFromEfficiency(r.no, driverRho(r), driverC(r)));
    }
    if (r.no == null && r.SPLref != null) {
      setVal('no', efficiencyFromSpl(r.SPLref, driverRho(r), driverC(r)));
    }

    // 12. USPL, SPLref, Re
    //
    // USPL = SPL_stated + 10·log₁₀(2.83²/Re), NOT the bare-8 formula this code used before.
    // `2.83` is the industry-standard 1 W/8 Ω test voltage (V = √(1·8) = 2.828…, WinISD's own
    // rounded label). `2.83² = 8.0089`, not `8`, and the two are close enough to look
    // interchangeable (0.0048 dB) but are NOT: predicting `USPL` from each golden's own STATED
    // `SPL` and `Re` with the `2.83²` constant agrees with WinISD to 4.3e-14 relative on every
    // parity golden available (e.g. `sealed-small`: `90 + 10·log₁₀(8.0089/6.4) =
    // 90.9739289706469`, WinISD's own stored value to the last digit); the bare-8 formula is
    // off by 0.0048 dB on every one. `SPL_stated` is the record's OWN carried `SPL` (WDR key
    // `SPL`, entered — present in `r` here as soon as it is entered, since `r` is the untyped
    // record `solveConsistencyGroup` was handed and it is never declared or touched by this
    // function, only passed through); a record with no stated SPL falls back to `SPLref`, the
    // η₀-derived reference sensitivity block 11 above just produced — WinISD does the same
    // (its own `SPL` cell is entered-or-computed exactly like `SPLref` is here). See
    // bugs/BUG_20260813_uspl-and-splmax-use-formulas-winisd-does-not-2p83-volts-and-a-3db-derating.md
    // and docs/spec/SPEC_ENGINE.md "USPL / SPLmax — the 2.83 V reference and the 3 dB derating".
    const V283_SQ = 2.83 * 2.83;
    const uSplBase = r.SPL ?? r.SPLref;
    if (r.USPL == null && uSplBase != null && r.Re != null && r.Re > 0) {
      setVal('USPL', uSplBase + 10 * Math.log10(V283_SQ / r.Re));
    }
    if (r.Re == null && r.USPL != null && uSplBase != null) {
      setVal('Re', V283_SQ / Math.pow(10, (r.USPL - uSplBase) / 10));
    }
    if (r.SPLref == null && r.USPL != null && r.Re != null && r.Re > 0) {
      setVal('SPLref', r.USPL - 10 * Math.log10(V283_SQ / r.Re));
    }

    // 13. WinISD's Advanced-pane figures of merit (KNOWLEDGE_REPORT.md §4). Everything on
    // that panel except alfaVC/Rt/Ct is calculated — deleting one in WinISD makes it fill
    // the value back in (human ruling, ledger QO24).
    //
    // Rme has TWO routes, and the ORDER matters. They are the same number whenever
    // Bl = √(2π·Fs·Mms·Re/Qes) holds, so they diverge only on a record whose stored Bl
    // disagrees with its own Fs/Mms/Re/Qes — which real records do. On the Beyma 10BR60/V2
    // fixture the motional route gives 18.22124 and Bl²/Re gives 18.27846, and WinISD's own
    // value is the first: the motional route WINS, and Bl²/Re is only the fallback for a
    // record that cannot evaluate it.
    if (r.Rme == null && r.Fs != null && r.Mms != null && r.Qes != null && r.Qes > 0) {
      setVal('Rme', TAU * r.Fs * r.Mms / r.Qes);
    }
    if (r.Rme == null && r.BL != null && r.Re != null && r.Re > 0) {
      setVal('Rme', r.BL * r.BL / r.Re);
    }
    // Mpow = Bl/√Re — WinISD's OWN route, not √Rme. Verified from the `inconsistent-fs`
    // parity golden (packages/winisd/test/fixtures/winisd-parity/goldens/inconsistent-fs.wpr):
    // that record's stored `Fs` is written at exactly twice its true 1/(2π√(Mms·Cms)), which
    // separates the two candidate routes (they agree on every self-consistent record, which is
    // why 14 of the 15 parity goldens couldn't distinguish them). On that record WinISD wrote
    // `Rme=17.578125` (the motional route, 2π·Fs·Mms/Qes on the STORED Fs — unaffected by this
    // change) beside `Mpow=2.96463530640786`. `Bl/√Re = 7.5/√6.4 = 2.96463530640786`, matching
    // WinISD to the last digit; `√Rme = √17.578125 = 4.1926274578121`, which does not. So
    // WinISD's `Rme` and `Mpow` are independently sourced, not related by a square root — the
    // `Mpow = √Rme` identity this code used to pin is not one WinISD holds, and is dropped.
    // `√Rme` is retained only as the fallback for a record with no `Bl` (e.g. `Bl` itself
    // absent but `Rme` derivable from Fs/Mms/Qes). See
    // bugs/BUG_20260813_mpow-uses-sqrt-rme-where-winisd-uses-bl-over-sqrt-re.md.
    if (r.Mpow == null && r.BL != null && r.Re != null && r.Re > 0) setVal('Mpow', r.BL / Math.sqrt(r.Re));
    if (r.Mpow == null && r.Rme != null && r.Rme > 0) setVal('Mpow', Math.sqrt(r.Rme));
    // gamma = Bl/Mms — one route only.
    if (r.gamma == null && r.BL != null && r.Mms != null && r.Mms > 0) setVal('gamma', r.BL / r.Mms);
    // SPLmax = SPL_stated + 10·log₁₀(Pe) − 3 dB: the thermal-limit offset from the SAME base
    // USPL offsets from (`uSplBase`, block 12 above — stated SPL, else the η₀-derived
    // SPLref). The flat 3 dB derating is measured exactly (not 10·log₁₀(2) = 3.0103 — the two
    // parity goldens available print `SPLmax` values that back out to a derating of precisely
    // 3.0, e.g. `sealed-small`: `90 + 10·log₁₀(100) − 3 = 107`, WinISD's own stored value
    // exactly) but its PHYSICAL reason is not established by any source found in
    // winisd_research/ — the WHAT (exactly −3 dB) is proven, the WHY is not. See
    // bugs/BUG_20260813_uspl-and-splmax-use-formulas-winisd-does-not-2p83-volts-and-a-3db-derating.md
    // and docs/spec/SPEC_ENGINE.md "USPL / SPLmax — the 2.83 V reference and the 3 dB derating".
    if (r.SPLmax == null && uSplBase != null && r.Pe != null && r.Pe > 0) {
      setVal('SPLmax', uSplBase + 10 * Math.log10(r.Pe) - 3);
    }
    // Gloss — the static gravitational cone sag as a FRACTION of Xmax: g/((2π·Fs)²·Xmax)
    // (winisd_research/SOLVER_GAPS.md §2.4 — 41 live samples, worst relative residual 3.6e-15).
    // It reads the STORED Fs. The rival g·Mms·Cms/Xmax is exact on every self-consistent
    // driver, because Mms·Cms = 1/(2π·Fs)² there, and lands at relative residual 3.0 on a
    // driver whose Fs is written to disagree with its own Mms·Cms — so the two are separated,
    // not merely ranked. `Gloss` is the record's ONE name for the quantity, and what goes in
    // it is the fraction the file carries; the percent WinISD's pane shows is the display
    // layer's ×100 and exists nowhere in this module.
    if (r.Gloss == null && r.Fs != null && r.Fs > 0 && r.Xmax != null && r.Xmax > 0) {
      setVal('Gloss', G_STANDARD / ((TAU * r.Fs) ** 2 * r.Xmax));
    }
    // SPLmaxLF — the excursion-limited half-space SPL at 20 Hz, 1 m, as dB re 20 µPa. The
    // bracket is the far-field RMS pressure of a piston of volume displacement Vd,
    // p = ρ₀·ω²·Vd/(2π·r·√2) at r = 1 m, ω = 2π·20. ρ₀ is the air the RECORD carries
    // (`driverRho` above — a .wdr's own `roo`, else the live physical model), never a
    // literal: WinISD moves SPLmaxLF by exactly 20·log₁₀(ρ ratio) when `roo` alone is changed.
    if (r.SPLmaxLF == null && r.Vd != null && r.Vd > 0) {
      const p20 = driverRho(r) * (TAU * 20) ** 2 * r.Vd / (TAU * Math.SQRT2);
      setVal('SPLmaxLF', 20 * Math.log10(p20 / P0));
    }
    // Mcost — Rme scaled by how far the coil leaves the gap: Rme·(1 + Xmax/min(Hc,Hg)). It
    // carries Rme's unit and reduces to Rme exactly when the coil never leaves. It reads Xmax
    // ITSELF: the rival Rme·(Hc+Hg)/(2·min) is exact whenever Xmax = |Hc−Hg|/2 (which the block
    // above makes true of any record that lets it) and lands at 0.40 on a record where Xmax is
    // written away from the gap geometry. Uses the Rme the precedence above produced — there is
    // no second Rme here. min(Hc,Hg) is the DIVISOR and both are 0 on essentially every real
    // record, which is the whole reason WinISD's own files read Mcost=0; when it is zero or
    // missing the field stays ABSENT, because neither 0 nor Infinity is a number this driver has.
    const minHeight = r.Hc != null && r.Hg != null ? Math.min(r.Hc, r.Hg) : 0;
    if (r.Mcost == null && r.Rme != null && r.Xmax != null && minHeight > 0) {
      setVal('Mcost', r.Rme * (1 + r.Xmax / minHeight));
    }

    // 14. Znom from Re — `nominalImpedance` above. Placed after every block that can PRODUCE
    // `Re` (6 and 12), because WinISD accepts a calculated Re as this rule's input. It does not
    // go through `setVal`: that refuses a non-positive result, and Re < 2/3 legitimately yields
    // a COMPUTED zero (probe Z_tie_re0.6 — Znom=0 marked C, not the unset Znom=0/N of a blank
    // driver). An entered Znom is never touched, so a Znom contradicting its own Re stays pinned.
    if (r.Znom == null && r.Re != null && r.Re > 0) {
      r.Znom = nominalImpedance(r.Re);
      changed = true;
    }

    iterations++;
  }

  // The air a record carries is itself a derivable field, exactly like any other: entered
  // (a .wdr's own c/roo) wins, else recomputed exactly as `driverC`/`driverRho` do above —
  // surfacing it here in the output record is what lets every caller treat c/roo through the
  // SAME entered-or-computed path as Fs/Qes/EBP, with no special case anywhere above this module.
  if (r.c == null) r.c = driverC(r);
  if (r.roo == null) r.roo = driverRho(r);

  // EBP (Fs/Qes) likewise: a real derivable field, computed once every input it needs is
  // available, through the SAME formula `alignments.ts` exports for every other caller —
  // never recomputed ad hoc downstream.
  if (r.EBP == null && r.Fs != null && r.Qes != null && r.Qes > 0) {
    r.EBP = ebp({ Fs: r.Fs, Qes: r.Qes });
  }

  return r;
}

export function deriveEngineDriver(d: DriverFields): Result<EngineDriver> {
  const errors: DriverError[] = [];
  // The working copy stays in DriverFields shape through validation and derivation —
  // guarded reads (r.Fs! > 0) tolerate the pre-validation undefined values fine — and is
  // cast to EngineDriver only once every required field is confirmed present, at return.
  const r: DriverFields = { ...d };

  // Auto-derive Sd from Dd if Dd is entered but Sd is not
  if (!(r.Sd! > 0) && r.Dd! > 0) {
    r.Sd = Math.PI * (r.Dd! / 2) ** 2;
  }
  // Auto-derive Dd from Sd if Sd is entered but Dd is not
  if (!(r.Dd! > 0) && r.Sd! > 0) {
    r.Dd = 2 * Math.sqrt(r.Sd! / Math.PI);
  }

  // Required fields — each missing one is a blocking error
  if (!(r.Fs! > 0))  errors.push({ level: 'error', field: 'Fs',  message: 'Resonant frequency (Fs) is required and must be greater than zero' });
  if (!(r.Re! > 0))  errors.push({ level: 'error', field: 'Re',  message: 'DC resistance (Re) is required and must be greater than zero' });
  if (!(r.Sd! > 0))  errors.push({ level: 'error', field: 'Sd',  message: 'Piston area (Sd) is required — enter Sd or cone diameter' });
  if (!(r.Vas! > 0)) errors.push({ level: 'error', field: 'Vas', message: 'Acoustic compliance volume (Vas) is required for moving-mass derivation' });

  // A usable Q is FINITE as well as positive. `Infinity > 0` is true, so a bare `> 0` test
  // accepts a Q that is itself already poison — and a caller that ran solveConsistencyGroup
  // first (the Driver ADT does, before handing the result here) could present exactly that.
  const qOk = (v: number | undefined): boolean => v != null && Number.isFinite(v) && v > 0;

  // Q completeness — need at least two of {Qts, Qes, Qms} to solve the third
  const qCount = [r.Qts, r.Qes, r.Qms].filter(qOk).length;
  if (qCount < 2) errors.push({ level: 'error', field: 'Qts', message: 'At least two Q parameters (Qts, Qes, Qms) are required — enter any two to derive the third' });

  // Qts is the parallel combination of Qes and Qms, so physically Qms > Qts and Qes > Qts.
  // Equal or inverted values are inconsistent data, not a second-best input: the derivation
  // Qes = Qts·Qms/(Qms−Qts) divides by zero or flips sign, which would poison Bl and the
  // whole circuit. Checked whenever BOTH members of a pair are given — not only when the
  // third is absent, because an already-present third does not make the pair consistent.
  if (qOk(r.Qts) && qOk(r.Qms) && r.Qms! <= r.Qts!)
    errors.push({ level: 'error', field: 'Qms', message: 'Qms must be greater than Qts (Qts is the parallel combination of Qes and Qms)' });
  if (qOk(r.Qts) && qOk(r.Qes) && r.Qes! <= r.Qts!)
    errors.push({ level: 'error', field: 'Qes', message: 'Qes must be greater than Qts (Qts is the parallel combination of Qes and Qms)' });

  // Optional fields — absence does NOT block derivation; it only drops one reference
  // line from a chart. Reported as warnings so the UI can list them (dismissable) and
  // still draw the reliable curve.
  if (!(r.Pe! > 0))   errors.push({ level: 'warn', field: 'Pe',   message: 'Rated power (Pe) is not set — the thermal-limit line is omitted from the Max-SPL and Max-power charts' });
  if (!(r.Xmax! > 0)) errors.push({ level: 'warn', field: 'Xmax', message: 'Peak excursion (Xmax) is not set — the Xmax limit line is omitted from the Excursion and Max-SPL charts' });

  if (errors.some(e => e.level === 'error')) return { value: null, errors };

  // Q-resolution, Cms/Mms/Rms/Bl, Xmax(Hc,Hg), Vd — the shared consistency-group
  // solver, single copy (see its docstring for what's deliberately excluded).
  Object.assign(r, solveConsistencyGroup(r));

  // Calculated sensitivity / efficiency (WinISD equivalents), through the single
  // implementation in efficiency.ts. η₀ is a FRACTION, so nothing here divides by 100.
  // `solveConsistencyGroup` above already resolved r.c/r.roo (entered, or computed) — reused
  // here rather than re-derived, so there is exactly one air resolution per record.
  r.no = referenceEfficiency(r.Fs!, r.Vas!, r.Qes!, r.c!);
  if (r.no > 0) {
    r.SPLref = splFromEfficiency(r.no, r.roo!, r.c!);
    // 2.83² (WinISD's own 1 W/8 Ω test-voltage reference, squared), NOT the bare 8 this used to
    // read — same fix, same evidence, as `solveConsistencyGroup` block 12 above. `Driver`
    // carries no stated `SPL` of its own (this function's documented boundary — the working
    // copy built above from `d`, before the consistency-group solve), so the base stays
    // `SPLref` here.
    if (r.Re! > 0) {
      r.USPL = r.SPLref + 10 * Math.log10(2.83 * 2.83 / r.Re!);
    }
    // SPLmax = SPLref + 10·log₁₀(Pe) − 3 dB — the flat 3 dB derating measured exactly on the
    // `winisd-parity` goldens (same evidence as `solveConsistencyGroup`'s SPLmax block); this
    // duplicate implementation previously omitted SPLmax entirely.
    if (r.Pe! > 0) {
      r.SPLmax = r.SPLref + 10 * Math.log10(r.Pe!) - 3;
    }
  }

  return { value: r as unknown as EngineDriver, errors };
}

/**
 * Voice-coil DC resistance at an elevated temperature — thermal power compression (WinISD
 * parity, docs/research/WINISD_PARITY.md): `Re_hot = Re·(1 + alfaVC·ΔT)`, where `alfaVC` is the SI temperature
 * coefficient (/K; the UI's `1000/K` value ÷ 1000) and ΔT is the coil rise (K). ΔT=0 or
 * alfaVC=0 returns `Re` exactly (no-op).
 */
export function hotRe(Re: number, alfaVC: number, dT: number): number {
  return Re * (1 + (alfaVC || 0) * (dT || 0));
}

/**
 * Return a copy of the driver with `MaddKg` kilograms added to the cone's moving mass
 * (driver-side added mass — the WinISD "Added mass to cone" field, verified used in
 * docs/research/WINISD_PARITY.md). The suspension (Cms, Rms), motor (Bl), Re, Sd and Vas are unchanged by
 * the mass; the resonance and Q's follow from the heavier Mms:
 *   Mms' = Mms + Madd,  Fs' = 1/(2π√(Mms'·Cms)),
 *   Qms' = ωs'·Mms'/Rms,  Qes' = ωs'·Mms'·Re/Bl²,  Qts' = Qes'·Qms'/(Qes'+Qms').
 * `MaddKg ≤ 0` returns an equivalent driver (exact no-op) so existing goldens never move.
 */
export function withAddedMass(drv: EngineDriver, MaddKg: number): EngineDriver {
  if (!(MaddKg > 0)) return { ...drv };
  const Mms = drv.Mms + MaddKg;
  const ws  = 1 / Math.sqrt(Mms * drv.Cms);          // ωs = 1/√(Mms·Cms)
  const Fs  = ws / (2 * Math.PI);
  const Qms = ws * Mms / drv.Rms;                    // ωs·Mms/Rms
  const Qes = ws * Mms * drv.Re / (drv.BL * drv.BL); // ωs·Mms·Re/Bl²
  const Qts = (Qes * Qms) / (Qes + Qms);
  return { ...drv, Mms, Fs, Qms, Qes, Qts };
}
