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

/** The decimals a converted unit shows are NOT capped. A field's resolution is an absolute
 *  quantity — Mms is stated to a hundredth of a gram — so showing it in kilograms takes 5
 *  decimals, and a ceiling of 4 would silently show a coarser number than the field holds
 *  (John, 2026-09-25: "the display resolution must track the absolute precision we want to
 *  support… not a fixed display precision"). The digits a coarser unit gains are real, not
 *  padding: they are the same value written where each digit is worth less. */

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
 *  units preserves the field's ABSOLUTE resolution: a ×10 coarser unit shows one more decimal,
 *  a ×10 finer unit one fewer. Precision therefore stays single-sourced from uiFields (baseDp)
 *  — not duplicated per unit, and not a fixed number of decimals per unit either. Floored at 0,
 *  which is the only real limit: a unit so coarse that the field's resolution is bigger than one
 *  of it needs no decimals at all. */
export function displayPrecision(baseDp: number, g: UnitGroup, baseToken: string, token: string): number {
  if (token === baseToken) return baseDp;
  const f = unitDef(g, token).factor;
  const f0 = unitDef(g, baseToken).factor;
  return Math.max(0, baseDp - Math.round(Math.log10(f / f0)));
}

/**
 * Half the last decimal place a TYPED string was written to, expressed in SI — what the entry
 * STATES, as distinct from what the field could support.
 *
 * Off the string, because the number cannot answer it: `parseFloat('30.00')` is 30, and 30 g
 * written to two decimals states ±0.005 g where a bare "30" states ±0.5 g. Only the factor
 * scales a width, so an affine unit contributes its factor and never its offset.
 *
 * `undefined` for an exponent form, where "the last decimal place" is not what the characters
 * mean — the caller then has nothing better to say than the stored number itself.
 */
export function statedPrecision(typed: string, g?: UnitGroup, token?: string): number | undefined {
  const t = typed.trim();
  if (t === '' || t.includes('e') || t.includes('E')) return undefined;
  const dot = t.indexOf('.');
  const decimals = dot === -1 ? 0 : t.length - dot - 1;
  const halfInDisplay = 0.5 * Math.pow(10, -decimals);
  if (g === undefined || token === undefined) return halfInDisplay;
  return halfInDisplay / unitDef(g, token).factor;
}
