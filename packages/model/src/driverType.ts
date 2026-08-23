// CANONICAL driver_type set for the OpenISD UI — a Java-style enum.
//
// A TS `enum` member can hold exactly ONE literal, so a wire string plus a display
// label plus a chip projection cannot fit in one. This class-based enum carries all
// three ON THE MEMBER: `DriverType.Subwoofer.display`, `.chips`, `.value`. No side
// lookup maps, and no caller ever writes a raw string.
//
// Members are singletons, so `dt === DriverType.Subwoofer` is identity comparison —
// compare against MEMBERS, never against the wire string. `dt === 'subwoofer'`
// silently survives a value change and cannot be found by rename.
//
// `.value` MUST stay identical to the `.value` set of the Python `DriverType`
// enum in the sibling winisd_tools repo
// (`scrapers/scrapers/lib/driver_type.py`). Parity is enforced by winisd_tools'
// `scrapers/tests/test_driver_type_enum_parity.py`, which reads this file and
// hard-fails if it is absent or if the value set differs. Editing either enum
// REQUIRES editing the other in the same change.
//
// The member NAMES are a TS convenience and are NOT part of the contract.

/**
 * The multi-label filter chips the driver browser renders — a closed set, so an
 * enum, carrying its own id, button label and tooltip. A driver matches several
 * at once; `Unclassified` is DERIVED (an empty chip collection), never emitted by
 * a DriverType.
 *
 * `.value` is the serialised form. It is what crosses into the reactive store and
 * the filter map, because Vue's reactive proxy would break `===` identity on a
 * member held in a `ref` — the same members-inside / value-at-the-boundary split
 * DriverType uses for the wire string.
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
  static readonly Unclassified = new Chip('unclassified', 'Unclassified', 'Drivers that did not match any type pattern');

  /** Every chip, in filter-bar render order. Must stay LAST — static fields initialise in source order. */
  static readonly ALL: readonly Chip[] =
    Object.values(Chip).filter((v): v is Chip => v instanceof Chip);

  toString(): string { return this.value; }
  toJSON(): string { return this.value; }
}

export class DriverType {
  private constructor(
    /** The on-disk wire string written into openisd.yml — the cross-repo contract. */
    readonly value: string,
    /** Human-facing label; mirrors `DriverType.display` in the Python enum. */
    readonly display: string,
    /**
     * The chips this type answers to — the many-to-many projection that makes
     * search flexible, so "bass" returns subs, woofers and mid-basses alike.
     * Empty ONLY for Unclassified, which means "no scraper verdict", not a chip.
     */
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
  // NOTE: `compression`, `horn`, `waveguide` are deliberately absent — compression
  // (horn-loaded) drivers are not box/T-S-modellable and bare horns/waveguides are
  // passive accessories. All are filtered out at discovery. See
  // drivers/DRIVER_TYPES.md "NOT drivers — accessories". Keep in sync with the
  // Python enum (parity test).
  static readonly Unclassified    = new DriverType('unclassified',     'Unclassified',     []);

  /**
   * Every member, discovered by reflection — declaring a member is the ONLY step
   * needed to be included, so no list can fall out of date. Must stay LAST in the
   * class body: static fields initialise in source order.
   */
  static readonly ALL: readonly DriverType[] =
    Object.values(DriverType).filter((v): v is DriverType => v instanceof DriverType);

  /**
   * The ONE string -> member boundary, mirroring Python's `DriverType(s)`.
   *
   * Accepts only canonical values. A value the enum does not declare is INVALID
   * data, not a second spelling to be tolerated here — returning null lets the
   * caller fall back to its name/T-S heuristics while the record stays reportable
   * as a data defect. Scrapers may write a compound value ("subwoofer, automotive");
   * only the leading token is a type, the rest are qualifiers.
   */
  static parse(raw: string | null | undefined): DriverType | null {
    const token = (raw || '').split(',')[0].trim().toLowerCase();
    return token ? (DriverType.ALL.find(d => d.value === token) ?? null) : null;
  }

  /** Serialise as the wire string, so string interpolation and JSON cannot leak the object. */
  toString(): string { return this.value; }
  toJSON(): string { return this.value; }
}
