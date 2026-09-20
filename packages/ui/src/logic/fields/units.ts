/**
 * Display-unit registry — the single place that knows how to render an SI quantity in an
 * alternate unit and convert typed input back. The store ALWAYS holds SI (m³, m, m², Hz, kg);
 * the UI shows `SI × factor` and, on input, divides by the same factor. Clicking a field's
 * unit label rotates the selected token (persisted per field in `presentationState.ui.unitTokens`), which
 * changes the factor + precision only — never the stored value. This is what makes the
 * clickable unit a real conversion instead of a decorative label.
 *
 * `factor` = display value per one SI unit. The first unit
 * in each group is the group's canonical default, but a FIELD may start on a different token
 * (e.g. Xmax defaults to mm, vent length to cm) — that base token is supplied at the call site,
 * and precision is derived relative to it so resolution is preserved across a switch.
 *
 * Conversion is affine — display = SI × factor + offset — so temperature (K/°C/°F), which needs
 * an offset, uses the same machinery as the purely-multiplicative units (offset defaults to 0).
 */

import {UNIT_GROUPS as DOMAIN_UNIT_GROUPS, type UnitDef, type UnitGroup} from '@openisd/design/fields';

export const UNIT_GROUPS: Record<UnitGroup, readonly UnitDef[]> = DOMAIN_UNIT_GROUPS;
export type {UnitDef, UnitGroup};

/** Never show more than this many decimals in any unit — the resolution-preserving derivation
 *  (displayPrecision) would otherwise pile up meaningless trailing zeros for a much-coarser unit
 *  (e.g. grams-to-kilograms). 5 dp is ample for every real field here. */
const MAX_DP = 5;

/** The group's canonical default unit (first entry). */
function defaultUnit(g: UnitGroup): UnitDef {
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
