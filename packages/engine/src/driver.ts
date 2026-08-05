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

import { RHO, C } from './constants.js';
import type { DriverRaw, Driver, DriverError, Result } from './types.js';

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
 * Deliberately excludes the no/SPLref/USPL/SPL reference-efficiency chain — three
 * disagreeing constants exist across the pre-consolidation copies this function
 * replaces (109 inferred / 112.1 / 112.2 — PLAN_JS_CALC_CONSOLIDATION.md §2 row 18),
 * and none of the three is currently wired to anything the UI displays (verified:
 * DriverEditorModal.vue's SPLref/USPL fields bind to the raw entered value, not to
 * any derived result). Picking one silently here would be resolving an open defect
 * as a side effect of an unrelated refactor — it needs its own dedicated audit.
 */
export function solveConsistencyGroup(d: DriverRaw): DriverRaw {
  // Cms/Mms/Rms/Bl aren't declared on DriverRaw (only Driver, the validated-complete
  // type) even though this function computes them from a possibly-incomplete input —
  // same tolerated cast deriveDriver already used below for the same reason.
  const r = { ...d } as Driver;

  for (let pass = 0; pass < 2; pass++) {
    if (r.Sd == null && r.Dd! > 0) r.Sd = Math.PI * (r.Dd! / 2) ** 2;
    if (r.Dd == null && r.Sd! > 0) r.Dd = 2 * Math.sqrt(r.Sd! / Math.PI);

    // Qts is the PARALLEL combination of Qes and Qms, so physically Qms > Qts and Qes > Qts.
    // The `>` guards are what keep the two division branches from fabricating a non-finite
    // Q: at Qms == Qts the denominator is zero (Qes = Infinity), and below it the result is
    // negative. Leaving the field unsolved is the honest outcome — `deriveDriver` then
    // reports the inconsistency against the named field instead of carrying Infinity into
    // Bl = √(2π·Fs·Mms·Re/Qes) = 0 and a silent flat −200 dB sweep.
    if (r.Qts == null && r.Qes != null && r.Qms != null) r.Qts = r.Qes * r.Qms / (r.Qes + r.Qms);
    if (r.Qes == null && r.Qts != null && r.Qms != null && r.Qms > r.Qts) r.Qes = r.Qts * r.Qms / (r.Qms - r.Qts);
    if (r.Qms == null && r.Qts != null && r.Qes != null && r.Qes > r.Qts) r.Qms = r.Qts * r.Qes / (r.Qes - r.Qts);

    if (r.Fs != null && r.Vas != null && r.Sd != null) {
      const Cas = r.Vas / (RHO * C * C);   // Cms = Vas/(ρc²·Sd²)
      if (r.Cms == null) r.Cms = Cas / (r.Sd * r.Sd);
      if (r.Mms == null && r.Cms != null) r.Mms = 1 / ((2 * Math.PI * r.Fs) ** 2 * r.Cms);
      if (r.Rms == null && r.Qms != null && r.Mms != null) r.Rms = 2 * Math.PI * r.Fs * r.Mms / r.Qms;
      if (r.Bl == null && r.Re != null && r.Qes != null && r.Mms != null)
        r.Bl = Math.sqrt(2 * Math.PI * r.Fs * r.Mms * r.Re / r.Qes);
    }

    // Xmax is INPUT ONLY and is never derived (human ruling 2026-08-05): it is a stated
    // physical limit of the driver, and a limit the manufacturer did not state is not ours
    // to invent. `abs(Hc-Hg)/2` is one geometric convention among several — WinISD's help
    // says "usually calculated as" — and a value produced that way would be indistinguishable
    // from one the manufacturer published while carrying none of its authority.

    // Peak displacement volume, SI (m³) — matches wdr.ts's file-format convention and
    // the UI's storage convention (DriverEditorModal.vue scales ×1e6 only for cm³ display).
    if (r.Vd == null && r.Sd != null && r.Xmax != null) r.Vd = r.Sd * r.Xmax;

    // NEW directions verified this session against real Beyma 10BR60/V2 fixtures
    // (GAPS.md §A4, "E/C/N derivation is one-directional; WinISD's is a group solver" —
    // open backlog item, partial coverage only, not closed by these two additions).
    if (r.Fs == null && r.Mms != null && r.Cms != null) {
      // Matches WinISD exactly on the Beyma fixture (28.82).
      r.Fs = 1 / (2 * Math.PI * Math.sqrt(r.Mms * r.Cms));
    }
    if (r.Re == null && r.Qes != null && r.Bl != null && r.Fs != null && r.Mms != null) {
      // Reproduces the naive hand-calc (6.520 on the Beyma fixture), NOT WinISD's own
      // recomputed value (6.439) — DISCOVERIES.md BUG-006, open, unexplained. Do not
      // "fix" this to hit 6.439 without resolving BUG-006 first; that would be
      // curve-fitting one fixture, not correcting the formula.
      r.Re = r.Qes * r.Bl * r.Bl / (2 * Math.PI * r.Fs * r.Mms);
    }
  }

  return r;
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

  // Derive calculated sensitivity / efficiency metrics (WinISD equivalents). NOT part
  // of solveConsistencyGroup — three disagreeing constants exist across the codebase
  // (109 inferred / 112.1 / 112.2, PLAN_JS_CALC_CONSOLIDATION.md §2 row 18) and none is
  // currently consumed by the UI, so resolving that is out of scope for this pass.
  r.no = (9.64e-10 * Math.pow(r.Fs, 3) * (r.Vas * 1000)) / r.Qes; // Vas from m³ to L is *1000
  if (r.no > 0) {
    r.SPLref = 112.2 + 10 * Math.log10(r.no / 100);
    if (r.Re > 0) {
      r.USPL = r.SPLref + 10 * Math.log10(8 / r.Re);
    }
  }

  return { value: r, errors };
}

/**
 * Voice-coil DC resistance at an elevated temperature — thermal power compression (WinISD
 * parity, WINISD.md §12c): `Re_hot = Re·(1 + alfaVC·ΔT)`, where `alfaVC` is the SI temperature
 * coefficient (/K; the UI's `1000/K` value ÷ 1000) and ΔT is the coil rise (K). ΔT=0 or
 * alfaVC=0 returns `Re` exactly (no-op).
 */
export function hotRe(Re: number, alfaVC: number, dT: number): number {
  return Re * (1 + (alfaVC || 0) * (dT || 0));
}

/**
 * Return a copy of the driver with `MaddKg` kilograms added to the cone's moving mass
 * (driver-side added mass — the WinISD "Added mass to cone" field, verified used in
 * WINISD.md §12c). The suspension (Cms, Rms), motor (Bl), Re, Sd and Vas are unchanged by
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
