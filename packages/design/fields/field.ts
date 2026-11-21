/**
 * The field registry: every field OpenISD has, enumerated once, each carrying what it IS — its
 * name, its label, what it measures, and whatever else its KIND makes meaningful. Static, and
 * separate from any domain object holding a VALUE for one: `OpenISDDriver.specs` holds a value
 * per field, this holds the fields themselves (John, 2026-09-28).
 *
 * Java-style enums, the same shape as `LossMode` (`engine/lossMode.ts`): private constructors,
 * one static member per field, `ALL` built by reflection so a member cannot be left out of it.
 * Members are SCREAMING_UPPER_CASE, as every `static readonly` in this codebase is.
 *
 * One class PER KIND rather than one class with a `kind` tag and a bag of optional members: a
 * band and a precision are meaningful for a number and meaningless for a checkbox, and an
 * option list is the reverse. The class IS the kind, so `NumberField.BOX_VB_L.limits` needs no
 * null check and `ToggleField.X.limits` does not compile.
 *
 * A caller names the member and the compiler checks it. `NumberField.named()` is the one
 * exception, for the one case where a field name genuinely arrives from outside: a scraper
 * reading names its field by the record key before anything has resolved it.
 *
 * Bounds are in SI/model space, never display space, matching how `NumInput.vue` validates: a
 * field labelled °C or mm still states its band in K or m.
 *
 * Two bands, not one. `limits` is what the input accepts; `plausible` is what a real driver's
 * value looks like, and a value between them is enterable but carries a data-quality warning.
 * `plausible` absorbed `PHYSICAL_RANGE` (`engine/physicalRange.ts`), which stated the same fact
 * for 22 driver quantities in its own table.
 *
 * `floor` is the third fact, which neither band answers: whether zero and negatives are
 * admissible at all. `Qts` has a `limits` floor of 0 and a `floor` of 'positive'. It absorbed
 * `FIELD_FLOOR` (`domain/driver/openIsdDriverSpec.ts`), which stated the same fact for 48 of
 * the driver's spec fields in its own table.
 *
 * `display` is the fourth fact: one member, not a `unit` string beside an optional `unitGroup`
 * that a call site's own `group=`/`base=` props could contradict (BUG_20260928, "NumInput's
 * group/base props are a fourth table"). `FixedUnit` is one symbol, never switched; `SwitchableUnit`
 * names a `dimensions.ts` `UnitGroup` and a base token typed to that group's own tokens, so
 * `{group: 'volume', base: 'mm'}` does not compile. A switchable field's on-screen label always
 * comes from `UNIT_GROUPS`, never a second string stated here.
 */
import type {FixedUnit, SwitchableUnit, Quantity, TypedEntry} from './dimensions.js';
import {
  decimalsIn, isTokenIn, parseEntry as parseEntryDim, toDisplay as toDisplayDim, toDisplayDelta as toDisplayDeltaDim,
  toSI as toSIDim, UNIT_GROUPS, unitFor,
} from './dimensions.js';
import {knownDecimals} from './precision.js';
import {formatFixed, formatTrimmedTo} from './format.js';
import type {FieldLimits} from './filterLimits.js';
import {
  FILTER_BW_LIMITS, FILTER_FC_LIMITS, FILTER_GAIN_LIMITS, FILTER_ORDER_LIMITS, FILTER_Q_LIMITS,
  FILTER_T_LIMITS, PEAK_HIGHPASS_GAIN_LIMITS,
} from './filterLimits.js';
import {
  DEFAULT_NEW_PROJECT_QA, DEFAULT_NEW_PROJECT_QICL, DEFAULT_NEW_PROJECT_QP, DEFAULT_NEW_PROJECT_VENTED_QL,
} from './defaults.js';
import type {SelectorOption} from './options.js';
import type {SpinRule} from './spinnerStep.js';
import {
  BOX_TYPE_OPTIONS, END_CORRECTION_OPTIONS, FILTER_TYPE_OPTIONS,
  DRIVER_WIRING_OPTIONS, SEALED_ALIGNMENT_OPTIONS, VC_CONNECTION_OPTIONS, VENT_SHAPE_OPTIONS,
} from './options.js';

/** What a field is, for the one place that shows it as text — the diagnostics list. Branching
 *  on it is what the subclasses exist to make unnecessary. */
export type FieldKind = 'number' | 'enum' | 'text' | 'toggle' | 'date';

/**
 * The floor a number field's value must clear — what neither band answers, since `limits` is
 * what the input accepts and `plausible` is what a real driver looks like.
 *
 * - `'positive'` — zero, negative or non-finite is not physical.
 * - `'non-negative'` — negative or non-finite is not physical, but zero is a real, stated fact.
 * - `'none'` — no floor. A decibel figure is a level relative to a reference, not a magnitude,
 *   so it can be zero or negative; so can a field whose floor nobody has stated.
 */
export type ValueFloor = 'positive' | 'non-negative' | 'none';

/**
 * What a value loaded from a file (an OpenISD project, a WinISD `.wpr`, a stored project) is
 * repaired to on opening when the field cannot hold it — the one load repair pass
 * (`domain/project/loadRepair.ts`) reads it. Typing such a value is refused with a note instead.
 * John, 18 Nov 2026: "a repair is ok but it has to be automatic" (QO953.c26); the repair is told in
 * the opening message only, never as a mark on the box (QO953.c30, c31).
 *
 * - `breaks` — which of the field's own rules the loaded value breaks: below `limits.min`, not
 *   past `floor`, or outside `limits` (`band`: below `min` or above `max`).
 * - `to` — the value it is set to, or `'empty'`: the box is emptied, as if the file never gave it.
 *   John, 18 Nov 2026: "a 0 is just the same as clearing the value in a sense" (QO953.c28): a field
 *   the app can calculate (air density, a port's tuning) is then calculated, an air condition takes
 *   the app's own value (Options).
 * - `described` — how the opening message names that value ("the 10 mV minimum").
 */
export interface LoadRepair {
  readonly breaks: 'min' | 'floor' | 'band';
  readonly to: number | 'empty';
  readonly described: string;
}

/**
 * How a spinner press moves a number field (`spinnerStep.ts`).
 *
 * - `proportional` — steps that scale with the value (`spinnerStep.ts`), down to one unit of the
 *   decimals shown.
 * - `proportionalFloored` — the same, never finer than `10^finestExp` in the field's fixed unit: a
 *   signed level that passes through 0 (gain in dB steps 0 → ±0.1).
 * - `integer` — a count or an order: every press is `step` (1; 2 for an even-only order).
 */
export type FieldSpin =
  | {readonly kind: 'proportional'}
  | {readonly kind: 'proportionalFloored'; readonly finestExp: number}
  | {readonly kind: 'integer'; readonly step: number};

const PROPORTIONAL_SPIN: FieldSpin = Object.freeze({kind: 'proportional'});
/** A count or an order that moves `step` a press. */
export function integerSpin(step: number): FieldSpin { return Object.freeze({kind: 'integer', step}); }
const INTEGER_SPIN: FieldSpin = integerSpin(1);

interface FieldSpec {
  readonly value: string;
  readonly label: string;
  readonly description: string;
}

/** What every field has, whatever its kind. The type a caller annotates with. */
export abstract class Field {
  /** The field's name — the only thing that crosses a boundary (a stored key, a test's pin). */
  readonly value: string;
  /** What the field is called on screen. */
  readonly label: string;
  /**
   * What the field is, for the on-hover tooltip. One name line, then one or more short fact
   * lines (`\n`-separated) — never a single dense run-on sentence (2026-09-26, John: avoid long
   * single-line tooltips; multi-line, brief but clear). A fact line states one thing: what it
   * measures, its formula, or a consequence — not restated padding around the label.
   */
  readonly description: string;

  protected constructor(spec: FieldSpec) {
    this.value = spec.value;
    this.label = spec.label;
    this.description = spec.description;
  }

  abstract readonly kind: FieldKind;
}

export enum NumberEditor {
  Input = 'number',
  CountSelect = 'count-select',
}

interface NumberFieldSpec extends FieldSpec {
  readonly fullLabel?: string;
  readonly editor?: NumberEditor;
  readonly display: SwitchableUnit | FixedUnit;
  readonly limits: FieldLimits;
  readonly precision: number;
  readonly formula?: string;
  readonly minimumReason?: string;
  readonly plausible?: FieldLimits;
  readonly floor?: ValueFloor;
  readonly loadRepair?: LoadRepair;
  readonly spin?: FieldSpin;
  readonly allowedEmpty?: boolean;
}

/** A field holding a quantity: it has a band, a precision, and a display unit. */
export class NumberField extends Field {
  /** The fewest significant figures a number box shows (John, 10 Nov 2026, board option B). */
  static readonly MIN_SIGNIFICANT = 4;
  readonly kind = 'number';
  /** The expanded name for displays with room for it. */
  readonly fullLabel: string;
  readonly editor: NumberEditor;
  /** How the field is shown: one fixed symbol, or a `UnitGroup` the user may rotate through. */
  readonly display: SwitchableUnit | FixedUnit;
  /** The band an entered value must fall in, in SI/model units. */
  readonly limits: FieldLimits;
  /** Fixed decimal places the field's base unit is meaningful to. */
  readonly precision: number;
  /** Closed form derivation, for a quantity the engine calculates. */
  readonly formula: string | undefined;
  /** Why a typed value below `limits.min` is refused, added to the box's note, for a floor whose
   *  reason is not plain from the field itself (the Peak HP Gpk stops at 0 dB). */
  readonly minimumReason: string | undefined;
  /**
   * The band a REAL driver's value falls in — narrower than `limits`, which is only what the
   * input will accept. A value inside `limits` but outside this is enterable and gets a
   * data-quality warning; `Engine.isPhysicallyPlausible` reads it to throw out a failed scrape.
   * Where nothing narrower is known it IS `limits`, so there is no absent case to handle.
   */
  readonly plausible: FieldLimits;
  /** Whether zero and negatives are admissible at all. `'none'` where nobody has stated one. */
  readonly floor: ValueFloor;
  /** What a loaded value this field cannot hold is repaired to on opening; null where nothing is. */
  readonly loadRepair: LoadRepair | null;
  /** How a spinner press moves the value. */
  readonly spin: FieldSpin;
  /** Whether this field is allowed to stay empty when cleared (e.g. filter fields). */
  readonly allowedEmpty: boolean;

  private constructor(spec: NumberFieldSpec) {
    super(spec);
    this.fullLabel = spec.fullLabel ?? spec.label;
    this.editor = spec.editor ?? NumberEditor.Input;
    this.display = Object.freeze(spec.display);
    this.limits = Object.freeze(spec.limits);
    this.precision = spec.precision;
    this.formula = spec.formula;
    this.minimumReason = spec.minimumReason;
    this.plausible = Object.freeze(spec.plausible ?? spec.limits);
    this.floor = spec.floor ?? 'none';
    this.loadRepair = spec.loadRepair === undefined ? null : Object.freeze(spec.loadRepair);
    this.spin = spec.spin ?? PROPORTIONAL_SPIN;
    this.allowedEmpty = spec.allowedEmpty ?? false;
  }

  /** Whether this field is empty while it is allowed to stay empty. */
  emptyAndAllowed(value: number | null): boolean {
    return this.allowedEmpty && value === null;
  }

  /** Authoritative unit resolution for this field. */
  unitFor(token?: string) {
    return unitFor(this.display, token);
  }

  /** Display unit label symbol for this field. */
  unitLabel(token?: string): string {
    return this.unitFor(token).label;
  }

  /** Convert valueSI to display unit space for this field. */
  toDisplay(valueSI: number, token?: string): number {
    return toDisplayDim(this.unitFor(token), valueSI);
  }

  /** Convert valueDisp to SI space for this field. */
  toSI(valueDisp: number, token?: string): number {
    return toSIDim(this.unitFor(token), valueDisp);
  }

