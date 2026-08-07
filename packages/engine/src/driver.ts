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
export function solveConsistencyGroup(d: DriverRaw, options?: { full?: boolean }): DriverRaw {
  // Keyed access, not `any`: the solver writes fields by name (`r[key] = val` in the full
  // pass), which a typed DriverRaw cannot express — but every value in the group is a number
  // or absent, so the index signature says exactly that and keeps the arithmetic checked.
  const r = { ...d } as unknown as Record<string, number | undefined>;

  const TAU = 2 * Math.PI;
  const c3 = C ** 3;
  const CONST_NO = (4 * Math.PI ** 2) / c3;

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
      setVal('no', CONST_NO * (r.Fs ** 3) * r.Vas / r.Qes);
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
      setVal('SPLref', 112.2 + 10 * Math.log10(r.no));
    }
    if (r.no == null && r.SPLref != null) {
      setVal('no', Math.pow(10, (r.SPLref - 112.2) / 10));
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
