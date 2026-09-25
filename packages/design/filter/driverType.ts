/**
 * THE SEARCH VOCABULARY: what kind of driver a record says it is, and the filter buttons the
 * browser offers. Both are closed sets, so both are Java-style enums rather than bare strings —
 * a member carries its wire value, its display text and its projection, so no caller holds a
 * side lookup table and no caller writes a raw string.
 *
 * Members are singletons: compare with `===` against a MEMBER. Comparing against the wire string
 * survives a value change silently and cannot be found by a rename.
 */

/**
 * A filter button in the driver browser. A driver matches several at once, which is what makes
 * search forgiving — asking for bass returns subs, woofers and mid-basses alike.
 *
 * `value` is the serialised form, and the only thing that crosses a boundary: into the reactive
 * store, into a saved filter set. Vue's reactive proxy wraps an object held in a `ref` and breaks
 * `===`, so a member is never stored — its value is.
 */
export class Chip {
  private constructor(
    readonly value: string,
    readonly label: string,
    readonly title: string,
  ) {}

  static readonly Bass         = new Chip('bass',         'Bass',         'Handles bass/low frequencies — sub, woofer, mid-bass, full-range');
  static readonly Sub          = new Chip('sub',          'Sub',          'Subwoofer — dedicated very-low-frequency driver');
  static readonly Woofer       = new Chip('woofer',       'Woofer',       'Woofer — low to mid-bass cone driver');
  static readonly Mid          = new Chip('mid',          'Mid',          'Midrange / mid-bass — between woofer and tweeter');
  static readonly Tweet        = new Chip('tweet',        'Tweet',        'Tweeter — high-frequency driver (dome, ribbon, planar, AMT)');
  static readonly FullRange    = new Chip('fullrange',    'Full-range',   'Full-range — single driver covering bass through treble (not BMR)');
  static readonly Pr           = new Chip('pr',           'PR',           'Passive radiator — no voice coil, passive acoustic resonator');
  static readonly Coax         = new Chip('coax',         'Coaxial',      'Coaxial — woofer and tweeter sharing the same axis');
  /** Derived: a driver no type claimed. Never carried by a `DriverType`. */
  static readonly Unclassified = new Chip('unclassified', 'Unclassified', 'Drivers that did not match any type pattern');

  /** Every chip, in filter-bar render order. LAST in the class body — static fields initialise
   *  in source order, so a member declared below this line would be missed. */
  static readonly ALL: readonly Chip[] =
    Object.values(Chip).filter((v): v is Chip => v instanceof Chip);

  toString(): string { return this.value; }
  toJSON(): string { return this.value; }
}

/**
 * The driver kind a record states in `driver_type`.
 *
 * `value` is the on-disk wire string and a CROSS-REPO CONTRACT: it must stay identical to the
 * Python `DriverType` in winisd_tools (`scrapers/scrapers/lib/driver_type.py`), which that repo's
 * `scrapers/tests/test_driver_type_enum_parity.py` enforces by reading this file. Editing either
 * enum requires editing the other in the same change. The member NAMES are a TypeScript
 * convenience and are not part of the contract.
 */
export class DriverType {
  private constructor(
    /** The on-disk wire string — the cross-repo contract. */
    readonly value: string,
    /** Human-facing label; mirrors `display` in the Python enum. */
    readonly display: string,
    /** The chips this type answers to. Empty only for `Unclassified`, which means the scraper
     *  reached no verdict — not a chip of its own. */
    readonly chips: readonly Chip[],
  ) {}

  static readonly Woofer          = new DriverType('woofer',           'Woofer',           [Chip.Woofer, Chip.Bass]);
  static readonly Subwoofer       = new DriverType('subwoofer',        'Subwoofer',        [Chip.Sub, Chip.Woofer, Chip.Bass]);
  static readonly Midrange        = new DriverType('midrange',         'Midrange',         [Chip.Mid, Chip.Woofer]);
  static readonly MidBass         = new DriverType('mid-bass',         'Mid-bass',         [Chip.Woofer, Chip.Mid, Chip.Bass]);
  static readonly MidWoofer       = new DriverType('mid-woofer',       'Mid-woofer',       [Chip.Woofer, Chip.Mid, Chip.Bass]);
  static readonly FullRange       = new DriverType('full-range',       'Full-range',       [Chip.Woofer, Chip.Mid, Chip.Tweet, Chip.Bass, Chip.FullRange]);
  static readonly Bmr             = new DriverType('bmr',              'BMR',              [Chip.Mid, Chip.Tweet]);
  static readonly Coaxial         = new DriverType('coaxial',          'Coaxial',          [Chip.Coax, Chip.Woofer, Chip.Bass, Chip.Mid, Chip.Tweet]);
  static readonly Tweeter         = new DriverType('tweeter',          'Tweeter',          [Chip.Tweet]);
  static readonly Amt             = new DriverType('amt',              'AMT',              [Chip.Tweet]);
  static readonly PassiveRadiator = new DriverType('passive-radiator', 'Passive Radiator', [Chip.Pr]);
  // `compression`, `horn` and `waveguide` are deliberately absent: a compression driver is not
  // box/T-S-modellable and a bare horn or waveguide is a passive accessory. All are filtered out
  // at discovery — drivers/DRIVER_TYPES.md "NOT drivers — accessories".
  static readonly Unclassified    = new DriverType('unclassified',     'Unclassified',     []);

  /** Every member, found by reflection, so declaring one is the only step needed. LAST in the
   *  class body — static fields initialise in source order. */
  static readonly ALL: readonly DriverType[] =
    Object.values(DriverType).filter((v): v is DriverType => v instanceof DriverType);

  /**
   * The one string → member boundary, mirroring Python's `DriverType(s)`.
   *
   * Canonical values only. A value the enum does not declare is invalid data, not a second
   * spelling to tolerate: answering null lets the caller fall back to its name and T/S heuristics
   * while the record stays reportable as a defect. A scraper may write qualifiers after the type
   * ("subwoofer, automotive"); only the leading token is the type.
   */
  static parse(raw: string | null | undefined): DriverType | null {
    const token = (raw || '').split(',')[0].trim().toLowerCase();
    return token ? (DriverType.ALL.find((d) => d.value === token) ?? null) : null;
  }

  toString(): string { return this.value; }
  toJSON(): string { return this.value; }
}