  /** Format valueSI or Quantity into display string for this field using unit conversion & precision rules.
   *  `maxSignificant` (the phone's narrow boxes) trims decimals beyond that many significant digits (never below two, or the field's own precision when that is smaller),
   *  and shows a value below 1 whose fixed form would not fit the phone box in exponent form ("2.857e-5"). */
  format(valueSIOrQuantity: number | Quantity, halfWidthSI?: number | null, token?: string, maxSignificant?: number): string {
    let val: number;
    let hw: number | null | undefined;
    if (typeof valueSIOrQuantity === 'object' && valueSIOrQuantity !== null) {
      val = valueSIOrQuantity.valueSI;
      hw = valueSIOrQuantity.halfWidthSI;
    } else {
      val = valueSIOrQuantity;
      hw = halfWidthSI;
    }

    if (!isFinite(val)) return '—';

    const u = this.unitFor(token);
    const valDisp = toDisplayDim(u, val);
    const minDp = decimalsIn(u, this.precision);

    let decimals = minDp;
    if (hw != null && hw > 0 && isFinite(hw)) {
      const hwDisp = toDisplayDeltaDim(u, hw);
      const kd = knownDecimals(hwDisp, valDisp);
      decimals = Math.max(minDp, kd);
    }
    if (maxSignificant !== undefined) {
      const leading = valDisp === 0 || !isFinite(valDisp) ? 1 : Math.floor(Math.log10(Math.abs(valDisp))) + 1;
      decimals = Math.min(decimals, Math.max(Math.min(minDp, 2), maxSignificant - leading));
    }

    // At least MIN_SIGNIFICANT figures, so a small value is never shown as 0.37 for 0.3687 (John, 10 Nov 2026, board option B).
    const keep = Math.min(Math.max(0, Math.min(20, decimals)), 2); // zeros the field's own precision shows
    if (valDisp !== 0) decimals = Math.max(decimals, NumberField.MIN_SIGNIFICANT - (Math.floor(Math.log10(Math.abs(valDisp))) + 1));
    decimals = Math.max(0, Math.min(20, decimals));
    const sanitizedVal = valDisp === 0 ? 0 : valDisp;
    const fixed = formatTrimmedTo(sanitizedVal, decimals, Math.min(keep, decimals));
    // A phone box holds `maxSignificant + 3` characters ("100000.00"). A value so small that its leading
    // zeros and four figures run past that (the 0.00002857 W that drives the 10 mV minimum) is shown in
    // exponent form, still four figures ("2.857e-5"): a value is never cut (rule 11, John, 10 Nov 2026).
    if (maxSignificant !== undefined && Math.abs(valDisp) < 1 && valDisp !== 0 && fixed.length > maxSignificant + 3) {
      return valDisp.toExponential(NumberField.MIN_SIGNIFICANT - 1);
    }
    return fixed;
  }

  /** Parse raw typed string input into a Quantity or Text discriminant for this field. */
  parseEntry(typed: string, token?: string): TypedEntry {
    return parseEntryDim(this.unitFor(token), typed);
  }

  /** The spinner rule for this field shown in unit `token`. */
  spinRule(token?: string, spin: FieldSpin = this.spin): SpinRule {
    switch (spin.kind) {
      case 'integer': return {kind: 'integer', step: spin.step};
      case 'proportional': return {kind: 'proportional', finestExp: 0 - decimalsIn(this.unitFor(token), this.precision)};
      case 'proportionalFloored':
        return {kind: 'proportional', finestExp: Math.max(spin.finestExp, 0 - decimalsIn(this.unitFor(token), this.precision))};
    }
  }

  /** Rotate unit to next token in group for switchable fields, or undefined for fixed fields. */
  nextToken(token?: string): string | undefined {
    if (this.display.kind === 'fixed') return undefined;
    const groupUnits = UNIT_GROUPS[this.display.group];
    const currentToken = (token && groupUnits.some(u => u.token === token))
      ? token
      : this.display.base;
    const idx = groupUnits.findIndex(u => u.token === currentToken);
    const nextIdx = (idx + 1) % groupUnits.length;
    return groupUnits[nextIdx].token;
  }

  /** The unit the user has rotated this field to, read from the rotation store (keyed by the
   *  field itself); the base unit until rotated, or when the stored token is not one of this
   *  field's group. `undefined` for a fixed unit. */
  unitTokenFor(rotation: Readonly<Record<string, string>>): string | undefined {
    if (this.display.kind === 'fixed') return undefined;
    const stored = rotation[this.value];
    return isTokenIn(this.display.group, stored) ? stored : this.display.base;
  }

  /** Whether `token` is one of the units this field rotates through; never for a fixed unit. */
  rotatesTo(token: unknown): token is string {
    return this.display.kind === 'switchable' && isTokenIn(this.display.group, token);
  }

  /** `rotation` with this field moved to its next unit; `rotation` itself for a field with
   *  nowhere to rotate. */
  withNextUnit(rotation: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
    const next = this.nextToken(this.unitTokenFor(rotation));
    return next === undefined ? rotation : {...rotation, [this.value]: next};
  }

  /**
   * Every whole number in the band, as picker options — for a count the user chooses from a
   * list rather than types (how many vents, how many radiators). Derived from the band so the
   * list cannot disagree with what the field accepts.
   */
  countOptions(): readonly SelectorOption<number>[] {
    const out: SelectorOption<number>[] = [];
    for (let n = this.limits.min; n <= this.limits.max; n++) out.push(Object.freeze({value: n, label: String(n)}));
    return Object.freeze(out);
  }

  /** `v` at this field's `precision`: the figure a reader is shown. */
  rounded(v: number): number {
    const k = 10 ** this.precision;
    return Math.round(v * k) / k;
  }

  /** `valueSI` as text at this field's `precision`, in the base unit. */
  fixed(valueSI: number): string {
    return formatFixed(valueSI, this.precision);
  }

  // ── Plot window ───────────────────────────────────────────────────────────────────────────
  /** The frequency axis' ends: 1 Hz to 40 kHz. The start and end boxes accept inside it and a chart
   *  drag is held to it, so the three can never disagree about how far the axis goes. */
  static readonly PLOT_FREQ_AXIS_HZ: Readonly<{min: number; max: number}> = Object.freeze({min: 1, max: 40000});
  static readonly PLOT_FMIN_HZ = new NumberField({
    value: "plot_fmin_hz",
    label: "Frequency range start",
    display: {kind: 'fixed', symbol: 'Hz'},
    limits: NumberField.PLOT_FREQ_AXIS_HZ,
    precision: 1,
    description: "Plot Start Frequency\nThe lowest frequency every chart draws and the sweep computes.",
  });
  /** The chart frequency range a new install and every reset show: 10 Hz to 1000 Hz (John, 8 Nov 2026: the
   *  top end was 20000; loudspeaker design needs the bottom three decades). The one place this pair lives. */
  static readonly PLOT_RANGE_DEFAULT_HZ: Readonly<{min: number; max: number}> = Object.freeze({min: 10, max: 1000});
  static readonly PLOT_FMAX_HZ = new NumberField({
    value: "plot_fmax_hz",
    label: "Frequency range end",
    display: {kind: 'fixed', symbol: 'Hz'},
    limits: NumberField.PLOT_FREQ_AXIS_HZ,
    precision: 1,
    description: "Plot End Frequency\nThe highest frequency every chart draws and the sweep computes.",
  });

  // ── Plot window: one chart's Y axis start or end, per unit a chart axis is drawn in ──────────
  static readonly PLOT_Y_DB = new NumberField({
    value: "plot_y_db",
    label: "Axis limit",
    display: {kind: 'fixed', symbol: 'dB'},
    limits: {min: -10000, max: 100000},
    precision: 2,
    description: "Chart Axis Limit\nThe start or end of a chart's vertical axis, in decibels.",
  });
  static readonly PLOT_Y_DEG = new NumberField({
    value: "plot_y_deg",
    label: "Axis limit",
    display: {kind: 'fixed', symbol: 'deg'},
    limits: {min: -10000, max: 100000},
    precision: 2,
    description: "Chart Axis Limit\nThe start or end of a chart's vertical axis, in degrees.",
  });
  static readonly PLOT_Y_MM = new NumberField({
    value: "plot_y_mm",
    label: "Axis limit",
    display: {kind: 'fixed', symbol: 'mm'},
    limits: {min: -10000, max: 100000},
    precision: 2,
    description: "Chart Axis Limit\nThe start or end of a chart's vertical axis, in millimetres.",
  });
  static readonly PLOT_Y_OHM = new NumberField({
    value: "plot_y_ohm",
    label: "Axis limit",
    display: {kind: 'fixed', symbol: 'Ω'},
    limits: {min: -10000, max: 100000},
    precision: 2,
    description: "Chart Axis Limit\nThe start or end of a chart's vertical axis, in ohms.",
  });
  static readonly PLOT_Y_MS = new NumberField({
    value: "plot_y_ms",
    label: "Axis limit",
    display: {kind: 'fixed', symbol: 'ms'},
    limits: {min: -10000, max: 100000},
    precision: 2,
    description: "Chart Axis Limit\nThe start or end of a chart's vertical axis, in milliseconds.",
  });
  static readonly PLOT_Y_W = new NumberField({
    value: "plot_y_w",
    label: "Axis limit",
    display: {kind: 'fixed', symbol: 'W'},
    limits: {min: -10000, max: 100000},
    precision: 2,
    description: "Chart Axis Limit\nThe start or end of a chart's vertical axis, in watts.",
  });
  static readonly PLOT_Y_MPS = new NumberField({
    value: "plot_y_mps",
    label: "Axis limit",
    display: {kind: 'fixed', symbol: 'm/s'},
    limits: {min: -10000, max: 100000},
    precision: 2,
    description: "Chart Axis Limit\nThe start or end of a chart's vertical axis, in metres per second.",
  });

  // ── Box ───────────────────────────────────────────────────────────────────────────────────
  static readonly BOX_VB_L = new NumberField({
    value: "box_Vb_l",
    label: "Volume",
    display: {kind: 'switchable', group: 'volume', base: 'L'},
    // 10 m3 = 10,000 L: far beyond any speaker box, and it fits the phone Box tab's box in every unit (QO946.c187, lead).
    limits: {min: 0.0001, max: 10},
    precision: 2,
    description: "Net Enclosure Volume\nThe air volume inside the box. This air acts as a spring the cone pushes against.",
  });
  static readonly BOX_VF_L = new NumberField({
    value: "box_Vf_l",
    label: "Volume",
    display: {kind: 'switchable', group: 'volume', base: 'L'},
    limits: {min: 0.0001, max: 10},
    precision: 2,
    description: "Front Chamber Volume\nNet air volume of the front, vented chamber in a bandpass enclosure.",
  });
  static readonly BOX_FB_HZ = new NumberField({
    value: "box_Fb_hz",
    label: "Tuning freq (Fb)",
    display: {kind: 'switchable', group: 'freq', base: 'Hz'},
    limits: {min: 0, max: 1000},
    floor: "positive",
    loadRepair: {breaks: 'floor', to: 'empty', described: 'the tuning worked out from the port'},
    precision: 2,
    description: "Box Tuning Frequency (Fb)\nHelmholtz resonance of the vented enclosure, set by port dimensions and box volume. Enter the tuning frequency to calculate port length, or enter port length to calculate the tuning frequency. An unbuildable port is flagged.",
  });

  static readonly BOX_FFC_HZ = new NumberField({
    value: "box_Ffc_hz",
    label: "Tuning freq (Ffc)",
    display: {kind: 'switchable', group: 'freq', base: 'Hz'},
    limits: {min: 0, max: 1000},
    floor: "positive",
    loadRepair: {breaks: 'floor', to: 'empty', described: 'the tuning worked out from the port'},
    precision: 2,
    description: "Front Chamber Tuning Frequency (Ffc)\nHelmholtz resonance of the front, vented chamber of a 4th-order bandpass, 6th-order bandpass or ABC box, set by port dimensions and chamber volume. Enter the tuning frequency to calculate port length, or enter port length to calculate the tuning frequency. An unbuildable port is flagged.",
  });

