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
  offset: number;
}

/** Groups of interchangeable display units for physical dimensions. `as const satisfies`
 *  (not `:`) keeps each `token` a literal, which is what lets `UnitToken<G>` below name the
 *  exact tokens one group admits, rather than every group's tokens pooled into one `string`. */
export const UNIT_GROUPS = Object.freeze({
  volume: [
    { token: 'L', label: 'L', factor: 1000, offset: 0 },
    { token: 'cuft', label: 'cu ft', factor: 35.3147, offset: 0 },
    { token: 'cuin', label: 'cu in', factor: 61023.7, offset: 0 },
    { token: 'cm3', label: 'cm³', factor: 1e6, offset: 0 },
  ],
  length: [
    { token: 'cm', label: 'cm', factor: 100, offset: 0 },
    { token: 'mm', label: 'mm', factor: 1000, offset: 0 },
    { token: 'in', label: 'in', factor: 39.3701, offset: 0 },
  ],
  area: [
    { token: 'cm2', label: 'cm²', factor: 1e4, offset: 0 },
    { token: 'm2', label: 'm²', factor: 1, offset: 0 },
    { token: 'in2', label: 'in²', factor: 1550.0031, offset: 0 },
  ],
  freq: [
    { token: 'Hz', label: 'Hz', factor: 1, offset: 0 },
    { token: 'kHz', label: 'kHz', factor: 1e-3, offset: 0 },
  ],
  mass: [
    { token: 'g', label: 'g', factor: 1000, offset: 0 },
    { token: 'kg', label: 'kg', factor: 1, offset: 0 },
    { token: 'oz', label: 'oz', factor: 35.27396, offset: 0 },
  ],
  temp: [
    { token: 'K', label: 'K', factor: 1, offset: 0 },
    { token: 'degC', label: '°C', factor: 1, offset: -273.15 },
    { token: 'degF', label: '°F', factor: 1.8, offset: -459.67 },
  ],
  pressure: [
    { token: 'Pa', label: 'Pa', factor: 1, offset: 0 },
    { token: 'kPa', label: 'kPa', factor: 1e-3, offset: 0 },
    { token: 'atm', label: 'atm', factor: 1 / 101325, offset: 0 },
  ],
  tempDiff: [
    { token: 'K', label: 'K', factor: 1, offset: 0 },
    { token: 'degF', label: '°F', factor: 1.8, offset: 0 },
  ],
  tempCoeff: [
    { token: 'perMilliK', label: '1000/K', factor: 1000, offset: 0 },
    { token: 'pctPerK', label: '%/K', factor: 100, offset: 0 },
    { token: 'perK', label: '1/K', factor: 1, offset: 0 },
  ],
  inductance: [
    { token: 'mH', label: 'mH', factor: 1000, offset: 0 },
    { token: 'H', label: 'H', factor: 1, offset: 0 },
    { token: 'uH', label: 'µH', factor: 1e6, offset: 0 },
  ],
  compliance: [
    { token: 'mmPerN', label: 'mm/N', factor: 1000, offset: 0 },
    { token: 'mPerN', label: 'm/N', factor: 1, offset: 0 },
    { token: 'umPerN', label: 'µm/N', factor: 1e6, offset: 0 },
  ],
  velocity: [
    { token: 'mps', label: 'm/s', factor: 1, offset: 0 },
    { token: 'ftps', label: 'ft/s', factor: 3.280839895, offset: 0 },
  ],
  density: [
    { token: 'kgPerM3', label: 'kg/m³', factor: 1, offset: 0 },
    { token: 'gPerCm3', label: 'g/cm³', factor: 1e-3, offset: 0 },
    { token: 'lbPerFt3', label: 'lb/cu ft', factor: 0.06242796, offset: 0 },
  ],
  resistance: [
    { token: 'nsPerM', label: 'Ns/m', factor: 1, offset: 0 },
    { token: 'kgPerS', label: 'kg/s', factor: 1, offset: 0 },
  ],
  percent: [
    { token: 'pct', label: '%', factor: 100, offset: 0 },
  ],
} as const) satisfies Record<UnitGroup, readonly UnitDef[]>;

/** The tokens group `G` admits — e.g. `UnitToken<'length'>` is `'cm' | 'mm' | 'in'`. Derived from
 *  `UNIT_GROUPS` itself so a token can never be spelled here and left out there, or vice versa. */
export type UnitToken<G extends UnitGroup = UnitGroup> = (typeof UNIT_GROUPS)[G][number]['token'];

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

/** The resolved unit representation for calculations in core. */
export type Unit =
  | { readonly kind: 'fixed'; readonly label: string }
  | {
      readonly kind: 'switchable';
      readonly group: UnitGroup;
      readonly token: string;
      readonly label: string;
      readonly factor: number;
      readonly relFactor: number;
      readonly offset: number;
    };

declare const UnitDimensionSymbol: unique symbol;

/** Immutable phantom-tagged value object bundling an SI value and uncertainty interval. */
export type Quantity<G extends UnitGroup = UnitGroup> = {
  readonly valueSI: number;
  readonly halfWidthSI?: number | null;
  readonly [UnitDimensionSymbol]?: G;
};

