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
 * Temperature and pressure are intentionally absent: they need an offset (K/°C/°F) not just a
 * factor, and live on non-NumInput Advanced-tab inputs — tracked as a follow-up.
 */

export type UnitGroup = 'volume' | 'length' | 'area' | 'freq' | 'mass';

export interface UnitDef {
  /** Stable machine token stored in state.ui.unitTokens. */
  token: string;
  /** Symbol shown next to the field. */
  label: string;
  /** Display value per one SI unit (display = SI × factor). */
  factor: number;
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

/** SI → display (value × factor). */
export function toDisplay(si: number, g: UnitGroup, token: string): number {
  return si * unitDef(g, token).factor;
}

/** display → SI (value ÷ factor) — the inverse of toDisplay; keeps the model in SI. */
export function fromDisplay(disp: number, g: UnitGroup, token: string): number {
  return disp / unitDef(g, token).factor;
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
 *  per unit. Never negative. */
export function displayPrecision(baseDp: number, g: UnitGroup, baseToken: string, token: string): number {
  const f = unitDef(g, token).factor;
  const f0 = unitDef(g, baseToken).factor;
  return Math.max(0, baseDp - Math.round(Math.log10(f / f0)));
}