  // ── Vent ──────────────────────────────────────────────────────────────────────────────────
  static readonly VENT_COUNT = new NumberField({
    editor: NumberEditor.CountSelect,
    value: "vent_Count",
    label: "Number of vents",
    display: {kind: 'fixed', symbol: ''},
    limits: {min: 1, max: 4},
    spin: INTEGER_SPIN,
    precision: 0,
    description: "Number of Vents\nHow many identical ports share the chamber.\nMore ports need a longer port for the same tuning, since the air-mass term sees the combined opening; end correction stays that of one port.",
  });
  static readonly VENT_D_CM = new NumberField({
    value: "vent_D_cm",
    label: "Vent diameter",
    display: {kind: 'switchable', group: 'length', base: 'cm'},
    limits: {min: 0.001, max: 2},
    precision: 2,
    description: "Port Diameter\nInternal diameter of a round port.\nLarger diameters reduce turbulence (chuffing) but need a longer tube for the same tuning.",
  });
  static readonly VENT_W_CM = new NumberField({
    value: "vent_W_cm",
    label: "Slot width",
    display: {kind: 'switchable', group: 'length', base: 'cm'},
    limits: {min: 0.001, max: 2},
    precision: 2,
    description: "Slot Port Width\nInternal width of a rectangular slotted port.",
  });
  static readonly VENT_H_CM = new NumberField({
    value: "vent_H_cm",
    label: "Slot height",
    display: {kind: 'switchable', group: 'length', base: 'cm'},
    limits: {min: 0.001, max: 2},
    precision: 2,
    description: "Slot Port Height\nInternal height of a rectangular slotted port.",
  });
  static readonly VENT_L_CM = new NumberField({
    value: "vent_L_cm",
    label: "Vent length",
    display: {kind: 'switchable', group: 'length', base: 'cm'},
    limits: {min: 0.001, max: 10},
    floor: "positive",
    loadRepair: {breaks: 'floor', to: 'empty', described: 'the length worked out from the tuning'},
    precision: 2,
    description: "Vent Length\nPhysical length of the port tube.\nLonger ports lower the tuning frequency for a fixed box volume.",
  });
  static readonly VENT_CROSSAREA_M2 = new NumberField({
    value: "vent_CrossArea_m2",
    label: "Cross area",
    // cm² to match the vent's own dimensions (VENT_D_CM/VENT_L_CM etc. are all cm) — John,
    // 2026-10-01: "on the vented view the default unit must be cm and cm2".
    display: {kind: 'switchable', group: 'area', base: 'cm2'},
    limits: {min: 0, max: 10},
    floor: "positive",
    precision: 2,
    formula: "π·(ventD/2)²",
    description: "Vent Cross-Sectional Area\nTotal internal cross-sectional area of the port.",
  });
  static readonly VENT_1STPORTRESONANCE_HZ = new NumberField({
    value: "vent_1stPortResonance_hz",
    label: "1st port resonance",
    display: {kind: 'switchable', group: 'freq', base: 'Hz'},
    limits: {min: 0, max: 20000},
    precision: 2,
    formula: "c / (2·ventL)",
    description: "First Vent Pipe Resonance\nThe lowest organ-pipe standing-wave resonance inside the port (f = c / 2L).\nCauses output peaks and noise at or above the passband, limiting usable port bandwidth.",
  });
  static readonly VENT_PORTVELOCITYLIMIT_M_PER_S = new NumberField({
    value: "vent_portVelocityLimit_m_per_s",
    label: "Port velocity limit",
    display: {kind: 'fixed', symbol: 'm/s'},
    limits: {min: 1, max: 340},
    precision: 1,
    description: "Port Air Velocity Limit\nAbove this air speed, a port starts making audible noise (\"chuffing\") and turbulence. Shown as a line on the port velocity charts so you can see when a design exceeds it. Default 17 m/s — a flared port can handle more, a plain straight pipe less.",
  });

  // ── Passive radiator ──────────────────────────────────────────────────────────────────────
  static readonly PR_SD_CM2 = new NumberField({
    value: "pr_Sd_cm2",
    label: "Sd",
    display: {kind: 'switchable', group: 'area', base: 'cm2'},
    limits: {min: 0.0001, max: 10},
    precision: 2,
    description: "Passive Radiator Area\nEffective radiating piston area of the passive radiator.\nWith Vas, Fs and Qms held, Sd changes the PR excursion and air velocity charts only: the radiator's mass, compliance and loss are derived from Vas, Fs and Qms.",
  });
  static readonly PR_XMAX_MM = new NumberField({
    value: "pr_Xmax_mm",
    label: "Xmax",
    display: {kind: 'switchable', group: 'length', base: 'mm'},
    limits: {min: 0, max: 0.5},
    floor: "positive",
    precision: 2,
    description: "Passive Radiator Excursion Limit\nMaximum peak linear displacement of the passive radiator diaphragm.\nDraws the PR excursion limit line; it does not change the response curves.",
  });
  static readonly PR_NUM = new NumberField({
    editor: NumberEditor.CountSelect,
    value: "pr_Num",
    label: "Num. of PRs",
    display: {kind: 'fixed', symbol: ''},
    limits: {min: 1, max: 4},
    loadRepair: {breaks: 'min', to: 1, described: '1, the fewest'},
    spin: INTEGER_SPIN,
    precision: 0,
    description: "Passive Radiator Count\nNumber of identical passive radiators in the enclosure.",
  });
  static readonly PR_MADD_G = new NumberField({
    value: "pr_Madd_g",
    label: "Added mass to cone",
    display: {kind: 'switchable', group: 'mass', base: 'g'},
    limits: {min: 0, max: 5000},
    loadRepair: {breaks: 'min', to: 0, described: '0 g, no added mass'},
    precision: 3,
    description: "PR Added Mass\nBallast mass attached to the passive radiator cone to lower its tuning frequency.",
  });
  static readonly PR_FP_HZ = new NumberField({
    value: "pr_Fp_hz",
    label: "Target tuning freq (Fp)",
    display: {kind: 'switchable', group: 'freq', base: 'Hz'},
    limits: {min: 1, max: 1000},
    precision: 2,
    description: "Passive Radiator System Tuning (Fp)\nHelmholtz tuning frequency the passive radiator and enclosure volume achieve together.",
  });
  static readonly PR_VAS_L = new NumberField({
    value: "pr_Vas_l",
    label: "Vas",
    display: {kind: 'switchable', group: 'volume', base: 'L'},
    limits: {min: 1e-05, max: 100},
    precision: 2,
    formula: "Vas = Cms·Sd²·ρ·c²·1000",
    description: "PR Equivalent Compliance Volume\nVolume of air whose compliance equals the passive radiator's own suspension.\nWith Sd, sets the radiator's compliance (Cms).",
  });
  static readonly PR_FS_HZ = new NumberField({
    value: "pr_Fs_hz",
    label: "Fpr",
    display: {kind: 'switchable', group: 'freq', base: 'Hz'},
    limits: {min: 1, max: 1000},
    precision: 2,
    formula: "Fpr = 1/(2π·√(Mmd·Cms))",
    description: "Unloaded PR Resonance (Fpr)\nThe passive radiator's free-air resonance, with no added mass and no box coupling.\nWith Vas and Sd, sets the radiator's moving mass (Mms).",
  });
  static readonly PR_QMS = new NumberField({
    value: "pr_Qms",
    label: "Qms",
    display: {kind: 'fixed', symbol: ''},
    limits: {min: 0.1, max: 100},
    precision: 3,
    formula: "Qms = √(Mmd/Cms)/Rms",
    description: "PR Mechanical Quality Factor\nQuality factor for mechanical suspension friction losses in the passive radiator.\nWith the derived Mms and Cms, sets the radiator's mechanical resistance (Rms).",
  });
  static readonly PR_FSMASS_HZ = new NumberField({
    value: "pr_FsMass_hz",
    label: "Fpr (with added mass)",
    display: {kind: 'switchable', group: 'freq', base: 'Hz'},
    limits: {min: 0, max: 1000},
    precision: 2,
    formula: "Fpr = 1/(2π·√((Mmd+Madd)·Cms))",
    description: "Mass-Loaded PR Resonance\nThe passive radiator's free-air resonance including its added mass (Madd).",
  });

  // ── Signal ────────────────────────────────────────────────────────────────────────────────
  static readonly SIGNAL_PIN_W = new NumberField({
    value: "signal_Pin_W",
    label: "System input power",
    display: {kind: 'fixed', symbol: 'W'},
    limits: {min: 0.01, max: 100000},
    minimumReason: "The power must drive the amplifier at 10 mV or more.",
    precision: 2,
    description: "System Input Power\nTotal electrical power supplied to the system (P = V² / Re).",
  });
  static readonly SIGNAL_DRIVEV_V = new NumberField({
    value: "signal_DriveV_V",
    label: "Driver input voltage (each)",
    display: {kind: 'fixed', symbol: 'V'},
    limits: {min: 0.01, max: 1000},
    minimumReason: "The drive level must be at least 10 mV.",
    loadRepair: {breaks: 'min', to: 0.01, described: 'the 10 mV minimum'},
    precision: 2,
    formula: "driveV = √(Pin · Re)",
    description: "Amplifier Output Voltage\nThe voltage at your amplifier's output. With one driver, or several wired in parallel, each driver gets all of it (V = √(P · Re) for one driver); wired in series each gets its share, the voltage divided by the number of drivers. Power and voltage set each other.",
  });
  static readonly SIGNAL_RS_OHM = new NumberField({
    value: "signal_Rs_ohm",
    label: "Series resistance",
    display: {kind: 'fixed', symbol: 'Ω'},
    limits: {min: 0, max: 1000},
    loadRepair: {breaks: 'min', to: 0, described: '0 Ω, the least'},
    precision: 3,
    description: "Series Resistance\nCombined amplifier output impedance, wiring and crossover resistance, in series with the driver.",
  });
  static readonly SIGNAL_DISTANCE_M = new NumberField({
    value: "signal_Distance_m",
    label: "Distance",
    display: {kind: 'fixed', symbol: 'm'},
    limits: {min: 0.1, max: 100},
    floor: "positive",
    precision: 3,
    description: "Listening Distance\nOn-axis distance from the loudspeaker to the listener, used for SPL calculations.",
  });
  static readonly SIGNAL_ANGLE_RAD = new NumberField({
    value: "signal_Angle_rad",
    label: "Off-Axis Angle",
    display: {kind: 'fixed', symbol: 'rad'},
    limits: {min: 0, max: 3.1416},
    precision: 4,
    description: "Off-Axis Angle\nAngular offset from the main acoustic axis, in radians.",
  });
  static readonly SIGNAL_GENHZ_HZ = new NumberField({
    value: "signal_GenHz_hz",
    label: "Signal generator frequency",
    display: {kind: 'fixed', symbol: 'Hz'},
    limits: {min: 1, max: 20000},
    precision: 2,
    description: "Test Tone Frequency\nThe frequency the single-tone signal generator evaluates.",
  });

  // ── Losses ────────────────────────────────────────────────────────────────────────────────
  static readonly LOSS_QL = new NumberField({
    value: "loss_Ql",
    label: "Leakage Ql",
    display: {kind: 'fixed', symbol: ''},
    limits: {min: 0.1, max: 1000},
    floor: "positive",
    loadRepair: {breaks: 'floor', to: DEFAULT_NEW_PROJECT_VENTED_QL, described: `${DEFAULT_NEW_PROJECT_VENTED_QL}, WinISD's default`},
    precision: 2,
    description: "Enclosure Leakage Loss Q\nAcoustic energy lost through cabinet seams and gaskets.",
  });
  static readonly LOSS_QA = new NumberField({
    value: "loss_Qa",
    label: "Absorption Qa",
    display: {kind: 'fixed', symbol: ''},
    limits: {min: 0.1, max: 1000},
    floor: "positive",
    loadRepair: {breaks: 'floor', to: DEFAULT_NEW_PROJECT_QA, described: `${DEFAULT_NEW_PROJECT_QA}, WinISD's default`},
    precision: 2,
    description: "Enclosure Damping Loss Q\nAcoustic energy absorbed by internal damping fill.",
  });
  static readonly LOSS_QP = new NumberField({
    value: "loss_Qp",
    label: "Port Qp",
    display: {kind: 'fixed', symbol: ''},
    limits: {min: 0.1, max: 1000},
    floor: "positive",
    loadRepair: {breaks: 'floor', to: DEFAULT_NEW_PROJECT_QP, described: `${DEFAULT_NEW_PROJECT_QP}, WinISD's default`},
    precision: 2,
    description: "Port Friction Loss Q\nAir friction and viscous boundary losses inside the vent.",
  });
  static readonly LOSS_QICL = new NumberField({
    value: "loss_Qicl",
    label: "Interchamber Qicl",
    display: {kind: 'fixed', symbol: ''},
    limits: {min: 0.1, max: 1000},
    floor: "positive",
    loadRepair: {breaks: 'floor', to: DEFAULT_NEW_PROJECT_QICL, described: `${DEFAULT_NEW_PROJECT_QICL}, WinISD's default`},
    precision: 2,
    description: "Interchamber Loss Q\nAcoustic energy lost through the wall between the two chambers; one value for both.",
  });

