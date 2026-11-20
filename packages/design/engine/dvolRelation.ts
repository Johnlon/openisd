/**
 * The DVol/Depth/MagDepth/Magnet geometry relation — one equation WinISD solves in four
 * directions, reverse-engineered and pinned in `docs/design/WINISD_SCHEMA.md` §3.10.1 /
 * `winisd_research/RE_GHIDRA_FINDINGS.md` "The DVol geometry relation — recovered formulas".
 * bugs/archive/BUG_20260817_dvol_depth_magdepth_magnet_relation_is_documented_but_never_implemented.md.
 *
 * Built and tested standalone, alongside `solver.ts`'s own solver, rather than inside it — a
 * new file carries no risk of colliding with concurrent edits to that hot file. Wiring into
 * `solveConsistencyGroup` is a separate, later change.
 *
 * Model: the driver is a cone tapering from the diaphragm `Dd` to the voice coil `Vcd` over a
 * height of `Depth − MagDepth`, plus a cylinder (the magnet) of diameter `Magnet` and height
 * `MagDepth`. `S = Dd² + Dd·Vcd + Vcd²` is the frustum's cross-section shorthand WINISD_SCHEMA
 * uses; all lengths SI (metres), `DVol` in m³.
 *
 *     DVol     = (π/4) · [ S·(Depth − MagDepth)/3 + Magnet²·MagDepth ]
 *     Depth    = [ π·MagDepth·(S − 3·Magnet²) + 12·DVol ] / (π·S)
 *     MagDepth = [ π·S·Depth − 12·DVol ] / (π·(S − 3·Magnet²))
 *     Magnet   = √( [ 12·DVol − π·S·(Depth − MagDepth) ] / (3π·MagDepth) )
 *
 * The four expressions are algebraically equivalent inverses of one relation (WINISD_SCHEMA:
 * "checked against each other algebraically and agree exactly — the inverses are not fits").
 *
 * WinISD applies the formulas to any positive inputs and writes whatever comes out; OpenISD
 * does not (BUG_20261115_calculated-dimension-contradicts-its-own-geometry): a result that
 * contradicts the geometry it came from is refused. The model fixes the bounds:
 *   - the cone height `Depth - MagDepth` is positive, so `0 < MagDepth < Depth`.
 * No bound on `Magnet` beyond its radicand being positive: the relation itself says nothing more of it.
 * A refused direction leaves its field not-available, and `geometryRefusal` says why.
 */

export interface DvolInputs {
  Dd: number;
  Vcd: number;
  Depth: number;
  MagDepth: number;
  Magnet: number;
}

/** `S = Dd² + Dd·Vcd + Vcd²` — the frustum cross-section term every direction shares. */
function crossSection(Dd: number, Vcd: number): number {
  return Dd * Dd + Dd * Vcd + Vcd * Vcd;
}

/** The relation's four directions, each unbounded: the algebra alone, `null` only where it has no
 *  answer (a zero denominator, a negative radicand). */
function rawDvol(i: {Dd: number; Vcd: number; Depth: number; MagDepth: number; Magnet: number}): number {
  const S = crossSection(i.Dd, i.Vcd);
  return (Math.PI / 4) * (S * (i.Depth - i.MagDepth) / 3 + i.Magnet * i.Magnet * i.MagDepth);
}
function rawDepth(i: {Dd: number; Vcd: number; DVol: number; MagDepth: number; Magnet: number}): number {
  const S = crossSection(i.Dd, i.Vcd);
  return (Math.PI * i.MagDepth * (S - 3 * i.Magnet * i.Magnet) + 12 * i.DVol) / (Math.PI * S);
}
function rawMagDepth(i: {Dd: number; Vcd: number; DVol: number; Depth: number; Magnet: number}): number | null {
  const S = crossSection(i.Dd, i.Vcd);
  const denom = S - 3 * i.Magnet * i.Magnet;
  return denom !== 0 ? (Math.PI * S * i.Depth - 12 * i.DVol) / (Math.PI * denom) : null;
}
function rawMagnet(i: {Dd: number; Vcd: number; DVol: number; Depth: number; MagDepth: number}): number | null {
  const S = crossSection(i.Dd, i.Vcd);
  const radicand = (12 * i.DVol - Math.PI * S * (i.Depth - i.MagDepth)) / (3 * Math.PI * i.MagDepth);
  return radicand > 0 ? Math.sqrt(radicand) : null;
}

const positive = (...xs: number[]): boolean => xs.every(x => x > 0);

/** `DVol` from the other four. Guarded on every input being strictly positive and `Depth >
 *  MagDepth` (the cone's height must be positive): a magnet deeper than the whole driver is
 *  physically impossible. Returns `null` rather than a nonsensical value. */
export function dvolFromDims(i: Pick<DvolInputs, 'Dd' | 'Vcd' | 'Depth' | 'MagDepth' | 'Magnet'>): number | null {
  if (!positive(i.Dd, i.Vcd, i.Depth, i.MagDepth, i.Magnet) || !(i.Depth > i.MagDepth)) return null;
  return rawDvol(i);
}

