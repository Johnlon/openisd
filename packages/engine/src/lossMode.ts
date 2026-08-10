/**
 * Sealed-box resonance under three loss models — the value the Box tab reports as `Fsc`.
 *
 * Spec: openspec/specs/core-engine/spec.md "Sealed-Box Resonance Loss Models".
 *
 * - Lossless          Fsc = Fs·√(1+Vas/Vb),  Qtc = Qts·√(1+Vas/Vb)      (textbook, no losses)
 * - ConventionalLossy Fsc = Lossless (unchanged); box losses fold into Q only:
 *                     1/Qtc_total = 1/Qtc + 1/QL + 1/QA                   (Small/Thiele)
 * - WinisdLossy       Fsc = pole frequency of WinISD's lossy 3rd-order model — the leak adds a
 *                     third pole; WinISD builds the characteristic cubic and reports |pole|/2π.
 *                     Bit-exact to WinISD's own `[Box] Fr` readout. Reverse-engineered from
 *                     winisd.exe (prod_462480) and confirmed by live capture; full derivation in
 *                     the research repo's SEALED_FSC_MODEL.md.
 *
 * The WinISD pole is INVARIANT to ρ and c (ρc² cancels in the cubic), so this module needs no
 * air constants — it uses acoustic compliances with ρc²=1 (Cas=Vas, Ccab=Vb), which gives the
 * identical pole frequency.
 */

/** The closed set of sealed-box loss models — a Java-style enum carrying its wire value + label. */
export class LossMode {
  private constructor(readonly value: string, readonly label: string) {}

  static readonly Lossless = new LossMode('lossless', 'Lossless');
  static readonly ConventionalLossy = new LossMode('conventional-lossy', 'Conventional Lossy');
  static readonly WinisdLossy = new LossMode('winisd-lossy', 'WinISD Lossy');

  /** Declaration order is the selector order. Keep WinisdLossy present — it is the default. */
  static readonly ALL: readonly LossMode[] = [
    LossMode.Lossless,
    LossMode.ConventionalLossy,
    LossMode.WinisdLossy,
  ];

  static readonly Default = LossMode.WinisdLossy;

  /** Parse a wire value to a member, or the default when it is absent/unknown. */
  static parse(value: string | null | undefined): LossMode {
    return LossMode.ALL.find(m => m.value === value) ?? LossMode.Default;
  }

  toString(): string {
    return this.value;
  }
}

export interface SealedParams {
  Fs: number;
  Vas: number;
  Qts: number;
  Vb: number;
  /** Box leakage Q (Qlr). Non-finite or very large ⇒ lossless. */
  Ql: number;
  /** Box absorption Q (Qar). Non-finite or very large ⇒ no absorption. */
  Qa: number;
}

const LOSSLESS_LIMIT = 1e6;

/** Lossless multiplier √(1+Vas/Vb), shared by every mode's lossless baseline. */
function boxRatio(vas: number, vb: number): number {
  return Math.sqrt(1 + vas / vb);
}

/**
 * Real roots + the complex-conjugate pair of the monic cubic  s³ + b·s² + c·s + d,
 * via Cardano's depressed-cubic form. Returns `{re, im}` triples.
 */
function cubicRoots(b: number, c: number, d: number): { re: number; im: number }[] {
  const p = c - (b * b) / 3;
  const q = (2 * b ** 3) / 27 - (b * c) / 3 + d;
  const disc = (q / 2) ** 2 + (p / 3) ** 3;
  const shift = -b / 3;
  const cbrt = (x: number) => Math.sign(x) * Math.abs(x) ** (1 / 3);
  if (disc >= 0) {
    const s = Math.sqrt(disc);
    const u = cbrt(-q / 2 + s);
    const v = cbrt(-q / 2 - s);
    const t0 = u + v;
    const re = -t0 / 2;
    const im = ((u - v) * Math.sqrt(3)) / 2;
    return [
      { re: t0 + shift, im: 0 },
      { re: re + shift, im },
      { re: re + shift, im: -im },
    ];
  }
  // three distinct real roots (trigonometric form)
  const r = Math.sqrt(-(p ** 3) / 27);
  const phi = Math.acos(Math.max(-1, Math.min(1, -q / (2 * r))));
  const m = 2 * Math.sqrt(-p / 3);
  return [0, 1, 2].map(k => ({ re: m * Math.cos((phi + 2 * Math.PI * k) / 3) + shift, im: 0 }));
}