  // ── Advanced ──────────────────────────────────────────────────────────────────────────────
  static readonly ADV_TEMP_K = new NumberField({
    value: "adv_Temp_K",
    label: "Temperature",
    display: {kind: 'switchable', group: 'temp', base: 'K'},
    // The air model's own domain: above 0 K, up to a temperature far past any room (John, 1 Nov
    // 2026: no -100..+100 degC typing band). The solver's temperature search covers this band.
    limits: {min: 0, max: 1000},
    // WinISD's own band (its Options dialog, 174 to 373 K inclusive, winisd_research/runs/env-limits-20261118):
    // outside it a typed or loaded temperature is kept with a warning (QO953.c14).
    plausible: {min: 174, max: 373},
    floor: "positive",
    loadRepair: {breaks: 'floor', to: 'empty', described: "the app's temperature (Options)"},
    precision: 2,
    description: "Ambient Temperature\nUsed to calculate the speed of sound and the density of air.",
  });
  static readonly ADV_HUMIDITY_PCT = new NumberField({
    value: "adv_Humidity_pct",
    label: "Relative humidity",
    display: {kind: 'fixed', symbol: '%'},
    limits: {min: 0, max: 100},
    loadRepair: {breaks: 'band', to: 'empty', described: "the app's humidity (Options)"},
    precision: 2,
    description: "Relative Humidity\nAffects the speed of sound and the density of the air.",
  });
  static readonly ADV_PRESSURE_KPA = new NumberField({
    value: "adv_Pressure_kPa",
    label: "Air pressure",
    display: {kind: 'switchable', group: 'pressure', base: 'Pa'},
    limits: {min: 1000, max: 200000},
    // Air on the ground anywhere on Earth: the summit of Everest (about 33 kPa) to below the Dead Sea's
    // shore (about 107 kPa). Outside it a pressure is kept with a warning (QO953.c14).
    plausible: {min: 30000, max: 110000},
    floor: "positive",
    loadRepair: {breaks: 'floor', to: 'empty', described: "the app's pressure (Options)"},
    precision: 0,
    description: "Air Pressure\nAtmospheric pressure — affects air density and acoustic impedance.",
  });
  static readonly ADV_SOUNDVELOCITY_M_PER_S = new NumberField({
    value: "adv_SoundVelocity_m_per_s",
    label: "Sound velocity",
    display: {kind: 'fixed', symbol: 'm/s'},
    limits: {min: 0, max: 1000},
    // The air model's sound velocity over the temperature and pressure bands above at any humidity
    // (264 m/s at 174 K, 491 m/s at 373 K, 100 % and 30 kPa), rounded outward. Outside it a sound
    // velocity is kept with a warning (QO953.c14).
    plausible: {min: 260, max: 500},
    floor: "positive",
    loadRepair: {breaks: 'floor', to: 'empty', described: 'the value worked out from the temperature, humidity and pressure'},
    precision: 2,
    formula: "c = √(γ·p/ρ), γ = 1.4",
    description: "Speed of Sound\nHow fast an acoustic wave travels through air, at the stated conditions.",
  });
  static readonly ADV_AIRDENSITY_KG_PER_M3 = new NumberField({
    value: "adv_AirDensity_kg_per_m3",
    label: "Air density",
    display: {kind: 'fixed', symbol: 'kg/m³'},
    limits: {min: 0, max: 10},
    // The air model's density over the same bands (0.17 to 2.2 kg/m³), rounded outward. Outside it a
    // density is kept with a warning (QO953.c14).
    plausible: {min: 0.15, max: 2.25},
    floor: "positive",
    loadRepair: {breaks: 'floor', to: 'empty', described: 'the value worked out from the temperature, humidity and pressure'},
    precision: 5,
    formula: "ρ = p·Ma/(R·T)·[1 − xv(1 − Mv/Ma)]",
    description: "Air Density\nMass density of air, derived from temperature, humidity and pressure.",
  });

