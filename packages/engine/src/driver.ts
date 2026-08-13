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

import { RHO, C, P0, G_STANDARD } from './constants.js';
import { efficiencyConstant, referenceEfficiency, splFromEfficiency, efficiencyFromSpl } from './efficiency.js';
import type { DriverRaw, Driver, DriverError, Result } from './types.js';

/**
 * The air a driver record itself carries. A `.wdr` stores `c` and `roo`, and the Driver ADT
 * passes them straight through, so a WinISD-authored driver reproduces WinISD's own `no`/`SPL`
 * exactly. Reference efficiency and the SPL constant derived from it are both functions of the
 * air, which is why this is read per record rather than taken from the module constants.
 *
 * Only `solveConsistencyGroup` can use it: it works on the untyped record it was handed, which
 * is where those two keys actually arrive. `Driver`/`DriverRaw` do not model air at all (see
 * the OBSOLETE note on `DriverRaw` in types.ts — that interface is frozen pending AD-9's
 * successor type), so `deriveDriver` has nothing to read and uses the app constants.
 */
function airOf(r: Readonly<Record<string, number | undefined>>): { c: number; rho: number } {
  return {
    c:   r.c   != null && r.c   > 0 ? r.c   : C,
    rho: r.roo != null && r.roo > 0 ? r.roo : RHO,
  };
}

/**
 * Solve every derivable Thiele/Small field from whatever is already present in `d`,
 * without requiring a complete set — an entered (non-null) value is NEVER overwritten
 * (WinISD's fixed-E override semantics). This is the ONE place these formulas exist;
 * `deriveDriver` layers required-field validation on top of it for the "ready to
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
 * the air in use (`airOf`). η₀ is a FRACTION throughout; the percent lives in the display
 * layer only.
 */