/** `Depth` from `DVol` and the other three. Refused when the result does not clear the magnet
 *  (`Depth <= MagDepth`: no cone left). */
export function depthFromDims(i: {Dd: number; Vcd: number; DVol: number; MagDepth: number; Magnet: number}): number | null {
  if (!positive(i.Dd, i.Vcd, i.DVol, i.MagDepth, i.Magnet)) return null;
  const depth = rawDepth(i);
  return depth > i.MagDepth ? depth : null;
}

/** `MagDepth` from `DVol` and the other three. Refused when the denominator `S - 3*Magnet^2` is
 *  zero, and when the result is not strictly between 0 and `Depth`. A magnet wider than sqrt(S/3)
 *  makes the denominator negative; with a negative numerator that is an ordinary depth, as WinISD
 *  gives (BUG_20261119_magdepth-refused-for-a-wide-magnet). A denominator near zero gives a result
 *  of metres, which the `Depth` bound refuses. */
export function magDepthFromDims(i: {Dd: number; Vcd: number; DVol: number; Depth: number; Magnet: number}): number | null {
  if (!positive(i.Dd, i.Vcd, i.DVol, i.Depth, i.Magnet)) return null;
  const magDepth = rawMagDepth(i);
  return magDepth !== null && magDepth > 0 && magDepth < i.Depth ? magDepth : null;
}

/** `Magnet` from `DVol` and the other three. Refused when the radicand is not positive. */
export function magnetFromDims(i: {Dd: number; Vcd: number; DVol: number; Depth: number; MagDepth: number}): number | null {
  if (!positive(i.Dd, i.Vcd, i.DVol, i.Depth, i.MagDepth)) return null;
  const magnet = rawMagnet(i);
  return magnet;
}

export type GeometryTarget = 'DVol' | 'Depth' | 'MagDepth' | 'Magnet';

/** Millimetres as a short sentence figure: whole above 100 mm, three figures below. */
function mm(metres: number): string {
  const v = metres * 1000;
  return `${Math.abs(v) >= 100 ? Math.round(v) : Number(v.toPrecision(3))} mm`;
}

/**
 * Why `target` was not calculated, when every participant is stated and positive yet the relation's
 * answer contradicts the geometry (see the bounds above); `null` when it was calculated, or a
 * participant is missing. The sentence a user reads on the field.
 */
export function geometryRefusal(target: GeometryTarget, v: Partial<Record<'Dd' | 'Vcd' | 'DVol' | 'Depth' | 'MagDepth' | 'Magnet', number>>): string | null {
  const {Dd, Vcd, DVol, Depth, MagDepth, Magnet} = v;
  const tail = `Check the other dimensions, or enter ${target} yourself.`;
  if (Dd === undefined || Vcd === undefined || !positive(Dd, Vcd)) return null;
  switch (target) {
    case 'DVol':
      if (Depth === undefined || MagDepth === undefined || Magnet === undefined || !positive(Depth, MagDepth, Magnet)) return null;
      return Depth > MagDepth ? null
        : `DVol was not calculated: MagDepth (${mm(MagDepth)}) is not less than Depth (${mm(Depth)}), so there is no cone left. ${tail}`;
    case 'Depth': {
      if (DVol === undefined || MagDepth === undefined || Magnet === undefined || !positive(DVol, MagDepth, Magnet)) return null;
      const r = rawDepth({Dd, Vcd, DVol, MagDepth, Magnet});
      return r > MagDepth ? null
        : `Depth was not calculated: the other dimensions give ${mm(r)}, which is not deeper than the magnet (MagDepth ${mm(MagDepth)}). ${tail}`;
    }
    case 'MagDepth': {
      if (DVol === undefined || Depth === undefined || Magnet === undefined || !positive(DVol, Depth, Magnet)) return null;
      const r = rawMagDepth({Dd, Vcd, DVol, Depth, Magnet});
      if (r === null) return `MagDepth was not calculated: with Magnet ${mm(Magnet)} the magnet and cone terms cancel, so the dimensions cannot fix it. ${tail}`;
      if (r > 0 && r < Depth) return null;
      return `MagDepth was not calculated: the other dimensions give ${mm(r)}, which is ${r <= 0 ? 'not a depth' : `deeper than the driver itself (Depth ${mm(Depth)})`}. ${tail}`;
    }
    case 'Magnet': {
      if (DVol === undefined || Depth === undefined || MagDepth === undefined || !positive(DVol, Depth, MagDepth)) return null;
      const r = rawMagnet({Dd, Vcd, DVol, Depth, MagDepth});
      if (r === null) return `Magnet was not calculated: DVol is too small for a cone ${mm(Depth - MagDepth)} tall, so no magnet diameter fits. ${tail}`;
      return null;
    }
  }
}