  // ── Driver ────────────────────────────────────────────────────────────────────────────────
  static readonly FS_HZ = new NumberField({
    value: "Fs_hz",
    label: "Fs",
    display: {kind: 'switchable', group: 'freq', base: 'Hz'},
    limits: {min: 1, max: 5000},
    floor: "positive",
    precision: 2,
    plausible: {min: 1.0, max: 5000.0},
    description: "Driver Resonant Frequency (Fs)\nFree-air resonance of the driver's moving assembly and suspension.",
  });
  static readonly QTS = new NumberField({
    value: "Qts",
    label: "Qts",
    display: {kind: 'fixed', symbol: ''},
    limits: {min: 0, max: 5},
    floor: "positive",
    precision: 3,
    plausible: {min: 0.01, max: 5.0},
    formula: "Qts = Qes·Qms/(Qes+Qms)",
    description: "Total Quality Factor (Qts)\nOverall damping at Fs — electrical (Qes) and mechanical (Qms) combined.",
  });
  static readonly QES = new NumberField({
    value: "Qes",
    label: "Qes",
    display: {kind: 'fixed', symbol: ''},
    // Qes has no finite upper physical bound: Qes = Qts·Qms/(Qms−Qts), so it grows without
    // bound as Qts approaches Qms from below. Keep the numeric-entry ceiling at the largest
    // finite value representable by this model rather than rejecting valid high-Q drivers.
    limits: {min: 0, max: Number.MAX_VALUE},
    floor: "positive",
    precision: 3,
    plausible: {min: 0.01, max: Number.MAX_VALUE},
    description: "Electrical Quality Factor (Qes)\nDamping at Fs from back-EMF in the voice coil.",
  });
  static readonly QMS = new NumberField({
    value: "Qms",
    label: "Qms",
    display: {kind: 'fixed', symbol: ''},
    limits: {min: 0, max: 50},
    floor: "positive",
    precision: 3,
    plausible: {min: 0.1, max: 50.0},
    description: "Mechanical Quality Factor (Qms)\nDamping at Fs from friction in the surround and spider.",
  });
  static readonly VAS_M3 = new NumberField({
    value: "Vas_m3",
    label: "Vas",
    display: {kind: 'switchable', group: 'volume', base: 'L'},
    limits: {min: 0, max: 100},
    floor: "positive",
    precision: 2,
    plausible: {min: 1e-06, max: 1.0},
    description: "Equivalent Compliance Volume (Vas)\nVolume of air whose compliance equals the driver suspension's own.",
  });
  static readonly RE_OHM = new NumberField({
    value: "Re_ohm",
    label: "Re",
    display: {kind: 'fixed', symbol: 'Ω'},
    limits: {min: 0.01, max: 1000},
    floor: "positive",
    precision: 3,
    plausible: {min: 0.1, max: 64.0},
    description: "DC Voice Coil Resistance (Re)\nResistance across the voice coil terminals, measured with DC.",
  });
  static readonly LE_H = new NumberField({
    value: "Le_H",
    label: "Le",
    display: {kind: 'switchable', group: 'inductance', base: 'mH'},
    limits: {min: 0, max: 0.1},
    floor: "non-negative",
    precision: 3,
    plausible: {min: 1e-06, max: 0.1},
    description: "Voice Coil Inductance (Le)\nSelf-inductance of the coil — raises electrical impedance at high frequency.",
  });
  static readonly MMS_KG = new NumberField({
    value: "Mms_kg",
    label: "Mms",
    display: {kind: 'switchable', group: 'mass', base: 'g'},
    limits: {min: 0, max: 10},
    floor: "positive",
    precision: 2,
    plausible: {min: 1e-05, max: 2.0},
    formula: "Mms = 1/((2π·Fs)²·Cms)",
    description: "Moving Mass (Mms)\nTotal mass of the diaphragm, voice coil, former and the air it loads.",
  });
  static readonly SD_M2 = new NumberField({
    value: "Sd_m2",
    label: "Sd",
    display: {kind: 'switchable', group: 'area', base: 'cm2'},
    limits: {min: 0.0001, max: 10},
    floor: "positive",
    precision: 2,
    plausible: {min: 1e-05, max: 0.3},
    description: "Effective Diaphragm Area (Sd)\nEffective radiating piston area of the cone and inner surround.",
  });
  static readonly XMAX_M = new NumberField({
    value: "Xmax_m",
    label: "Xmax",
    display: {kind: 'switchable', group: 'length', base: 'mm'},
    limits: {min: 0, max: 0.5},
    floor: "positive",
    precision: 3,
    plausible: {min: 0.0001, max: 0.15},
    description: "Peak Linear Excursion (Xmax)\nThe furthest the coil can move one way while still fully inside the magnetic gap.",
  });
  static readonly PE_W = new NumberField({
    value: "Pe_W",
    label: "Pe",
    display: {kind: 'fixed', symbol: 'W'},
    limits: {min: 0, max: 100000},
    floor: "positive",
    precision: 2,
    plausible: {min: 0, max: 20000.0},
    description: "Continuous Power Handling (Pe)\nThermal/RMS rating: the power the coil dissipates indefinitely without failing.\nNot the datasheet's peak/short-term figure — see \"Peak power\".",
  });
  static readonly POWER_PEAK_W = new NumberField({
    value: "power_peak_W",
    label: "Peak power",
    display: {kind: 'fixed', symbol: 'W'},
    limits: {min: 0, max: 100000},
    floor: "positive",
    precision: 2,
    description: "Peak Power (short-term)\nNon-continuous power handling, above Pe.\nOpenISD-only: WinISD's .wdr format has no slot for it, so it never round-trips through a .wdr/.wpr file.",
  });
  static readonly BL_TM = new NumberField({
    value: "BL_Tm",
    label: "BL",
    display: {kind: 'fixed', symbol: 'Tm'},
    limits: {min: 0, max: 1000},
    floor: "positive",
    precision: 5,
    plausible: {min: 0.1, max: 50.0},
    formula: "Bl = √(2π·Fs·Mms·Re/Qes)",
    description: "Motor Force Factor (BL)\nGap flux density (B) times coil wire length (L) — the motor's coupling strength.",
  });
  static readonly CMS_M_PER_N = new NumberField({
    value: "Cms_m_per_N",
    label: "Cms",
    display: {kind: 'switchable', group: 'compliance', base: 'mmPerN'},
    limits: {min: 0, max: 0.1},
    floor: "positive",
    precision: 4,
    plausible: {min: 1e-06, max: 0.1},
    formula: "Cms = Vas/(ρ·c²·Sd²)",
    description: "Mechanical Compliance (Cms)\nHow flexible the suspension is — the inverse of its spring rate.",
  });
  static readonly RMS_KG_PER_S = new NumberField({
    value: "Rms_kg_per_s",
    label: "Rms",
    display: {kind: 'switchable', group: 'resistance', base: 'nsPerM'},
    limits: {min: 0, max: 1000},
    floor: "positive",
    precision: 5,
    plausible: {min: 0.01, max: 200.0},
    formula: "Rms = 2π·Fs·Mms/Qms",
    description: "Mechanical Resistance (Rms)\nFriction loss in the driver's suspension.",
  });
  static readonly DD_M = new NumberField({
    value: "Dd_m",
    label: "Dd",
    display: {kind: 'switchable', group: 'length', base: 'mm'},
    limits: {min: 0, max: 2},
    floor: "positive",
    precision: 2,
    plausible: {min: 0.0, max: 2.0},
    description: "Effective Diaphragm Diameter (Dd)\nEffective piston diameter of the cone.\nInterchangeable with Sd (Sd = π·(Dd/2)²).",
  });
  static readonly FLE_HZ = new NumberField({
    value: "fLe_hz",
    label: "fLe",
    display: {kind: 'switchable', group: 'freq', base: 'kHz'},
    limits: {min: 0, max: 100000},
    floor: "positive",
    precision: 5,
    plausible: {min: 0.0, max: 100000},
    description: "Semi-Inductance Reference Frequency (fLe)\nThe frequency at which Le and KLe were measured.",
  });
  static readonly KLE_H_SQRTHZ = new NumberField({
    value: "KLe_H_sqrtHz",
    label: "KLe",
    display: {kind: 'fixed', symbol: 'H·√Hz'},
    limits: {min: 0, max: 10},
    floor: "non-negative",
    precision: 6,
    plausible: {min: 0.0, max: 10},
    description: "Semi-Inductance Coefficient (KLe)\nLoss factor for eddy currents and other high-frequency coil losses.",
  });
  static readonly HC_M = new NumberField({
    value: "Hc_m",
    label: "Hc",
    display: {kind: 'switchable', group: 'length', base: 'mm'},
    limits: {min: 0, max: 1},
    floor: "positive",
    precision: 3,
    plausible: {min: 0.0, max: 1},
    description: "Voice Coil Height (Hc)\nWinding height of the coil wire on the former.",
  });
  static readonly HG_M = new NumberField({
    value: "Hg_m",
    label: "Hg",
    display: {kind: 'switchable', group: 'length', base: 'mm'},
    limits: {min: 0, max: 1},
    floor: "positive",
    precision: 3,
    plausible: {min: 0.0, max: 1},
    description: "Magnetic Gap Height (Hg)\nThickness of the top plate — defines the magnetic gap.",
  });
  static readonly VD_M3 = new NumberField({
    value: "Vd_m3",
    label: "Vd",
    display: {kind: 'switchable', group: 'volume', base: 'cm3'},
    limits: {min: 0, max: 100000},
    floor: "positive",
    precision: 0,
    description: "Peak Displacement Volume (Vd)\nAir displaced by the cone at full excursion (Vd = Sd × Xmax).",
  });
  static readonly XLIM_M = new NumberField({
    value: "Xlim_m",
    label: "Xlim",
    display: {kind: 'switchable', group: 'length', base: 'mm'},
    limits: {min: 0, max: 1},
    floor: "positive",
    precision: 3,
    description: "Mechanical Excursion Limit (Xlim)\nAbsolute travel limit before mechanical damage or bottoming.",
  });
  static readonly NO = new NumberField({
    value: "no",
    label: "η₀",
    display: {kind: 'switchable', group: 'percent', base: 'pct'},
    limits: {min: 0, max: 100},
    floor: "positive",
    precision: 4,
    plausible: {min: 0.0, max: 1.0},
    description: "Reference Efficiency (η₀)\nHow much of the electrical power reaching the driver becomes acoustic power (η₀ = P_acc / P_elec × 100%).",
  });
  static readonly USPL_DB = new NumberField({
    value: "USPL_dB",
    label: "USPL",
    display: {kind: 'fixed', symbol: 'dB'},
    limits: {min: 0, max: 200},
    floor: "none",
    precision: 2,
    formula: "USPL = SPL + 10·log₁₀(8/Re)",
    description: "Voltage Sensitivity (USPL)\nSPL at 1 m for a standard 2.83 V RMS input.",
  });
  static readonly SPL_DB = new NumberField({
    value: "SPL_dB",
    label: "SPL",
    display: {kind: 'fixed', symbol: 'dB'},
    limits: {min: 0, max: 200},
    floor: "none",
    precision: 2,
    plausible: {min: 50.0, max: 150.0},
    description: "Power Sensitivity (SPL)\nSPL at 1 m for a 1 W electrical input.",
  });
  static readonly NUMVC = new NumberField({
    value: "numVC",
    label: "Voicecoils",
    display: {kind: 'fixed', symbol: ''},
    limits: {min: 1, max: 4},
    floor: "positive",
    spin: INTEGER_SPIN,
    precision: 0,
    description: "Voice Coil Count\nNumber of independent coil windings on the motor.",
  });
  static readonly ALFAVC_PER_K = new NumberField({
    value: "alfaVC_per_K",
    label: "AlfaVC",
    display: {kind: 'switchable', group: 'tempCoeff', base: 'perMilliK'},
    limits: {min: 0, max: 0.1},
    floor: "non-negative",
    precision: 4,
    description: "Voice Coil Temperature Coefficient (AlfaVC)\nHow much the coil's resistance rises per degree of heating.",
  });
  static readonly RT_K_PER_W = new NumberField({
    value: "Rt_K_per_W",
    label: "R(t)",
    display: {kind: 'fixed', symbol: 'K/W'},
    limits: {min: 0, max: 1000},
    floor: "positive",
    precision: 5,
    description: "Thermal Resistance (Rt)\nResistance to heat flow from the voice coil to the magnet and ambient air.",
  });
  static readonly CT_J_PER_K = new NumberField({
    value: "Ct_J_per_K",
    label: "C(t)",
    display: {kind: 'fixed', symbol: 'J/K'},
    limits: {min: 0, max: 10000},
    floor: "positive",
    precision: 5,
    description: "Thermal Capacitance (Ct)\nHeat storage capacity of the coil and motor structure.",
  });
  static readonly EBP_HZ = new NumberField({
    value: "EBP_hz",
    label: "EBP",
    display: {kind: 'switchable', group: 'freq', base: 'Hz'},
    limits: {min: 0, max: 1000},
    floor: "positive",
    precision: 2,
    plausible: {min: 0.0, max: 1000},
    formula: "EBP = Fs/Qes",
    description: "Efficiency Bandwidth Product (EBP)\nFs / Qes.\nBelow ~50 favours a sealed box; above ~90 favours vented.",
  });
  static readonly SPLMAXLF_DB = new NumberField({
    value: "SPLmaxLF_dB",
    label: "SPLmaxLF",
    display: {kind: 'fixed', symbol: 'dB'},
    limits: {min: 0, max: 200},
    floor: "none",
    precision: 2,
    formula: "SPLmaxLF = 20·log₁₀(ρ₀·(2π·20)²·Vd / (2π√2) / P0)",
    description: "Low-Frequency Excursion-Limited SPL\nMax SPL at 20 Hz, limited purely by peak excursion (Xmax).",
  });
  static readonly SPLMAX_DB = new NumberField({
    value: "SPLmax_dB",
    label: "SPLmax",
    display: {kind: 'fixed', symbol: 'dB'},
    limits: {min: 0, max: 200},
    floor: "none",
    precision: 2,
    formula: "SPLmax = SPL + 10·log₁₀(Pe) − 3",
    description: "Thermally Limited Max SPL\nMax SPL when driven at the full thermal power rating (Pe).",
  });
  static readonly RME_KG_PER_S = new NumberField({
    value: "Rme_kg_per_s",
    label: "Rme",
    display: {kind: 'switchable', group: 'resistance', base: 'nsPerM'},
    limits: {min: 0, max: 1000},
    floor: "positive",
    precision: 5,
    formula: "Rme = 2π·Fs·Mms/Qes (= Bl²/Re)",
    description: "Motional Resistance at Resonance (Rme)\nElectromagnetic damping from back-EMF at Fs (= Bl²/Re).",
  });
  static readonly GAMMA_M_PER_S2_A = new NumberField({
    value: "gamma_m_per_s2_A",
    label: "gamma",
    display: {kind: 'fixed', symbol: 'N/(A·kg)'},
    limits: {min: 0, max: 100000},
    floor: "positive",
    precision: 5,
    formula: "gamma = Bl/Mms",
    description: "Acceleration Factor (gamma)\nMotor force per unit of moving mass (Bl/Mms): how fast the cone starts to move for each amp.",
  });
  static readonly MPOW_N_PER_SQRTW = new NumberField({
    value: "Mpow_N_per_sqrtW",
    label: "Mpow",
    display: {kind: 'fixed', symbol: 'N/√W'},
    limits: {min: 0, max: 1000},
    floor: "positive",
    precision: 5,
    formula: "Mpow = √Rme (= Bl/√Re)",
    description: "Power-Normalized Motor Force (Mpow)\nMotor force per √W of input power (Bl/√Re).",
  });
  static readonly MCOST_KG_PER_S = new NumberField({
    value: "Mcost_kg_per_s",
    label: "Mcost",
    display: {kind: 'switchable', group: 'resistance', base: 'kgPerS'},
    limits: {min: 0, max: 1000},
    floor: "positive",
    precision: 5,
    formula: "Mcost = Rme·(1 + Xmax/min(Hc, Hg))",
    description: "Motor Figure of Merit (Mcost)\nElectromagnetic coupling efficiency, accounting for gap geometry and excursion.",
  });
  static readonly GLOSS = new NumberField({
    value: "Gloss",
    label: "Gloss",
    display: {kind: 'switchable', group: 'percent', base: 'pct'},
    limits: {min: 0, max: 100},
    floor: "positive",
    precision: 4,
    formula: "Gloss = g/((2π·Fs)²·Xmax), g = 9.80665",
    description: "Gravity Sag (Gloss)\nHow much of peak excursion (Xmax) gravity consumes when the driver is mounted horizontally.",
  });
  static readonly THICK_M = new NumberField({
    value: "Thick_m",
    label: "Basket Plate Thickness",
    display: {kind: 'switchable', group: 'length', base: 'mm'},
    limits: {min: 0, max: 0.3},
    floor: "positive",
    precision: 2,
    description: "Basket Flange Thickness\nFrame flange thickness at the mounting boundary.",
  });
  static readonly DEPTH_M = new NumberField({
    value: "Depth_m",
    label: "Driver Depth",
    display: {kind: 'switchable', group: 'length', base: 'mm'},
    limits: {min: 0, max: 5},
    floor: "positive",
    precision: 2,
    description: "Overall Driver Depth\nFull depth from mounting flange to rear magnet pole plate.",
  });
  static readonly MAGDEPTH_M = new NumberField({
    value: "MagDepth_m",
    label: "Magnet Depth",
    display: {kind: 'switchable', group: 'length', base: 'mm'},
    limits: {min: 0, max: 5},
    floor: "positive",
    precision: 2,
    description: "Magnet Assembly Depth\nThickness of the rear magnet assembly.",
  });
  static readonly MAGNET_M = new NumberField({
    value: "Magnet_m",
    label: "Magnet Diameter",
    display: {kind: 'switchable', group: 'length', base: 'mm'},
    limits: {min: 0, max: 5},
    floor: "positive",
    precision: 2,
    description: "Magnet Diameter\nOuter diameter of the motor magnet.",
  });
  static readonly BASKET_M = new NumberField({
    value: "Basket_m",
    label: "Basket Diameter",
    display: {kind: 'switchable', group: 'length', base: 'mm'},
    limits: {min: 0.01, max: 1},
    plausible: {min: 0.01, max: 0.61},
    floor: "positive",
    precision: 2,
    description: "Basket Diameter\nDiameter of the hole cut in the baffle.",
  });
  static readonly OUTER_M = new NumberField({
    value: "Outer_m",
    label: "Outer Diameter",
    display: {kind: 'switchable', group: 'length', base: 'mm'},
    limits: {min: 0, max: 5},
    floor: "positive",
    precision: 2,
    description: "Outer Mounting Diameter\nOverall diameter of the front mounting flange.",
  });
  static readonly OUTERX_M = new NumberField({
    value: "OuterX_m",
    label: "Frame Size X (OuterX)",
    fullLabel: "Frame Size X",
    display: {kind: 'switchable', group: 'length', base: 'mm'},
    limits: {min: 0, max: 5},
    floor: "positive",
    precision: 2,
    description: "Rectangular Frame Size, X\nOne side of the frame, for a driver with a rectangular (not round) frame. WinISD has no such field.",
  });
  static readonly OUTERY_M = new NumberField({
    value: "OuterY_m",
    label: "Frame Size Y (OuterY)",
    fullLabel: "Frame Size Y",
    display: {kind: 'switchable', group: 'length', base: 'mm'},
    limits: {min: 0, max: 5},
    floor: "positive",
    precision: 2,
    description: "Rectangular Frame Size, Y\nThe other side of the frame, for a driver with a rectangular (not round) frame. WinISD has no such field.",
  });
  static readonly WEIGHT_KG = new NumberField({
    value: "weight_kg",
    label: "Driver Weight",
    display: {kind: 'switchable', group: 'mass', base: 'kg'},
    limits: {min: 0, max: 500},
    floor: "positive",
    precision: 3,
    description: "Driver Weight\nHow much the whole driver weighs, as the maker states it. It is for planning the baffle and mounting. WinISD has no such field.",
  });
  static readonly VCD_M = new NumberField({
    value: "Vcd_m",
    label: "Voice Coil Dia (Vcd)",
    fullLabel: "Voice Coil Diameter",
    display: {kind: 'switchable', group: 'length', base: 'mm'},
    limits: {min: 0, max: 1},
    floor: "positive",
    precision: 2,
    description: "Voice Coil Diameter\nFormer diameter of the coil winding.",
  });
  static readonly DVOL_M3 = new NumberField({
    value: "DVol_m3",
    label: "Driver Displacement Volume (DVol)",
    fullLabel: "Driver Displacement Volume",
    display: {kind: 'switchable', group: 'volume', base: 'cm3'},
    limits: {min: 0, max: 1},
    floor: "positive",
    precision: 2,
    description: "Driver Displacement Volume\nVolume the motor and basket occupy inside the enclosure.",
  });
  static readonly ZNOM_OHM = new NumberField({
    value: "Znom_ohm",
    label: "Znom",
    display: {kind: 'fixed', symbol: 'Ω'},
    limits: {min: 0, max: 64},
    floor: "non-negative",
    precision: 4,
    plausible: {min: 1.0, max: 64.0},
    description: "Nominal Impedance (Znom)\nRated impedance class for amplifier matching — e.g. 4, 8 or 16 Ω.",
  });
  static readonly C_M_PER_S = new NumberField({
    value: "c_m_per_s",
    label: "c",
    display: {kind: 'switchable', group: 'velocity', base: 'mps'},
    limits: {min: 0, max: 1000},
    floor: "positive",
    precision: 2,
    plausible: {min: 300.0, max: 360.0},
    description: "Speed of sound (c), in m/s. Read-only air value supplied by the project environment, or app defaults without a project. Used in acoustic and compliance calculations. Change the environment in Advanced or Options.",
  });
  static readonly ROO_KG_PER_M3 = new NumberField({
    value: "roo_kg_per_m3",
    label: "rho",
    display: {kind: 'switchable', group: 'density', base: 'kgPerM3'},
    limits: {min: 0, max: 10},
    floor: "positive",
    precision: 5,
    plausible: {min: 0.9, max: 1.5},
    description: "Air density (rho), in kg/m³: the mass of air per unit volume. Read-only value supplied by the project environment, or app defaults without a project. Used in acoustic loading, compliance and sound-output calculations. Change the environment in Advanced or Options.",
  });

