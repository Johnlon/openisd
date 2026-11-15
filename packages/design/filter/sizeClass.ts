/**
 * THE SIZE SEARCH VOCABULARY: the nominal driver sizes the library can be filtered by, and the
 * class a driver falls in when its maker prints no nominal size.
 *
 * A size class worked out from Sd is a SEARCH KEY and nothing else (John, 14 Nov 2026, issue 516:
 * "search only"). It is calculated, never stored in a driver record and never shown as a datasheet
 * value or as the maker's nominal size: every place that shows one says `derivedLabel`.
 *
 * Members are singletons: compare with `===`. `value` is the serialised form that crosses into the
 * reactive store and the index row; a member itself is never stored.
 */

/** Printed nominal diameter (frame size) over the effective piston diameter `Dd = 2*sqrt(Sd/pi)`.
 *  Measured on the 275 bundled drivers that state both: median 0.8333 (an 8 inch driver has Dd 16.5 cm,
 *  a 10 inch 21 cm, a 15 inch 33.5 cm). With it the class matches the printed one for 237 of 275 (86%);
 *  every miss is one class off, among sizes of 5 inch and below where makers use many half-sizes. */
const DD_OVER_NOMINAL = 0.8333;
const CM_PER_INCH = 2.54;

export class SizeClass {
  private constructor(readonly inches: number) {}

  static readonly In1   = new SizeClass(1);
  static readonly In1_5 = new SizeClass(1.5);
  static readonly In2   = new SizeClass(2);
  static readonly In2_5 = new SizeClass(2.5);
  static readonly In3   = new SizeClass(3);
  static readonly In3_5 = new SizeClass(3.5);
  static readonly In4   = new SizeClass(4);
  static readonly In5   = new SizeClass(5);
  static readonly In6_5 = new SizeClass(6.5);
  static readonly In8   = new SizeClass(8);
  static readonly In10  = new SizeClass(10);
  static readonly In12  = new SizeClass(12);
  static readonly In15  = new SizeClass(15);
  static readonly In18  = new SizeClass(18);
  static readonly In21  = new SizeClass(21);

  /** Every class, smallest first, found by reflection. LAST static in the class body — static fields
   *  initialise in source order, so a member declared below this line would be missed. */
  static readonly ALL: readonly SizeClass[] =
    Object.values(SizeClass).filter((v): v is SizeClass => v instanceof SizeClass).sort((a, b) => a.inches - b.inches);

  /** The serialised form, "6.5" or "8". */
  get value(): string { return String(this.inches); }
  /** The chip text, "6.5 in". */
  get label(): string { return `${this.value} in`; }

  /** The only string to member boundary; null for a value no class has. */
  static parse(raw: string): SizeClass | null {
    return SizeClass.ALL.find(c => c.value === raw) ?? null;
  }

  /** The class of a driver with this Sd (m2), or null when Sd is not a usable size. */
  static ofSd(Sd_m2: number | null): SizeClass | null {
    if (Sd_m2 === null || !(Sd_m2 > 0) || !Number.isFinite(Sd_m2)) return null;
    const Dd_cm = 2 * Math.sqrt(Sd_m2 / Math.PI) * 100;
    const nominalIn = Dd_cm / DD_OVER_NOMINAL / CM_PER_INCH;
    let best = SizeClass.ALL[0];
    for (const c of SizeClass.ALL) {
      if (Math.abs(Math.log(c.inches / nominalIn)) < Math.abs(Math.log(best.inches / nominalIn))) best = c;
    }
    return best;
  }

  /** How a derived class reads wherever it is shown. Null when the driver has none. */
  static derivedLabel(inches: number | null): string | null {
    return inches === null ? null : `≈ ${inches} in (from Sd)`;
  }

  /** Whether a driver with this derived class passes the chips: every driver when none is on. */
  static admits(selected: readonly string[], inches: number | null): boolean {
    return selected.length === 0 || (inches !== null && selected.includes(String(inches)));
  }

  /** The "Filters on" words for the chosen classes, smallest first, or null when none is chosen. */
  static filterLabel(selected: readonly string[]): string | null {
    const chosen = SizeClass.ALL.filter(c => selected.includes(c.value));
    return chosen.length === 0 ? null : `Size ≈ ${chosen.map(c => c.value).join(' or ')} in (from Sd)`;
  }

  toString(): string { return this.value; }
  toJSON(): string { return this.value; }
}