export function solveConsistencyGroup(d: DriverRaw, options?: { full?: boolean }): DriverRaw {
  // Keyed access, not `any`: the solver writes fields by name (`r[key] = val` in the full
  // pass), which a typed DriverRaw cannot express — but every value in the group is a number
  // or absent, so the index signature says exactly that and keeps the arithmetic checked.
  const r = { ...d } as unknown as Record<string, number | undefined>;

  const TAU = 2 * Math.PI;
  const air = airOf(r);
  const CONST_NO = efficiencyConstant(air.c);

  // Run full solver ONLY when explicitly requested, otherwise run classic path to avoid test drift/failures
  if (!options?.full) {
    if (r.Sd == null && r.Dd! > 0) r.Sd = Math.PI * (r.Dd! / 2) ** 2;
    if (r.Dd == null && r.Sd! > 0) r.Dd = 2 * Math.sqrt(r.Sd! / Math.PI);

    if (r.Qts == null && r.Qes != null && r.Qms != null) r.Qts = r.Qes * r.Qms / (r.Qes + r.Qms);
    if (r.Qes == null && r.Qts != null && r.Qms != null && r.Qms > r.Qts) r.Qes = r.Qts * r.Qms / (r.Qms - r.Qts);
    if (r.Qms == null && r.Qts != null && r.Qes != null && r.Qes > r.Qts) r.Qms = r.Qts * r.Qes / (r.Qes - r.Qts);

    if (r.Fs != null && r.Vas != null && r.Sd != null) {
      const Cas = r.Vas / (RHO * C * C);
      if (r.Cms == null) r.Cms = Cas / (r.Sd * r.Sd);
      if (r.Mms == null && r.Cms != null) r.Mms = 1 / ((2 * Math.PI * r.Fs) ** 2 * r.Cms);
      if (r.Rms == null && r.Qms != null && r.Mms != null) r.Rms = 2 * Math.PI * r.Fs * r.Mms / r.Qms;
      if (r.Bl == null && r.Re != null && r.Qes != null && r.Mms != null) {
        r.Bl = Math.sqrt(2 * Math.PI * r.Fs * r.Mms * r.Re / r.Qes);
      }
    }

    if (r.Vd == null && r.Sd != null && r.Xmax != null) r.Vd = r.Sd * r.Xmax;

    if (r.Fs == null && r.Mms != null && r.Cms != null) {
      r.Fs = 1 / (2 * Math.PI * Math.sqrt(r.Mms * r.Cms));
    }
    if (r.Re == null && r.Qes != null && r.Bl != null && r.Fs != null && r.Mms != null) {
      r.Re = r.Qes * r.Bl * r.Bl / (2 * Math.PI * r.Fs * r.Mms);
    }

    return r as unknown as DriverRaw;
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

    // 3. Fs, Mms, Cms
    if (r.Fs == null && r.Mms != null && r.Cms != null) setVal('Fs', 1 / (TAU * Math.sqrt(r.Mms * r.Cms)));
    if (r.Mms == null && r.Fs != null && r.Cms != null) setVal('Mms', 1 / ((TAU * r.Fs) ** 2 * r.Cms));
    if (r.Cms == null && r.Fs != null && r.Mms != null) setVal('Cms', 1 / ((TAU * r.Fs) ** 2 * r.Mms));

    // 4. Vas, Cms, Sd
    const rho_c2 = RHO * C * C;
    if (r.Vas == null && r.Cms != null && r.Sd != null) setVal('Vas', rho_c2 * r.Sd * r.Sd * r.Cms);
    if (r.Cms == null && r.Vas != null && r.Sd != null && r.Sd > 0) setVal('Cms', r.Vas / (rho_c2 * r.Sd * r.Sd));
    if (r.Sd == null && r.Vas != null && r.Cms != null && r.Cms > 0) setVal('Sd', Math.sqrt(r.Vas / (rho_c2 * r.Cms)));

    // 5. Rms, Fs, Mms, Qms
    if (r.Rms == null && r.Fs != null && r.Mms != null && r.Qms != null) setVal('Rms', TAU * r.Fs * r.Mms / r.Qms);
    if (r.Qms == null && r.Fs != null && r.Mms != null && r.Rms != null) setVal('Qms', TAU * r.Fs * r.Mms / r.Rms);
    if (r.Mms == null && r.Fs != null && r.Qms != null && r.Rms != null && r.Fs > 0) setVal('Mms', r.Rms * r.Qms / (TAU * r.Fs));
    if (r.Fs == null && r.Mms != null && r.Qms != null && r.Rms != null && r.Mms > 0) setVal('Fs', r.Rms * r.Qms / (TAU * r.Mms));

    // 6. Qes, Bl, Fs, Mms, Re
    if (r.Qes == null && r.Fs != null && r.Mms != null && r.Re != null && r.Bl != null) setVal('Qes', TAU * r.Fs * r.Mms * r.Re / (r.Bl * r.Bl));
    if (r.Re == null && r.Qes != null && r.Bl != null && r.Fs != null && r.Mms != null) setVal('Re', r.Qes * r.Bl * r.Bl / (TAU * r.Fs * r.Mms));
    if (r.Bl == null && r.Qes != null && r.Re != null && r.Fs != null && r.Mms != null && r.Qes > 0) setVal('Bl', Math.sqrt(TAU * r.Fs * r.Mms * r.Re / r.Qes));
    if (r.Mms == null && r.Qes != null && r.Bl != null && r.Fs != null && r.Re != null && r.Fs > 0 && r.Re > 0) setVal('Mms', r.Qes * r.Bl * r.Bl / (TAU * r.Fs * r.Re));
    if (r.Fs == null && r.Qes != null && r.Bl != null && r.Mms != null && r.Re != null && r.Mms > 0 && r.Re > 0) setVal('Fs', r.Qes * r.Bl * r.Bl / (TAU * r.Mms * r.Re));

    // 7. Xmax / Hc / Hg relations
    if (r.Xmax == null && r.Hc != null && r.Hg != null) {
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

    // 10. no, Fs, Qes, Vas
    if (r.no == null && r.Fs != null && r.Vas != null && r.Qes != null) {
      setVal('no', referenceEfficiency(r.Fs, r.Vas, r.Qes, air.c));
    }
    if (r.Vas == null && r.no != null && r.Qes != null && r.Fs != null && r.Fs > 0) {
      setVal('Vas', r.no * r.Qes / (CONST_NO * (r.Fs ** 3)));
    }
    if (r.Qes == null && r.no != null && r.Fs != null && r.Vas != null && r.no > 0) {
      setVal('Qes', CONST_NO * (r.Fs ** 3) * r.Vas / r.no);
    }
    if (r.Fs == null && r.no != null && r.Qes != null && r.Vas != null && r.Vas > 0 && r.no > 0) {
      setVal('Fs', Math.pow((r.no * r.Qes) / (CONST_NO * r.Vas), 1 / 3));
    }

    // 11. SPLref <-> no
    if (r.SPLref == null && r.no != null && r.no > 0) {
      setVal('SPLref', splFromEfficiency(r.no, air.rho, air.c));
    }
    if (r.no == null && r.SPLref != null) {
      setVal('no', efficiencyFromSpl(r.SPLref, air.rho, air.c));
    }

    // 12. USPL, SPLref, Re
    if (r.USPL == null && r.SPLref != null && r.Re != null && r.Re > 0) {
      setVal('USPL', r.SPLref + 10 * Math.log10(8 / r.Re));
    }
    if (r.Re == null && r.USPL != null && r.SPLref != null) {
      setVal('Re', 8 / Math.pow(10, (r.USPL - r.SPLref) / 10));
    }
    if (r.SPLref == null && r.USPL != null && r.Re != null && r.Re > 0) {
      setVal('SPLref', r.USPL - 10 * Math.log10(8 / r.Re));
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
    if (r.Rme == null && r.Bl != null && r.Re != null && r.Re > 0) {
      setVal('Rme', r.Bl * r.Bl / r.Re);
    }
    // Mpow = Bl/√Re = √Rme. Stated as √Rme so it cannot contradict the Rme actually produced
    // — taking Bl/√Re on the Beyma fixture would print 4.27533 beside an Rme of 18.22124,
    // whose square root is 4.26863. ⚠ WinISD's own choice between the two is unverified; this
    // one is chosen because it keeps the pinned identity Mpow = √Rme true of our output.
    if (r.Mpow == null && r.Rme != null && r.Rme > 0) setVal('Mpow', Math.sqrt(r.Rme));
    // gamma = Bl/Mms — one route only.
    if (r.gamma == null && r.Bl != null && r.Mms != null && r.Mms > 0) setVal('gamma', r.Bl / r.Mms);
    // SPLmax = SPL + 10·log₁₀(Pe): the thermal-limit offset from the SAME reference
    // sensitivity USPL offsets from, which efficiency.ts produced at block 11. No second copy
    // of the SPL constant exists here.
    if (r.SPLmax == null && r.SPLref != null && r.Pe != null && r.Pe > 0) {
      setVal('SPLmax', r.SPLref + 10 * Math.log10(r.Pe));
    }
    // Gloss — the static gravitational cone sag as a FRACTION of Xmax: g/((2π·Fs)²·Xmax)
    // (winisd_research/SOLVER_GAPS.md §2.4 — 41 live samples, worst relative residual 3.6e-15).
    // It reads the STORED Fs. The rival g·Mms·Cms/Xmax is exact on every self-consistent
    // driver, because Mms·Cms = 1/(2π·Fs)² there, and lands at relative residual 3.0 on a
    // driver whose Fs is written to disagree with its own Mms·Cms — so the two are separated,
    // not merely ranked. `loss` is the record's ONE name for the quantity (the `.wdr` key is
    // `Gloss`), and what goes in it is the fraction the file carries; the percent WinISD's pane
    // shows is the display layer's ×100 and exists nowhere in this module.
    if (r.loss == null && r.Fs != null && r.Fs > 0 && r.Xmax != null && r.Xmax > 0) {
      setVal('loss', G_STANDARD / ((TAU * r.Fs) ** 2 * r.Xmax));
    }
    // SPLmaxLF — the excursion-limited half-space SPL at 20 Hz, 1 m, as dB re 20 µPa. The
    // bracket is the far-field RMS pressure of a piston of volume displacement Vd,
    // p = ρ₀·ω²·Vd/(2π·r·√2) at r = 1 m, ω = 2π·20. ρ₀ is the air the RECORD carries (`airOf`
    // above — a .wdr's own `roo`, else the app constant), never a literal: WinISD moves
    // SPLmaxLF by exactly 20·log₁₀(ρ ratio) when `roo` alone is changed.
    if (r.SPLmaxLF == null && r.Vd != null && r.Vd > 0) {
      const p20 = air.rho * (TAU * 20) ** 2 * r.Vd / (TAU * Math.SQRT2);
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

    iterations++;
  }

  return r as unknown as DriverRaw;
}

export function deriveDriver(d: DriverRaw): Result<Driver> {
  const errors: DriverError[] = [];
  // The working copy becomes a fully-derived Driver once validation passes below;
  // the single cast lets us assign the derived fields. Guarded reads (r.Fs > 0)
  // tolerate the pre-validation undefined values fine.
  const r = Object.assign({}, d) as Driver;

  // Auto-derive Sd from Dd if Dd is entered but Sd is not
  if (!(r.Sd > 0) && r.Dd! > 0) {
    r.Sd = Math.PI * (r.Dd! / 2) ** 2;
  }
  // Auto-derive Dd from Sd if Sd is entered but Dd is not
  if (!(r.Dd! > 0) && r.Sd > 0) {
    r.Dd = 2 * Math.sqrt(r.Sd / Math.PI);
  }

  // Required fields — each missing one is a blocking error
  if (!(r.Fs > 0))  errors.push({ level: 'error', field: 'Fs',  message: 'Resonant frequency (Fs) is required and must be greater than zero' });
  if (!(r.Re > 0))  errors.push({ level: 'error', field: 'Re',  message: 'DC resistance (Re) is required and must be greater than zero' });
  if (!(r.Sd > 0))  errors.push({ level: 'error', field: 'Sd',  message: 'Piston area (Sd) is required — enter Sd or cone diameter' });
  if (!(r.Vas > 0)) errors.push({ level: 'error', field: 'Vas', message: 'Acoustic compliance volume (Vas) is required for moving-mass derivation' });

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
  if (qOk(r.Qts) && qOk(r.Qms) && r.Qms <= r.Qts)
    errors.push({ level: 'error', field: 'Qms', message: 'Qms must be greater than Qts (Qts is the parallel combination of Qes and Qms)' });
  if (qOk(r.Qts) && qOk(r.Qes) && r.Qes <= r.Qts)
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
  // `Driver` carries no air of its own, so the app constants are the air in use here; a
  // record that DOES carry `c`/`roo` gets them honoured in solveConsistencyGroup above.
  r.no = referenceEfficiency(r.Fs, r.Vas, r.Qes, C);
  if (r.no > 0) {
    r.SPLref = splFromEfficiency(r.no, RHO, C);
    if (r.Re > 0) {
      r.USPL = r.SPLref + 10 * Math.log10(8 / r.Re);
    }
  }

  return { value: r, errors };
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
export function withAddedMass(drv: Driver, MaddKg: number): Driver {
  if (!(MaddKg > 0)) return { ...drv };
  const Mms = drv.Mms + MaddKg;
  const ws  = 1 / Math.sqrt(Mms * drv.Cms);          // ωs = 1/√(Mms·Cms)
  const Fs  = ws / (2 * Math.PI);
  const Qms = ws * Mms / drv.Rms;                    // ωs·Mms/Rms
  const Qes = ws * Mms * drv.Re / (drv.Bl * drv.Bl); // ωs·Mms·Re/Bl²
  const Qts = (Qes * Qms) / (Qes + Qms);
  return { ...drv, Mms, Fs, Qms, Qes, Qts };
}