  // ── Box ───────────────────────────────────────────────────────────────────────────────────
  static readonly BOX_RESONANCE_HZ = new NumberField({
    value: "box_Resonance_hz",
    label: "Fsc / Fh",
    display: {kind: 'switchable', group: 'freq', base: 'Hz'},
    limits: {min: 0, max: 20000},
    precision: 2,
    description: "System Resonance Frequency (Fsc / Fh)\nThe driver's resonance once coupled to the enclosure.",
  });
  static readonly BOX_FH_HZ = new NumberField({
    value: "box_Fh_hz",
    label: "Fh",
    display: {kind: 'switchable', group: 'freq', base: 'Hz'},
    limits: {min: 1, max: 1000},
    precision: 2,
    description: "Passive Radiator System Tuning (Fh)\nHelmholtz tuning frequency the passive radiator and the box volume achieve together. The same value as the Fp on the Passive Radiator tab.",
  });
  static readonly BOX_FSC_HZ = new NumberField({
    value: "box_Fsc_hz",
    label: "Fsc",
    display: {kind: 'switchable', group: 'freq', base: 'Hz'},
    limits: {min: 0, max: 20000},
    floor: "positive",
    precision: 2,
    description: "System Resonance Frequency (Fsc)\nThe driver's resonance once coupled to the closed box. Volume, Fsc and Qtc each fix the other two: enter one and the other two are calculated.",
  });
  static readonly BOX_QTC_VALUE = new NumberField({
    value: "box_Qtc_value",
    label: "Qtc",
    display: {kind: 'fixed', symbol: ''},
    limits: {min: 0, max: 5},
    floor: "positive",
    precision: 3,
    description: "System Q (Qtc)\nThe closed box's total system Q. Volume, Fsc and Qtc each fix the other two: enter one and the other two are calculated.",
  });
  static readonly BOX_REARRESONANCE_HZ = new NumberField({
    value: "box_RearResonance_hz",
    label: "Frc",
    display: {kind: 'switchable', group: 'freq', base: 'Hz'},
    limits: {min: 0, max: 20000},
    precision: 2,
    description: "Rear Chamber Resonance (Frc)\nSealed rear-chamber resonance in a 4th-order bandpass box (Frc = Fs·√(1 + Vas/Vb)).",
  });
  static readonly BOX_FRC_HZ = new NumberField({
    value: "box_Frc_hz",
    label: "Tuning freq (Frc)",
    display: {kind: 'switchable', group: 'freq', base: 'Hz'},
    limits: {min: 0, max: 20000},
    floor: "positive",
    loadRepair: {breaks: 'floor', to: 'empty', described: 'the tuning worked out from the port'},
    precision: 2,
    description: "Rear Chamber Tuning Frequency (Frc)\nHelmholtz tuning frequency of the vented rear chamber in a 6th-order bandpass or ABC box. Enter the tuning frequency to calculate port length, or enter port length to calculate the tuning frequency. An unbuildable port is flagged.",
  });

  // ── Driver ────────────────────────────────────────────────────────────────────────────────
  static readonly DRIVER_NDRIVERS = new NumberField({
    editor: NumberEditor.CountSelect,
    value: "driver_nDrivers",
    label: "Num. of drivers",
    display: {kind: 'fixed', symbol: ''},
    limits: {min: 1, max: 64},
    loadRepair: {breaks: 'min', to: 1, described: '1, the fewest'},
    spin: INTEGER_SPIN,
    precision: 0,
    description: "Driver Count\nHow many drivers are active in the enclosure.",
  });
  static readonly DRIVER_VCTEMPRISE_K = new NumberField({
    value: "driver_VcTempRise_K",
    label: "Voice coil temp rise",
    display: {kind: 'switchable', group: 'tempDiff', base: 'K'},
    limits: {min: 0, max: 500},
    precision: 2,
    description: "Voice Coil Temperature Rise\nHeating from electrical power dissipation (I²·Re).\nRaises Re and causes thermal power compression.",
  });
  static readonly DRIVER_ADDEDMASS_G = new NumberField({
    value: "driver_AddedMass_g",
    label: "Added mass to cone",
    display: {kind: 'switchable', group: 'mass', base: 'g'},
    limits: {min: 0, max: 5},
    precision: 5,
    description: "Cone Added Mass (test)\nMass temporarily added to the cone to shift Fs, so Cms and Mms can be calculated.",
  });

  // ── Filters ───────────────────────────────────────────────────────────────────────────────
  static readonly FILTER_FC_HZ = new NumberField({
    value: "filter_Fc_hz",
    label: "Cutoff / Center freq",
    display: {kind: 'fixed', symbol: 'Hz'},
    limits: FILTER_FC_LIMITS,
    precision: 3,
    description: "Cutoff / Center Frequency\nCutoff or center frequency of the active filter.",
    allowedEmpty: true,
  });
  /** The same frequency on the phone's Filters cards, shown in whole hertz (the accepted classic phone
   *  mock, screen 10). The desktop keeps FILTER_FC_HZ's decimals and fine spinner steps. */
  static readonly PHONE_FILTER_FC_HZ = new NumberField({
    value: "phone_Filter_Fc_hz",
    label: "Cutoff / Center freq",
    display: {kind: 'fixed', symbol: 'Hz'},
    limits: FILTER_FC_LIMITS,
    precision: 0,
    description: "Cutoff / Center Frequency\nCutoff or center frequency of the active filter.",
    allowedEmpty: true,
  });
  static readonly FILTER_Q = new NumberField({
    value: "filter_Q",
    label: "Q",
    display: {kind: 'fixed', symbol: ''},
    limits: FILTER_Q_LIMITS,
    precision: 3,
    description: "Filter Quality Factor (Q)\nHow sharp the filter's resonance peak or its damping is.",
    allowedEmpty: true,
  });
  static readonly FILTER_GAIN_DB = new NumberField({
    value: "filter_Gain_dB",
    label: "Gain",
    display: {kind: 'fixed', symbol: 'dB'},
    limits: FILTER_GAIN_LIMITS,
    spin: {kind: 'proportionalFloored', finestExp: -1},
    precision: 3,
    description: "Filter Gain\nBoost or cut applied by the filter or equalizer, in dB.",
    allowedEmpty: true,
  });
  /** The Peaking 2nd order highpass peak gain: 0..60 dB when typing (QO951.c9). */
  static readonly FILTER_PEAK_HIGHPASS_GAIN_DB = new NumberField({
    value: "filter_Peak_Highpass_Gain_dB",
    label: "Gpk",
    display: {kind: 'fixed', symbol: 'dB'},
    limits: PEAK_HIGHPASS_GAIN_LIMITS,
    minimumReason: 'A 2nd-order high-pass cannot peak below its flat level.',
    spin: {kind: 'proportionalFloored', finestExp: -1},
    precision: 3,
    description: "Peak Gain (Gpk)\nHow far the peaking highpass rises above its flat level at fpk, in dB.\n0 dB or more: a 2nd-order high-pass cannot peak below its flat level.",
    allowedEmpty: true,
  });
  static readonly FILTER_ORDER = new NumberField({
    value: "filter_Order",
    label: "Order",
    display: {kind: 'fixed', symbol: ''},
    limits: FILTER_ORDER_LIMITS,
    spin: INTEGER_SPIN,
    precision: 0,
    description: "Filter Order\nFilter steepness: 1st order = 6 dB/oct, 2nd = 12 dB/oct, 4th = 24 dB/oct. Up to 20.\nWinISD stops at order 10 (above that it hits a floating-point overflow error); a project with a higher order shows that error in WinISD.",
    allowedEmpty: true,
  });
  static readonly FILTER_T_S = new NumberField({
    value: "filter_T_s",
    label: "t",
    display: {kind: 'fixed', symbol: 's'},
    limits: FILTER_T_LIMITS,
    precision: 4,
    description: "Allpass Delay Time\nGroup-delay time constant of an allpass filter section.",
    allowedEmpty: true,
  });
  static readonly FILTER_BW_OCT = new NumberField({
    value: "filter_BW_oct",
    label: "BW",
    display: {kind: 'fixed', symbol: 'oct'},
    limits: FILTER_BW_LIMITS,
    precision: 3,
    description: "DLP Raised-Cosine Bandwidth\nWidth of the raised-cosine transition band, in octaves.",
    allowedEmpty: true,
  });

  static readonly ALL: readonly NumberField[] =
    Object.freeze(Object.values(NumberField).filter((v): v is NumberField => v instanceof NumberField));

  /** The member a record key names, or `undefined` for a key no field claims. A field's `value`
   *  IS its record key, so this is the same string either way. */
  static named(value: string): NumberField | undefined {
    return NumberField.ALL.find(f => f.value === value);
  }
}

interface EnumFieldSpec extends FieldSpec {
  readonly options: readonly SelectorOption[];
}

/** A field holding one of a closed set of values. */
export class EnumField extends Field {
  readonly kind = 'enum';
  /** The values the field admits, in the order they are offered. */
  readonly options: readonly SelectorOption[];

  private constructor(spec: EnumFieldSpec) {
    super(spec);
    this.options = spec.options;
  }

  // ── Box ───────────────────────────────────────────────────────────────────────────────────
  static readonly BOX_TYPE = new EnumField({
    value: "box_Type",
    label: "Box type",
    options: BOX_TYPE_OPTIONS,
    description: "Enclosure Type\nWhich kind of box the driver is loaded into — closed, vented, passive radiator, bandpass or ABC.",
  });
  static readonly BOX_QTC = new EnumField({
    value: "box_Qtc",
    label: "Alignment (Qtc)",
    options: SEALED_ALIGNMENT_OPTIONS,
    description: "Sealed Alignment Target (Qtc)\nThe closed box's total system Q.\n0.707 is maximally flat; lower is more damped; higher peaks before rolling off.",
  });