/**
 * WinISD's lossy sealed-box readout: Fsc = pole frequency of the lossy 3rd-order model, and Qtc
 * from the same dominant pole pair. Bit-exact to WinISD's own readout; converges to the lossless
 * value as Ql→∞. See SEALED_FSC_MODEL.md §3.
 */
export function sealedResonanceWinisd(p: SealedParams): { Fsc: number; Qtc: number } {
  const fc0 = p.Fs * boxRatio(p.Vas, p.Vb);
  if (!(p.Ql > 0) || p.Ql >= LOSSLESS_LIMIT) {
    return { Fsc: fc0, Qtc: p.Qts * boxRatio(p.Vas, p.Vb) }; // no leak ⇒ lossless
  }
  const qa = !(p.Qa > 0) || p.Qa >= LOSSLESS_LIMIT ? 1e12 : p.Qa;

  // ρc² cancels in the pole, so use ρc²=1: Cas=Vas, Ccab=Vb.
  const Cas = p.Vas;
  const Ccab = p.Vb;
  const Cat = 1 / (1 / Cas + 1 / Ccab);
  const Mas = 1 / ((2 * Math.PI * p.Fs) ** 2 * Cas);
  const wsc = 1 / Math.sqrt(Cat * Mas); // = 2π·Fs·√(1+Vas/Vb)
  const leak = p.Ql / (wsc * Ccab);
  const qmL = 1 / (wsc * Cat * qa);
  const reSum = 1 / (2 * Math.PI * p.Fs * p.Qts * Cas);

  const denom = Ccab * Cas * Mas * (leak + qmL);
  const a1 = 1 / denom;
  const a2 = (reSum * Cas + leak * Cas + leak * Ccab + qmL * Ccab) / denom;
  const a3 = (Ccab * Cas * reSum * (leak + qmL) + Ccab * Cas * qmL * leak + Mas * Cas) / denom;

  const roots = cubicRoots(a3, a2, a1);
  const pole = roots.find(r => Math.abs(r.im) > 1e-9);
  if (pole) {
    // Pole pair -σ±jω:  Fsc = |pole|/2π,  Qtc = ωn/(2σ) = |pole|/(2|Re|).
    const wn = Math.hypot(pole.re, pole.im);
    return { Fsc: wn / (2 * Math.PI), Qtc: wn / (2 * Math.abs(pole.re)) };
  }
  // overdamped (very low Ql): the two dominant real roots stand in for the pair.
  const mags = roots.map(r => Math.abs(r.re)).sort((x, y) => y - x);
  const [r0, r1] = mags;
  return { Fsc: Math.sqrt(r0 * r1) / (2 * Math.PI), Qtc: Math.sqrt(r0 * r1) / (r0 + r1) };
}

/** WinISD's sealed-box Fsc alone (the pole frequency). See {@link sealedResonanceWinisd}. */
export function sealedFscWinisd(p: SealedParams): number {
  return sealedResonanceWinisd(p).Fsc;
}

/**
 * System resonance Fsc and Q Qtc for the selected sealed-box loss model.
 * The Box tab readout is computed from this.
 */
export function sealedResonance(mode: LossMode, p: SealedParams): { Fsc: number; Qtc: number } {
  const ratio = boxRatio(p.Vas, p.Vb);
  const fcLossless = p.Fs * ratio;
  const qtcLossless = p.Qts * ratio;

  if (mode === LossMode.Lossless) {
    return { Fsc: fcLossless, Qtc: qtcLossless };
  }
  if (mode === LossMode.ConventionalLossy) {
    // fc fixed; box losses combine into system Q (Small/Thiele).
    let invQ = 1 / qtcLossless;
    if (p.Ql > 0 && p.Ql < LOSSLESS_LIMIT) invQ += 1 / p.Ql;
    if (p.Qa > 0 && p.Qa < LOSSLESS_LIMIT) invQ += 1 / p.Qa;
    return { Fsc: fcLossless, Qtc: 1 / invQ };
  }
  return sealedResonanceWinisd(p); // WinisdLossy
}