/** Type guard for presentationState to parse raw storage strings against group tokens. */
export function isTokenIn<G extends UnitGroup>(group: G, raw: unknown): raw is UnitToken<G> {
  if (typeof raw !== 'string') return false;
  return UNIT_GROUPS[group].some(u => u.token === raw);
}

/** Resolve a SwitchableUnit, FixedUnit, or UnitGroup and token into a single authoritative Unit sum type. */
export function unitFor(display: SwitchableUnit | FixedUnit, token?: string): Unit;
export function unitFor(group: UnitGroup, token: string, baseToken?: string): Unit;
export function unitFor(displayOrGroup: SwitchableUnit | FixedUnit | UnitGroup, token?: string, baseToken?: string): Unit {
  if (typeof displayOrGroup === 'string') {
    const groupUnits = UNIT_GROUPS[displayOrGroup];
    const base = baseToken ?? groupUnits[0].token;
    const selectedToken = (token && isTokenIn(displayOrGroup, token)) ? token : base;
    const baseDef = groupUnits.find(u => u.token === base) ?? groupUnits[0];
    const def = groupUnits.find(u => u.token === selectedToken) ?? groupUnits[0];
    return {
      kind: 'switchable',
      group: displayOrGroup,
      token: def.token,
      label: def.label,
      factor: def.factor,
      relFactor: def.factor / baseDef.factor,
      offset: def.offset,
    };
  }
  if (displayOrGroup.kind === 'fixed') {
    return { kind: 'fixed', label: displayOrGroup.symbol };
  }
  const groupUnits = UNIT_GROUPS[displayOrGroup.group];
  const selectedToken = (token && isTokenIn(displayOrGroup.group, token)) ? token : displayOrGroup.base;
  const baseDef = groupUnits.find(u => u.token === displayOrGroup.base) ?? groupUnits[0];
  const def = groupUnits.find(u => u.token === selectedToken) ?? groupUnits[0];
  return {
    kind: 'switchable',
    group: displayOrGroup.group,
    token: def.token,
    label: def.label,
    factor: def.factor,
    relFactor: def.factor / baseDef.factor,
    offset: def.offset,
  };
}

/** Convert value from SI space to display unit space. */
export function toDisplay(u: Unit, valueSI: number): number {
  if (u.kind === 'fixed') return valueSI;
  return valueSI * u.factor + u.offset;
}

/** Convert uncertainty interval / delta from SI space to display unit space. */
export function toDisplayDelta(u: Unit, deltaSI: number): number {
  if (u.kind === 'fixed') return deltaSI;
  return deltaSI * u.factor;
}

/** Convert value from display unit space back to SI space. */
export function toSI(u: Unit, valueDisplay: number): number {
  if (u.kind === 'fixed') return valueDisplay;
  return (valueDisplay - u.offset) / u.factor;
}

/** Calculate field decimal places in a resolved unit relative to base SI decimals. */
export function decimalsIn(u: Unit, baseDecimals: number): number {
  if (u.kind === 'fixed' || u.relFactor === 1) return baseDecimals;
  const shifted = baseDecimals - Math.round(Math.log10(u.relFactor));
  return Math.max(0, shifted);
}

/** Parse result discriminant. */
export type TypedEntry =
  | { readonly kind: 'quantity'; readonly valueSI: number; readonly halfWidthSI: number }
  | { readonly kind: 'text' };

const STRICT_NUMBER_RE = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;

/** Parse raw typed string input into a Quantity or Text discriminant. */
export function parseEntry(u: Unit, typed: string): TypedEntry {
  let cleaned = typed.trim().replace(/[\u0660-\u0669]/g, d => (d.charCodeAt(0) - 0x0660).toString());
  cleaned = cleaned.replace(/\u066B/g, '.').replace(',', '.');
  cleaned = cleaned.replace(/[^\d.eE+--]/g, '');

  if (!cleaned || !STRICT_NUMBER_RE.test(cleaned)) {
    return { kind: 'text' };
  }

  const num = Number(cleaned);
  if (!isFinite(num)) {
    return { kind: 'text' };
  }

  let mantissaDecimals = 0;
  let exponent = 0;
  const eIdx = cleaned.search(/[eE]/);
  let mantissaStr = cleaned;
  if (eIdx !== -1) {
    mantissaStr = cleaned.slice(0, eIdx);
    exponent = Number(cleaned.slice(eIdx + 1));
  }
  const dotIdx = mantissaStr.indexOf('.');
  if (dotIdx !== -1) {
    mantissaDecimals = mantissaStr.length - dotIdx - 1;
  }

  const halfWidthDisplay = 0.5 * Math.pow(10, exponent - mantissaDecimals);
  const valueSI = toSI(u, num);
  const halfWidthSI = u.kind === 'switchable' ? halfWidthDisplay / u.factor : halfWidthDisplay;

  return { kind: 'quantity', valueSI, halfWidthSI };
}