  // ── Vent ──────────────────────────────────────────────────────────────────────────────────
  static readonly VENT_SHAPE = new EnumField({
    value: "vent_Shape",
    label: "Vent shape",
    options: VENT_SHAPE_OPTIONS,
    description: "Vent Geometry\nA circular tube (round) or a rectangular duct (slotted) port.",
  });
  static readonly VENT_ENDCORRECTION = new EnumField({
    value: "vent_EndCorrection",
    label: "End Correction",
    options: END_CORRECTION_OPTIONS,
    description: "End Correction Factor\nAccounts for air moving just beyond the duct's physical ends — it extends the port's effective length.\nDepends on how the port terminates: free air, or a flanged baffle.",
  });

  // ── Driver ────────────────────────────────────────────────────────────────────────────────
  static readonly VCCON = new EnumField({
    value: "VCCon",
    label: "Coil wiring",
    options: VC_CONNECTION_OPTIONS,
    description: "Coil wiring: as the maker measured it\nHow the voice coils were wired when the maker measured this driver (Series or Parallel). It says what the published Re and BL mean; it changes no figure. Leave it Not stated if the datasheet does not say. The wiring you use in a project is that project's own Coil wiring, on its Driver tab.",
  });
  /** The project's coil wiring (QO941), named as the driver's `VCCon` (John, QO942.c56) and labelled the same; its help says which is which (QO942.c58). */
  static readonly PROJECT_VCCON = new EnumField({
    value: "project_VCCon",
    label: "Coil wiring",
    options: VC_CONNECTION_OPTIONS,
    description: "Coil wiring: how you wire it in this project\nHow you wire this driver's voice coils in this project. If it differs from how the driver was measured, the calculations use the figures for your wiring (for 2 coils, Series gives Re, Le and nominal impedance ×4 and BL ×2 compared with Parallel; Fs, Q, Vas and Mms do not change). The driver's own figures are never changed. It can be changed only for a driver with 2 or more coils whose measured wiring is stated.",
  });
  static readonly PROJECT_LOADING = new EnumField({
    value: "project_loading",
    label: "Placement",
    options: [
      {value: 'standard', label: 'Standard'},
      {value: 'isobaric', label: 'Iso-Barik'},
    ],
    description: "Iso-Barik uses two coupled drivers moving together. One cone radiates sound, and the pair needs half the box volume of a single driver for the same alignment.",
  });

  /** How the project's several drivers are wired to the amplifier (ticket 519). */
  static readonly PROJECT_DRIVERWIRING = new EnumField({
    value: "project_driverWiring",
    label: "Driver wiring",
    options: DRIVER_WIRING_OPTIONS,
    description: "Driver wiring\nHow the drivers are connected to the amplifier. Parallel: each driver gets the full amplifier voltage; the load is one driver's impedance divided by the number of drivers (4 × 8 Ω → 2 Ω). Series: the voltage is split between the drivers; the load is the impedance times the number (4 × 8 Ω → 32 Ω). This changes the impedance chart, the SPL and excursion for a given amplifier voltage, and how Rg acts. Not the same as Coil wiring, which connects the voice coils inside one driver.",
  });

  // ── Filters ───────────────────────────────────────────────────────────────────────────────
  static readonly FILTER_TYPE = new EnumField({
    value: "filter_Type",
    label: "Filter type",
    options: FILTER_TYPE_OPTIONS,
    description: "Filter Type\nThe active filter's response shape — lowpass, highpass, Linkwitz transform, peaking EQ or shelf.",
  });

  static readonly ALL: readonly EnumField[] =
    Object.freeze(Object.values(EnumField).filter((v): v is EnumField => v instanceof EnumField));
}

/** A field holding free text. */
export class TextField extends Field {
  readonly kind = 'text';

  private constructor(spec: FieldSpec) { super(spec); }

  // ── Driver ────────────────────────────────────────────────────────────────────────────────
  static readonly DRIVER_MANUFACTURER = new TextField({
    value: "driver_manufacturer",
    label: "Manufacturer",
    description: "Manufacturer\nThe company that designed and made the driver.",
  });
  static readonly DRIVER_BRAND = new TextField({
    value: "driver_brand",
    label: "Brand",
    description: "Brand\nThe trade name the driver is marketed under.",
  });
  static readonly DRIVER_MODEL = new TextField({
    value: "driver_model",
    label: "Model",
    description: "Model\nManufacturer model designation or part number.\nExamples:\nW5-1138SMF\nRS270-8 10\" Reference Woofer 8 Ohm",
  });
  static readonly DRIVER_SKU = new TextField({
    value: "driver_sku",
    label: "Part Number",
    description: "Part Number (SKU)\nThe exact code from the datasheet.\nExamples:\nW5-1138SMF (Tang Band)\nRS270-8 (Dayton Audio)\n10PR-8 (GRS)\nSB13PFCR-00 (SB Acoustics)\n10FH520-4 (FaitalPRO)\nKappalite-3015 (Eminence)",
  });
  static readonly DRIVER_PROVIDEDBY = new TextField({
    value: "driver_providedBy",
    label: "Data provided by",
    description: "Data Attribution\nWho contributed or measured this parameter data.",
  });
  static readonly DRIVER_COMMENT = new TextField({
    value: "driver_comment",
    label: "Comment",
    description: "Driver Notes\nFree-text engineering notes on this driver record.",
  });

  // ── Passive radiator ──────────────────────────────────────────────────────────────────────
  static readonly PR_NAME = new TextField({
    value: "pr_name",
    label: "Passive radiator",
    description: "Passive radiator name\nThe name it is saved under in your passive radiator library.\nExample: Dayton SD270A-88",
  });

  static readonly ALL: readonly TextField[] =
    Object.freeze(Object.values(TextField).filter((v): v is TextField => v instanceof TextField));
}

/** A field holding an on/off choice. */
export class ToggleField extends Field {
  readonly kind = 'toggle';

  /** A bug switch's "Seen in" line: the charts and readouts its bug shows in, with sizes. The
   *  tooltip ends with it; the ≠W popup shows it too. Null for a switch that is not a bug switch. */
  readonly seenIn: string | null;

  /** The on-screen label as lines (John, 2026-10-05). A line after the first keeps its leading
   *  space, so the lines joined are `label`. The tooltip keeps the one-line label. */
  readonly labelLines: readonly string[];

  /** `breakAfter`: the label text a line break follows; null keeps the label one line. */
  private constructor(spec: FieldSpec, seenIn: string | null = null, breakAfter: string | null = null) {
    super(seenIn === null ? spec : {...spec, description: `${spec.description}\nSeen in: ${seenIn}`});
    this.seenIn = seenIn;
    if (breakAfter === null) {
      this.labelLines = Object.freeze([spec.label]);
    } else {
      const at = spec.label.indexOf(breakAfter);
      if (at < 0) throw new Error(`ToggleField ${spec.value}: "${breakAfter}" is not in its label`);
      const cut = at + breakAfter.length;
      this.labelLines = Object.freeze([spec.label.slice(0, cut), spec.label.slice(cut)]);
    }
  }

