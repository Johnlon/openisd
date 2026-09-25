/**
 * The DVol/Depth/MagDepth/Magnet geometry relation — one equation WinISD solves in four
 * directions, reverse-engineered and pinned in `docs/design/WINISD_SCHEMA.md` §3.10.1 /
 * `winisd_research/RE_GHIDRA_FINDINGS.md` "The DVol geometry relation — recovered formulas".
 * bugs/BUG_20260817_dvol_depth_magdepth_magnet_relation_is_documented_but_never_implemented.md.
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

/**
 * `DVol` from the other four. Guarded on every input being strictly positive and `Depth >
 * MagDepth` (the cone's height must be positive) — WINISD_SCHEMA's binary trace guards the target
 * being unset and every other participant being strictly greater than zero; a non-positive cone
 * height is the one case that formula alone cannot rule out but is physically impossible (the
 * magnet would be deeper than the whole driver). Returns `null` rather than a nonsensical value.
 */
export function dvolFromDims(i: Pick<DvolInputs, 'Dd' | 'Vcd' | 'Depth' | 'MagDepth' | 'Magnet'>): number | null {
  const { Dd, Vcd, Depth, MagDepth, Magnet } = i;
  if (!(Dd > 0 && Vcd > 0 && Depth > 0 && MagDepth > 0 && Magnet > 0)) return null;
  if (!(Depth > MagDepth)) return null;
  const S = crossSection(Dd, Vcd);
  return (Math.PI / 4) * (S * (Depth - MagDepth) / 3 + Magnet * Magnet * MagDepth);
}

/** `Depth` from `DVol` and the other three. Same positivity guard; `S` is always > 0 for
 *  positive `Dd`/`Vcd`, so no division-by-zero guard is needed on this direction. */
export function depthFromDims(i: { Dd: number; Vcd: number; DVol: number; MagDepth: number; Magnet: number }): number | null {
  const { Dd, Vcd, DVol, MagDepth, Magnet } = i;
  if (!(Dd > 0 && Vcd > 0 && DVol > 0 && MagDepth > 0 && Magnet > 0)) return null;
  const S = crossSection(Dd, Vcd);
  return (Math.PI * MagDepth * (S - 3 * Magnet * Magnet) + 12 * DVol) / (Math.PI * S);
}

/** `MagDepth` from `DVol` and the other three. Guarded additionally on the denominator
 *  `S − 3·Magnet²` being strictly positive — WinISD's own trace guards this block identically
 *  (`RE_GHIDRA_FINDINGS.md`: "the target must be zero and all five other participants strictly
 *  greater than zero"); a non-positive denominator has no physical driver behind it. */
export function magDepthFromDims(i: { Dd: number; Vcd: number; DVol: number; Depth: number; Magnet: number }): number | null {
  const { Dd, Vcd, DVol, Depth, Magnet } = i;
  if (!(Dd > 0 && Vcd > 0 && DVol > 0 && Depth > 0 && Magnet > 0)) return null;
  const S = crossSection(Dd, Vcd);
  const denom = S - 3 * Magnet * Magnet;
  if (!(denom > 0)) return null;
  return (Math.PI * S * Depth - 12 * DVol) / (Math.PI * denom);
}

/** `Magnet` from `DVol` and the other three. The inverse takes a square root — WINISD_SCHEMA notes
 *  WinISD's own trace does too ("the `Magnet` inverse also takes `fsqrt`, so a physically
 *  impossible input set yields a NaN rather than a refusal"); this implementation refuses
 *  instead, returning `null` whenever the radicand is not positive. */
export function magnetFromDims(i: { Dd: number; Vcd: number; DVol: number; Depth: number; MagDepth: number }): number | null {
  const { Dd, Vcd, DVol, Depth, MagDepth } = i;
  if (!(Dd > 0 && Vcd > 0 && DVol > 0 && Depth > 0 && MagDepth > 0)) return null;
  const S = crossSection(Dd, Vcd);
  const radicand = (12 * DVol - Math.PI * S * (Depth - MagDepth)) / (3 * Math.PI * MagDepth);
  if (!(radicand > 0)) return null;
  return Math.sqrt(radicand);
}
