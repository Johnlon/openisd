/** Physical dimensions / unit groups for domain fields exported by @openisd/design. */
export type UnitGroup =
  | 'volume'
  | 'length'
  | 'area'
  | 'freq'
  | 'mass'
  | 'temp'
  | 'pressure'
  | 'tempDiff'
  | 'tempCoeff'
  | 'inductance'
  | 'compliance'
  | 'velocity'
  | 'density'
  | 'resistance'
  | 'percent';

export interface UnitDef {
  /** Machine token stored in presentationState. */
  token: string;
  /** Display unit symbol. */
  label: string;
  /** Multiplicative conversion factor relative to SI. */
  factor: number;
  /** Additive conversion offset relative to SI (used for absolute temperature). */
  offset?: number;
}

/** Groups of interchangeable display units for physical dimensions. `as const satisfies`
 *  (not `:`) keeps each `token` a literal, which is what lets `UnitToken<G>` below name the
 *  exact tokens one group admits, rather than every group's tokens pooled into one `string`. */
export const UNIT_GROUPS = Object.freeze({
  volume: [
    { token: 'L', label: 'L', factor: 1000 },
    { token: 'cuft', label: 'cu ft', factor: 35.3147 },
    { token: 'cuin', label: 'cu in', factor: 61023.7 },
    { token: 'cm3', label: 'cm³', factor: 1e6 },
  ],
  length: [
    { token: 'cm', label: 'cm', factor: 100 },
    { token: 'mm', label: 'mm', factor: 1000 },
    { token: 'in', label: 'in', factor: 39.3701 },
  ],
  area: [
    { token: 'cm2', label: 'cm²', factor: 1e4 },
    { token: 'm2', label: 'm²', factor: 1 },
    { token: 'in2', label: 'in²', factor: 1550.0031 },
  ],
  freq: [
    { token: 'Hz', label: 'Hz', factor: 1 },
    { token: 'kHz', label: 'kHz', factor: 1e-3 },
  ],
  mass: [
    { token: 'g', label: 'g', factor: 1000 },
    { token: 'kg', label: 'kg', factor: 1 },
    { token: 'oz', label: 'oz', factor: 35.27396 },
  ],
  temp: [
    { token: 'K', label: 'K', factor: 1, offset: 0 },
    { token: 'degC', label: '°C', factor: 1, offset: -273.15 },
    { token: 'degF', label: '°F', factor: 1.8, offset: -459.67 },
  ],
  pressure: [
    { token: 'Pa', label: 'Pa', factor: 1 },
    { token: 'kPa', label: 'kPa', factor: 1e-3 },
    { token: 'atm', label: 'atm', factor: 1 / 101325 },
  ],
  tempDiff: [
    { token: 'K', label: 'K', factor: 1 },
    { token: 'degF', label: '°F', factor: 1.8 },
  ],
  tempCoeff: [
    { token: 'perMilliK', label: '1000/K', factor: 1000 },
    { token: 'pctPerK', label: '%/K', factor: 100 },
    { token: 'perK', label: '1/K', factor: 1 },
  ],
  inductance: [
    { token: 'mH', label: 'mH', factor: 1000 },
    { token: 'H', label: 'H', factor: 1 },
    { token: 'uH', label: 'µH', factor: 1e6 },
  ],
  compliance: [
    { token: 'mmPerN', label: 'mm/N', factor: 1000 },
    { token: 'mPerN', label: 'm/N', factor: 1 },
    { token: 'umPerN', label: 'µm/N', factor: 1e6 },
  ],
  velocity: [
    { token: 'mps', label: 'm/s', factor: 1 },
    { token: 'ftps', label: 'ft/s', factor: 3.280839895 },
  ],
  density: [
    { token: 'kgPerM3', label: 'kg/m³', factor: 1 },
    { token: 'gPerCm3', label: 'g/cm³', factor: 1e-3 },
    { token: 'lbPerFt3', label: 'lb/cu ft', factor: 0.06242796 },
  ],
  resistance: [
    { token: 'nsPerM', label: 'Ns/m', factor: 1 },
    { token: 'kgPerS', label: 'kg/s', factor: 1 },
  ],
  percent: [
    { token: 'pct', label: '%', factor: 100 },
  ],
} as const) satisfies Record<UnitGroup, readonly UnitDef[]>;

/** The tokens group `G` admits — e.g. `UnitToken<'length'>` is `'cm' | 'mm' | 'in'`. Derived from
 *  `UNIT_GROUPS` itself so a token can never be spelled here and left out there, or vice versa. */
export type UnitToken<G extends UnitGroup> = (typeof UNIT_GROUPS)[G][number]['token'];

/** A field whose display unit rotates among one group's tokens (`NumInput`/`UnitToggle`'s
 *  clickable label). `base` is the token shown until the user rotates it, typed so it must be
 *  one of `group`'s own tokens — `{group: 'volume', base: 'mm'}` does not compile. */
interface SwitchableUnitFor<G extends UnitGroup> {
  readonly kind: 'switchable';
  readonly group: G;
  readonly base: UnitToken<G>;
}
/** Distributes `SwitchableUnitFor` over every `UnitGroup` member, so the union is a discriminated
 *  one — narrowing on `.group` (or the presence of a field's `.display.group` at all) narrows
 *  `.base` to that group's own tokens, not the pooled set of every group's. */
export type SwitchableUnit = { [G in UnitGroup]: SwitchableUnitFor<G> }[UnitGroup];

/** A field shown in one fixed symbol, never switched — `''` for dimensionless. */
export interface FixedUnit {
  readonly kind: 'fixed';
  readonly symbol: string;
}