  // ── Advanced ──────────────────────────────────────────────────────────────────────────────
  static readonly ADV_SIMVCINDUCTANCE = new ToggleField({
    value: "adv_SimVcInductance",
    label: "Simulate voice coil inductance",
    description: "Simulate voice coil inductance\nTicked: the voice coil inductance Le is in the impedance and in the SPL and transfer function, so both fall away at high frequency.\nUnticked (default): Le is left out of the impedance and of the SPL, as WinISD does.",
  });
  static readonly ADV_FORCEFLATRESPONSE = new ToggleField({
    value: "adv_ForceFlatResponse",
    label: "Force flat response",
    description: "Force Flat Response\nAdds EQ to make the response flat. The excursion and port velocity charts then show what a flat passband needs.",
  });
  static readonly ADV_TLPORTMODEL = new ToggleField({
    value: "adv_TlPortModel",
    label: "Use \"transmission line\"-model for port simulation",
    description: "Transmission Line Port Model\nTreats the port as a pipe with length, not a lump of air. The response curves then show the port's own pipe resonances.",
  }, null, '-model');
  static readonly ADV_RGATDRIVERSIDE = new ToggleField({
    value: "adv_RgAtDriverSide",
    label: "Rg is at driver side",
    description: "Rg Placement\nTicked: each driver gets its own series resistance Rg. Unticked: Rg sits once, at the amplifier output.",
  });
  static readonly ADV_SPLXMAXLIMITED = new ToggleField({
    value: "adv_SplXmaxLimited",
    label: "SPL graph is Xmax limited",
    description: "Xmax Limited SPL\nClamps the SPL curve wherever cone excursion would exceed Xmax.",
  });
  // ── WinISD Compatibility: bugs (under "Enable WinISD bugs", named by the bug; ticked brings the WinISD bug back) ──
  static readonly ADV_WINISDDRIVERMODEL = new ToggleField({
    value: "adv_WinisdDriverModel",
    label: "Two-BL driver",
    description: "Two-BL driver: WinISD uses two different BL values for one driver. The BL that Re, Fs, Qes and Vas imply sets the damping, and the BL you typed in sets the loudness. But a driver has only one BL, so when the two disagree the loudness and the damping describe different drivers. So with an entered BL that is off, WinISD's charts show a driver that cannot exist (W5-1138SMF, entered BL 7.17, implied 7.384: the SPL chart is 0.26 dB out in the passband and the impedance peak about 1.2 Ω, 8 %, high). OpenISD uses one BL, the implied one, for both; an entered BL that disagrees is marked and changes no chart. Tick this to use both BLs as WinISD does: the entered BL then sets the loudness and, with voice coil inductance on, the inductance roll-off. Nothing changes if the entered BL already agrees.",
  }, "every chart, only when the entered BL disagrees with the one that Re, Fs, Qes and Vas imply. W5-1138SMF (entered BL 7.17, implied 7.384): the SPL chart differs by 0.26 dB in the passband, the Impedance chart peak is about 1.2 Ω (8 %) high, and the Transfer function magnitude chart differs by 0.51 dB.");
  static readonly ADV_WINISDVAMODEL = new ToggleField({
    value: "adv_WinisdVaModel",
    label: "Re without Rg",
    description: "Re without Rg: WinISD works out the amplifier's load power (the VA chart) and the power from a voltage with the driver's Re alone, but the amplifier really drives Re plus Rg, the series resistance of the cable and amplifier output. So WinISD's VA is low by Re/(Re + Rg), about 23 % at Re 3.4 Ω and Rg 1 Ω, and a typed-in voltage gives a power that does not match the SPL chart (4.0 W against 3.91 W at 1.85 V each × 4 drivers, Re 3.4 Ω, Rg 0.1 Ω). OpenISD counts Re + Rg throughout, Rg once. Tick this to get WinISD's figures: VA = P·Re/|Z + Rg| and P = N·V²/Re (with \"Rg is at driver side\" on, Z already holds Rg and WinISD adds it again). With Rg at 0 Ω both agree.\nP: input power. V: voltage at each driver. N: number of drivers. Z: the impedance chart. Rg: the series resistance.",
  }, "the Amplifier apparent load power (VA) chart, about 23 % low at Re 3.4 Ω, Rg 1 Ω. The Signal tab's System input power readout, 4.0 W against 3.91 W at 1.85 V each × 4 drivers, Re 3.4 Ω, Rg 0.1 Ω. With the voltage typed in, the SPL chart is about 0.1 dB louder in that case.");
  static readonly ADV_WINISDPRNPRRESONANCE = new ToggleField({
    value: "adv_WinisdPrNprResonance",
    label: "PR Npr resonance",
    description: "PR Npr resonance: with more than one passive radiator (Npr), WinISD works out the box's leak and absorption losses at a frequency Npr times too low, because it multiplies the radiator mass by Npr where the tuning divides by it. But the losses belong at the box's real tuning. So the Impedance chart is off by up to 1 Ω and the Transfer function chart by up to 2 dB (Npr 2, W5 in 10 L, radiator Fs 30 Hz, Vas 4.8 L: WinISD takes 21 Hz, the tuning is 42 Hz). OpenISD takes the losses at the true tuning, 1/√((Map/Npr)·(Cab ∥ Npr·Cap)). Tick this to take them at WinISD's frequency, 1/√(Npr·Map·(Cab ∥ Npr·Cap)). With one radiator (Npr = 1) nothing changes.",
  }, "passive radiator boxes with more than one radiator (Npr > 1), with WinISD's lossy model. No change at Npr = 1. Npr 2, W5 in 10 L, radiator Fs 30 Hz and Vas 4.8 L (WinISD 21 Hz, tuning 42 Hz): the Impedance chart differs by up to 1 Ω, the Transfer function magnitude chart by up to 2 dB.");
  static readonly ADV_WINISDSEALEDPICKER = new ToggleField({
    value: "adv_WinisdSealedPicker",
    label: "Sealed picker volume",
    description: "Sealed picker volume: WinISD's sealed alignment picker suggests a box volume for the Qtc (total Q) you pick, but it works that out with a fixed Rg of 0.1 Ω and a fixed Qa of 100 and leaves out your own box leakage losses (Ql), Rg and Qa, which its charts do use. So WinISD is inconsistent with itself: its Box tab then shows a different Qtc from the one you picked (W5-1138SMF, Qts 0.49, Vas 4.85 L, Ql 10: picking 0.800 gives 3.13 L, and the Box tab shows 0.787). OpenISD gives the volume at which the Box tab shows the Qtc you picked (2.96 L, and the Box tab shows 0.800), counting the project's Rg and every box loss. Tick this to get WinISD's volume: Qt = 1/(1/Qts′ + 1/100), with Qts′ using Qes·(Re + 0.1)/Re, and Vb = Vas/((Qtc/Qt)² − 1).\nQtc: the picked total Q. Qts′: the driver's Qts with Rg in it. Vas: the equivalent air volume of all the drivers (one driver's Vas times the number of drivers, half that for an isobaric pair), as WinISD's picker uses.",
  }, "the sealed alignment picker in the New Project wizard and on the Box tab. W5-1138SMF (Qts 0.49, Vas 4.85 L), Ql 10: Qtc 0.800 picked gives 3.13 L, and the Box tab shows 0.787. OpenISD gives 2.96 L, and the Box tab shows 0.800.");
  static readonly ADV_WINISDBESSELHIGHPASS = new ToggleField({
    value: "adv_WinisdBesselHighpass",
    label: "Bessel high-pass",
    description: "Bessel high-pass: WinISD builds its Bessel high-pass by keeping the low-pass's denominator and swapping the numerator to (k·s)^n, but a Bessel high-pass should be the mirror image of the low-pass (s → 1/s). So WinISD's filter has the wrong shape: its response is up to 6 % out at order 4, fc 25 Hz, and so is every chart the filter feeds (SPL, Cone excursion, port velocities). OpenISD uses the true mirror image. Tick this to get WinISD's. Only Bessel high-pass filters of order 2 or more change; Butterworth, Linkwitz-Riley, SOS, every low-pass and a first-order Bessel do not.",
  }, "Bessel high-pass filters of order 2 or more in the EQ/Filter chain: the three EQ/Filter charts and every chart the filter feeds (SPL, Cone excursion, port velocities). The complex response differs by up to 6 % at order 4, fc 25 Hz. Butterworth, Linkwitz-Riley, SOS, every low-pass and a first-order Bessel do not change.");
  static readonly ADV_WINISDABCGROUPDELAY = new ToggleField({
    value: "adv_WinisdAbcGroupDelay",
    label: "ABC group delay",
    description: "ABC group delay: WinISD works out an ABC box's group delay (how late each frequency arrives) by stepping the box to f ± 1e-10 Hz but keeping the driver at the chart frequency f, so the driver's own phase slope is missing. But WinISD's own phase chart for the same box does include the driver, so the two disagree (W5-1138SMF ABC: −41.0 ms against −33.9 ms at 1 Hz, −3.3 ms against +3.6 ms at 10.75 Hz). OpenISD takes the group delay as −dφ/dω of the plotted phase, so it matches the phase chart. Tick this to get WinISD's. Only the Group Delay chart of an ABC box changes.",
  }, "the Group Delay chart of an ABC box only. W5-1138SMF ABC: −41.0 ms against −33.9 ms at 1 Hz, −3.3 ms against +3.6 ms at 10.75 Hz.");
  static readonly ADV_WINISDTLPORTNOENDCORRECTION = new ToggleField({
    value: "adv_WinisdTlPortNoEndCorrection",
    label: "TL port without end correction",
    description: "TL port without end correction: with \"Use transmission line model\" on, WinISD builds the port pipe from the Fb port length less the port's end correction (the extra air that moves at the mouths), but the Fb you set on the Box tab already counts that end correction. So the pipe comes out too light and the box tunes higher than the Fb the Box tab shows (W5-1138SMF, Fb 38 Hz: impedance minimum 40.3 Hz in WinISD against 38.7 Hz in OpenISD). OpenISD keeps the end correction, so the box tunes where the Box tab says. Tick this to get WinISD's tuning. Only vented, bandpass and ABC boxes with the transmission line model on change; the Impedance, SPL and Transfer function charts follow.",
  }, "the Impedance, SPL and Transfer function charts of vented, bandpass and ABC boxes with the transmission line model on. W5-1138SMF, Fb 38 Hz: impedance minimum 40.3 Hz in WinISD against 38.7 Hz with the end correction.");

  static readonly ADV_WINISDCOILWIRINGREBLONLY = new ToggleField({
    value: "adv_WinisdCoilWiringReBlOnly",
    label: "Coil wiring: Re and BL only",
    description: "Coil wiring: Re and BL only: when you change how a multi-coil driver's voice coils are wired, WinISD converts Re and BL but leaves the inductance Le and the nominal impedance Znom as they were. But rewiring changes all three together: with N coils, Re, Le and Znom change by N² and BL by N (for 2 coils, Series gives Re, Le and Znom ×4 and BL ×2 compared with Parallel). So WinISD's high frequencies are wrong after a rewire (Dayton MX6-22, Le 1.5 mH measured in series, set to Parallel: Le should be 0.375 mH and WinISD keeps 1.5 mH). OpenISD converts all of them. Tick this to convert only Re and BL as WinISD does. It shows only with \"Simulate voice coil inductance\" on, in the Impedance, SPL and Transfer function charts at high frequency; Znom feeds no chart. It applies only to a driver with 2 or more coils whose measured wiring is stated.",
  }, "the Impedance, SPL and Transfer function charts at high frequency, with voice coil inductance on, for a multi-coil driver whose project Coil wiring differs from the driver's. Dayton MX6-22 (Le 1.5 mH measured in series) set to Parallel: Le is 0.375 mH here and 1.5 mH with the switch ticked.");
  static readonly ADV_WINISDPROJECTALFAVC = new ToggleField({
    value: "adv_WinisdProjectAlfaVC",
    label: "Coil coefficient from project",
    description: "Coil coefficient from project: WinISD heats the voice coil (Re rises by Re·AlfaVC·dTVC) with the project's AlfaVC from the Driver tab only and ignores the AlfaVC stored with the driver, but AlfaVC is a property of the coil wire's metal (copper 0.0039 /K, aluminium about 0.0042 /K), so it belongs to the driver. So WinISD heats an aluminium coil as if it were copper (Re 3.2 Ω, driver AlfaVC 0.0042, dTVC 100 K: the hot Re is 4.544 Ω, and WinISD uses 4.448 Ω, about 2 % low); the Box tab's Fsc and Qtc, the charts and the power from a voltage follow. OpenISD heats the coil with the driver's AlfaVC when the driver gives one other than 0, else with the project's (0.0039 unless you change it); every catalogue driver stores 0, so they use the project's. Tick this to use the project's AlfaVC only, as WinISD does. With dTVC 0 nothing changes.",
  }, "the Box tab's Fsc and Qtc, every chart and the Signal tab's power from a voltage, only when the coil runs hot (dTVC not 0) and the driver states an AlfaVC other than 0 and other than the project's. Re 3.2 Ω, driver AlfaVC 0.0042, project 0.0039, dTVC 100 K: hot Re 4.544 Ω here, 4.448 Ω with the switch ticked.");

  // ── WinISD Compatibility: options (under "Enable WinISD-style", named by the calculation; ticked is WinISD's way) ──────
  static readonly ADV_WINISDWRAPPHASE = new ToggleField({
    value: "adv_WinisdWrapPhase",
    label: "Phase wrapping",
    description: "Phase wrapping: WinISD draws every phase curve wrapped into ±180°, but a wrapped curve jumps by 360° each time it passes the edge, so one smooth fall looks like a series of breaks. OpenISD wraps by default too, so its phase charts match WinISD's. Untick this to let the curves run on smoothly past ±180°. It changes every phase chart and nothing else.",
  });
  static readonly ADV_WINISDFLATMODEL = new ToggleField({
    value: "adv_WinisdFlatModel",
    label: "Uncapped flat response",
    description: "Uncapped flat response: when \"Force flat response\" adds EQ to level the curve, WinISD pulls every frequency to the transfer function's 0 dB, cutting as well as boosting, with no limit, but a very large boost asks for far more cone travel than the driver has (the Cone excursion chart shows the cost). OpenISD does the same by default, so it matches WinISD. Untick this to boost only, up to the passband level and never more than 20 dB. It changes \"Force flat response\" only.",
  });
  static readonly ADV_WINISDABCINTRAPORTVELOCITY = new ToggleField({
    value: "adv_WinisdAbcIntraPortVelocity",
    label: "Simplified ABC intra-port velocity",
    description: "Simplified ABC intra-port velocity: WinISD works out the air speed in an ABC box's inner port without a small leak term, Zf·jωMai/Ricl, but that term is part of the real current through the port mass. So its chart is slightly off: by up to 1.35 dB and 4.6° near 110 Hz, and under 0.1 dB elsewhere (W5-1138SMF). OpenISD drops the same term by default, so it matches WinISD. Untick this to use the exact port-mass current. It changes the ABC box's Intra port velocity chart only.",
  }, null, 'intra-port');
  static readonly PROJECT_WINISDISOBARIK = new ToggleField({
    value: "project_winisdIsobarik",
    label: "WinISD's Iso-Barik numbers",
    description: "WinISD shows a sealed W5-1138SMF Iso-Barik pair at 2,830 mV and 2 kHz as 6 dB quieter than one driver, with the same 3.4 Ω impedance. But the pair's wiring changes the load and how much voltage each driver gets, so these numbers can misstate both loudness and amplifier load. OpenISD uses Driver wiring by default. In parallel the pair is as loud as one driver and shows 1.7 Ω. In series it is 6 dB quieter and shows 6.8 Ω. (Tick this to use WinISD's numbers.)",
  });

  static readonly ADV_WINISDONEDRIVERIMPEDANCE = new ToggleField({
    value: "adv_WinisdOneDriverImpedance",
    label: "Impedance of one driver",
    description: "Impedance of one driver: WinISD works out the sound as if the drivers were wired in parallel (each gets the full voltage), but its impedance chart shows only ONE driver, not the load the amplifier really sees with them in parallel (4 × 8 Ω is 2 Ω). So the two do not match. OpenISD shows the load for the wiring you chose under Driver wiring. Tick this to see one driver's impedance as WinISD does; the sound and every other chart stay the same.",
  });

  static readonly ALL: readonly ToggleField[] =
    Object.freeze(Object.values(ToggleField).filter((v): v is ToggleField => v instanceof ToggleField));
}

/** A field holding a date. */
export class DateField extends Field {
  readonly kind = 'date';

  private constructor(spec: FieldSpec) { super(spec); }

  // ── Driver ────────────────────────────────────────────────────────────────────────────────
  static readonly DRIVER_ADDED = new DateField({
    value: "driver_added",
    label: "Date added",
    description: "Date Added\nWhen this driver record was catalogued.",
  });

  static readonly ALL: readonly DateField[] =
    Object.freeze(Object.values(DateField).filter((v): v is DateField => v instanceof DateField));
}

/** Every field OpenISD has, of every kind. Assembled after the classes so no class names
 *  another — each kind enumerates only itself. */
export const ALL_FIELDS: readonly Field[] = Object.freeze([
  ...NumberField.ALL, ...EnumField.ALL, ...TextField.ALL, ...ToggleField.ALL, ...DateField.ALL,
]);
