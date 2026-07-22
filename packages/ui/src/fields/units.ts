/**
 * Display-unit registry — the single place that knows how to render an SI quantity in an
 * alternate unit and convert typed input back. The store ALWAYS holds SI (m³, m, m², Hz, kg);
 * a skin shows `SI × factor` and, on input, divides by the same factor. Clicking a field's
 * unit label rotates the selected token (persisted per field in `state.ui.unitTokens`), which
 * changes the factor + precision only — never the stored value. This is what makes the
 * clickable unit a real conversion instead of a decorative label.
 *
 * `factor` = display value per one SI unit (exactly the old `NumInput :scale`). The first unit
 * in each group is the group's canonical default, but a FIELD may start on a different token
 * (e.g. Xmax defaults to mm, vent length to cm) — that base token is supplied at the call site,
 * and precision is derived relative to it so resolution is preserved across a switch.
 *
 * Conversion is affine — display = SI × factor + offset — so temperature (K/°C/°F), which needs
 * an offset, uses the same machinery as the purely-multiplicative units (offset defaults to 0).
 */

export type UnitGroup =
  | 'volume'
  | 'length'
  | 'area'
  | 'freq'
  | 'mass'
  | 'temp'
  | 'pressure'
  | 'tempDiff'
  | 'tempCoeff';

/** Never show more than this many decimals in any unit — the resolution-preserving derivation
 *  (displayPrecision) would otherwise pile up meaningless trailing zeros for a much-coarser unit
 *  (e.g. grams-to-kilograms). 4 dp is ample for every real field here. */
const MAX_DP = 4;

export interface UnitDef {
  /** Stable machine token stored in state.ui.unitTokens. */
  token: string;
  /** Symbol shown next to the field. */
  label: string;
  /** Display value per one SI unit (the multiplicative part of display = SI × factor + offset). */
  factor: number;
  /** Additive part of the conversion (0 for every unit except absolute temperature). */
  offset?: number;
}

/** Groups of interchangeable display units. First entry = canonical default for the group. */
export const UNIT_GROUPS: Record<UnitGroup, readonly UnitDef[]> = {
  volume: [
    { token: 'L', label: 'L', factor: 1000 },
    { token: 'cuft', label: 'cu ft', factor: 35.3147 },
    { token: 'cuin', label: 'cu in', factor: 61023.7 },
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
  // SI unit = kelvin. Absolute temperature — the only group that uses `offset`.
  temp: [
    { token: 'K', label: 'K', factor: 1, offset: 0 },
    { token: 'degC', label: '°C', factor: 1, offset: -273.15 },
    { token: 'degF', label: '°F', factor: 1.8, offset: -459.67 },
  ],
  // SI unit = pascal.
  pressure: [
    { token: 'Pa', label: 'Pa', factor: 1 },
    { token: 'kPa', label: 'kPa', factor: 1e-3 },
    { token: 'atm', label: 'atm', factor: 1 / 101325 },
  ],
  // A temperature DIFFERENCE (e.g. a coil temp rise), not an absolute temperature — so there is
  // no offset, and °C is omitted because a difference in °C is numerically identical to K. Only
  // Fahrenheit degrees differ (×1.8): a 40 K rise is a 72 °F rise. SI unit = kelvin.
  tempDiff: [
    { token: 'K', label: 'K', factor: 1 },
    { token: 'degF', label: '°F', factor: 1.8 },
  ],
  // Temperature coefficient of resistance. SI unit = 1/K. WinISD shows it ×1000 ("1000/K"); the
  // datasheet-friendly alternates are %/K and the plain 1/K. (copper ≈ 0.0039/K = 0.39 %/K = 3.9
  // per "1000/K".)
  tempCoeff: [
    { token: 'perMilliK', label: '1000/K', factor: 1000 },
    { token: 'pctPerK', label: '%/K', factor: 100 },
    { token: 'perK', label: '1/K', factor: 1 },
  ],
};

/** The unit list for a group. */
export function groupUnits(g: UnitGroup): readonly UnitDef[] {
  return UNIT_GROUPS[g];
}

/** The group's canonical default unit (first entry). */
export function defaultUnit(g: UnitGroup): UnitDef {
  return UNIT_GROUPS[g][0];
}

/** Resolve a token within a group; an unknown token falls back to the group default so a
 *  stale/garbage persisted token can never throw or NaN a conversion. */
export function unitDef(g: UnitGroup, token: string): UnitDef {
  return UNIT_GROUPS[g].find((u) => u.token === token) ?? defaultUnit(g);
}

/** SI → display (value × factor + offset). */
export function toDisplay(si: number, g: UnitGroup, token: string): number {
  const u = unitDef(g, token);
  return si * u.factor + (u.offset ?? 0);
}

/** display → SI ((value − offset) ÷ factor) — the inverse of toDisplay; keeps the model in SI. */
export function fromDisplay(disp: number, g: UnitGroup, token: string): number {
  const u = unitDef(g, token);
  return (disp - (u.offset ?? 0)) / u.factor;
}

/** The next token in the group, wrapping — drives the click-to-rotate affordance. */
export function nextToken(g: UnitGroup, token: string): string {
  const units = UNIT_GROUPS[g];
  const i = units.findIndex((u) => u.token === token);
  return units[(i + 1) % units.length].token;
}

/** Decimal places for a target unit, derived from the field's base-unit precision so switching
 *  units preserves resolution: a ×10 coarser unit shows one fewer decimal, a ÷10 finer unit one
 *  more. Precision therefore stays single-sourced from fieldRegistry (baseDp) — not duplicated
 *  per unit. Clamped to [0, MAX_DP]: an uncapped finer unit (e.g. grams' 5 dp shown in kilograms)
 *  would otherwise pile up meaningless trailing zeros (0.00000000 kg). */
export function displayPrecision(baseDp: number, g: UnitGroup, baseToken: string, token: string): number {
  const f = unitDef(g, token).factor;
  const f0 = unitDef(g, baseToken).factor;
  return Math.min(MAX_DP, Math.max(0, baseDp - Math.round(Math.log10(f / f0))));
}
