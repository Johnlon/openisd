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
import {formatFixed} from './format.js';
import type {FieldLimits} from './filterLimits.js';
import {
  FILTER_BW_LIMITS, FILTER_FC_LIMITS, FILTER_GAIN_LIMITS, FILTER_ORDER_LIMITS, FILTER_Q_LIMITS,
  FILTER_T_LIMITS,
} from './filterLimits.js';
import type {SelectorOption} from './options.js';
import {
  ARRAY_WIRING_OPTIONS, BOX_TYPE_OPTIONS, END_CORRECTION_OPTIONS, FILTER_TYPE_OPTIONS,
  SEALED_ALIGNMENT_OPTIONS, VC_CONNECTION_OPTIONS, VENT_SHAPE_OPTIONS,
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

interface NumberFieldSpec extends FieldSpec {
  readonly display: SwitchableUnit | FixedUnit;
  readonly limits: FieldLimits;
  readonly precision: number;
  readonly formula?: string;
  readonly plausible?: FieldLimits;
  readonly floor?: ValueFloor;
}

/** A field holding a quantity: it has a band, a precision, and a display unit. */
export class NumberField extends Field {
  readonly kind = 'number';
  /** How the field is shown: one fixed symbol, or a `UnitGroup` the user may rotate through. */
  readonly display: SwitchableUnit | FixedUnit;
  /** The band an entered value must fall in, in SI/model units. */
  readonly limits: FieldLimits;
  /** Fixed decimal places the field's base unit is meaningful to. */
  readonly precision: number;
  /** Closed form derivation, for a quantity the engine calculates. */
  readonly formula: string | undefined;
  /**
   * The band a REAL driver's value falls in — narrower than `limits`, which is only what the
   * input will accept. A value inside `limits` but outside this is enterable and gets a
   * data-quality warning; `Engine.isPhysicallyPlausible` reads it to throw out a failed scrape.
   * Where nothing narrower is known it IS `limits`, so there is no absent case to handle.
   */
  readonly plausible: FieldLimits;
  /** Whether zero and negatives are admissible at all. `'none'` where nobody has stated one. */
  readonly floor: ValueFloor;

  private constructor(spec: NumberFieldSpec) {
    super(spec);
    this.display = Object.freeze(spec.display);
    this.limits = Object.freeze(spec.limits);
    this.precision = spec.precision;
    this.formula = spec.formula;
    this.plausible = Object.freeze(spec.plausible ?? spec.limits);
    this.floor = spec.floor ?? 'none';
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

  /** Format valueSI or Quantity into display string for this field using unit conversion & precision rules. */
  format(valueSIOrQuantity: number | Quantity, halfWidthSI?: number | null, token?: string): string {
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

    decimals = Math.max(0, Math.min(20, decimals));
    const sanitizedVal = valDisp === 0 ? 0 : valDisp;
    return sanitizedVal.toFixed(decimals);
  }

  /** Parse raw typed string input into a Quantity or Text discriminant for this field. */
  parseEntry(typed: string, token?: string): TypedEntry {
    return parseEntryDim(this.unitFor(token), typed);
  }

  /** Get step attribute string for NumInput / expoStep. */
  stepAttr(token?: string): string {
    const u = this.unitFor(token);
    const dp = decimalsIn(u, this.precision);
    if (dp <= 0) return '1';
    return (1 / Math.pow(10, dp)).toString();
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
  static readonly PLOT_FMIN_HZ = new NumberField({
    value: "plot_fmin_hz",
    label: "Frequency range start",
    display: {kind: 'fixed', symbol: 'Hz'},
    limits: {min: 1, max: 20000},
    precision: 1,
    description: "Plot Start Frequency\nThe lowest frequency every chart draws and the sweep computes.",
  });
  static readonly PLOT_FMAX_HZ = new NumberField({
    value: "plot_fmax_hz",
    label: "Frequency range end",
    display: {kind: 'fixed', symbol: 'Hz'},
    limits: {min: 1, max: 40000},
    precision: 1,
    description: "Plot End Frequency\nThe highest frequency every chart draws and the sweep computes.",
  });

  // ── Box ───────────────────────────────────────────────────────────────────────────────────
  static readonly BOX_VB_L = new NumberField({
    value: "box_Vb_l",
    label: "Volume",
    display: {kind: 'switchable', group: 'volume', base: 'L'},
    limits: {min: 0.0001, max: 100},
    precision: 2,
    description: "Net Enclosure Volume\nInternal net air volume — the acoustic spring the driver works against.",
  });
  static readonly BOX_VF_L = new NumberField({
    value: "box_Vf_l",
    label: "Front volume",
    display: {kind: 'switchable', group: 'volume', base: 'L'},
    limits: {min: 0.0001, max: 100},
    precision: 2,
    description: "Front Chamber Volume\nNet air volume of the front, vented chamber in a bandpass enclosure.",
  });
  static readonly BOX_FB_HZ = new NumberField({
    value: "box_Fb_hz",
    label: "Target Tuning Freq (Fb)",
    display: {kind: 'switchable', group: 'freq', base: 'Hz'},
    limits: {min: 0, max: 1000},
    precision: 2,
    description: "Box Tuning Frequency (Fb)\nHelmholtz resonance of the vented enclosure, set by port dimensions and box volume.",
  });

  // ── Vent ──────────────────────────────────────────────────────────────────────────────────
  static readonly VENT_COUNT = new NumberField({
    value: "vent_Count",
    label: "Number of vents",
    display: {kind: 'fixed', symbol: ''},
    limits: {min: 1, max: 4},
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
    precision: 2,
    description: "Passive Radiator Excursion Limit\nMaximum peak linear displacement of the passive radiator diaphragm.\nDraws the PR excursion limit line; it does not change the response curves.",
  });
  static readonly PR_NUM = new NumberField({
    value: "pr_Num",
    label: "Num. of PRs",
    display: {kind: 'fixed', symbol: ''},
    limits: {min: 1, max: 4},
    precision: 0,
    description: "Passive Radiator Count\nNumber of identical passive radiators in the enclosure.",
  });
  static readonly PR_MADD_G = new NumberField({
    value: "pr_Madd_g",
    label: "Added mass to cone",
    display: {kind: 'switchable', group: 'mass', base: 'g'},
    limits: {min: 0, max: 5000},
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
    precision: 2,
    description: "System Input Power\nTotal electrical power supplied to the system (P = V² / Re).",
  });
  static readonly SIGNAL_DRIVEV_V = new NumberField({
    value: "signal_DriveV_V",
    label: "Driver input voltage (each)",
    display: {kind: 'fixed', symbol: 'V'},
    limits: {min: 0.01, max: 1000},
    precision: 2,
    formula: "driveV = √(Pin · Re)",
    description: "Driver Terminal Voltage\nRMS voltage across the driver's voice-coil terminals (V = √(P · Re)).",
  });
  static readonly SIGNAL_RS_OHM = new NumberField({
    value: "signal_Rs_ohm",
    label: "Series resistance",
    display: {kind: 'fixed', symbol: 'ohm'},
    limits: {min: 0, max: 1000},
    precision: 3,
    description: "Series Resistance\nCombined amplifier output impedance, wiring and crossover resistance, in series with the driver.",
  });
  static readonly SIGNAL_DISTANCE_M = new NumberField({
    value: "signal_Distance_m",
    label: "Distance",
    display: {kind: 'fixed', symbol: 'm'},
    limits: {min: 0, max: 100},
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
    precision: 2,
    description: "Enclosure Leakage Loss Q\nAcoustic energy lost through cabinet seams and gaskets.",
  });
  static readonly LOSS_QA = new NumberField({
    value: "loss_Qa",
    label: "Absorption Qa",
    display: {kind: 'fixed', symbol: ''},
    limits: {min: 0.1, max: 1000},
    precision: 2,
    description: "Enclosure Damping Loss Q\nAcoustic energy absorbed by internal damping fill.",
  });
  static readonly LOSS_QP = new NumberField({
    value: "loss_Qp",
    label: "Port Qp",
    display: {kind: 'fixed', symbol: ''},
    limits: {min: 0.1, max: 1000},
    precision: 2,
    description: "Port Friction Loss Q\nAir friction and viscous boundary losses inside the vent.",
  });

  // ── Advanced ──────────────────────────────────────────────────────────────────────────────
  static readonly ADV_TEMP_K = new NumberField({
    value: "adv_Temp_K",
    label: "Temperature",
    display: {kind: 'switchable', group: 'temp', base: 'K'},
    limits: {min: 173.15, max: 373.15},
    precision: 2,
    description: "Ambient Temperature\nUsed to calculate the speed of sound and the density of air.",
  });
  static readonly ADV_HUMIDITY_PCT = new NumberField({
    value: "adv_Humidity_pct",
    label: "Relative humidity",
    display: {kind: 'fixed', symbol: '%'},
    limits: {min: 0, max: 100},
    precision: 2,
    description: "Relative Humidity\nAffects the speed of sound and the density of the air.",
  });
  static readonly ADV_PRESSURE_KPA = new NumberField({
    value: "adv_Pressure_kPa",
    label: "Air pressure",
    display: {kind: 'switchable', group: 'pressure', base: 'Pa'},
    limits: {min: 1000, max: 200000},
    precision: 2,
    description: "Air Pressure\nAtmospheric pressure — affects air density and acoustic impedance.",
  });
  static readonly ADV_SOUNDVELOCITY_M_PER_S = new NumberField({
    value: "adv_SoundVelocity_m_per_s",
    label: "Sound velocity",
    display: {kind: 'fixed', symbol: 'm/s'},
    limits: {min: 0, max: 1000},
    precision: 2,
    formula: "c = √(γ·p/ρ), γ = 1.4",
    description: "Speed of Sound\nHow fast an acoustic wave travels through air, at the stated conditions.",
  });
  static readonly ADV_AIRDENSITY_KG_PER_M3 = new NumberField({
    value: "adv_AirDensity_kg_per_m3",
    label: "Air density",
    display: {kind: 'fixed', symbol: 'kg/m³'},
    limits: {min: 0, max: 10},
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
    limits: {min: 0, max: 5},
    floor: "positive",
    precision: 3,
    plausible: {min: 0.01, max: 5.0},
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
    display: {kind: 'fixed', symbol: 'ohm'},
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
    plausible: {min: 0.0, max: 0.1},
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
    plausible: {min: 1.0, max: 20000.0},
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
    plausible: {min: 0.0, max: 200.0},
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
    description: "Acceleration Factor (gamma)\nMotor force per unit moving mass (Bl/Mms) — initial cone acceleration per amp.",
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
    label: "Basket Plate Thickness (Thick)",
    display: {kind: 'switchable', group: 'length', base: 'mm'},
    limits: {min: 0, max: 0.3},
    floor: "positive",
    precision: 2,
    description: "Basket Flange Thickness\nFrame flange thickness at the mounting boundary.",
  });
  static readonly DEPTH_M = new NumberField({
    value: "Depth_m",
    label: "Driver Depth (Depth)",
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
    label: "Magnet Diameter (Magnet)",
    display: {kind: 'switchable', group: 'length', base: 'mm'},
    limits: {min: 0, max: 5},
    floor: "positive",
    precision: 2,
    description: "Magnet Diameter\nOuter diameter of the motor magnet.",
  });
  static readonly BASKET_M = new NumberField({
    value: "Basket_m",
    label: "Basket Diameter (Basket)",
    display: {kind: 'switchable', group: 'length', base: 'mm'},
    limits: {min: 0, max: 5},
    floor: "positive",
    precision: 2,
    description: "Basket Diameter\nOuter diameter of the frame/chassis.",
  });
  static readonly OUTER_M = new NumberField({
    value: "Outer_m",
    label: "Outer Diameter (Outer)",
    display: {kind: 'switchable', group: 'length', base: 'mm'},
    limits: {min: 0, max: 5},
    floor: "positive",
    precision: 2,
    description: "Outer Mounting Diameter\nOverall diameter of the front mounting flange.",
  });
  static readonly VCD_M = new NumberField({
    value: "Vcd_m",
    label: "Voice Coil Dia (Vcd)",
    display: {kind: 'switchable', group: 'length', base: 'mm'},
    limits: {min: 0, max: 1},
    floor: "positive",
    precision: 2,
    description: "Voice Coil Diameter\nFormer diameter of the coil winding.",
  });
  static readonly DVOL_M3 = new NumberField({
    value: "DVol_m3",
    label: "Driver Displacement Volume (DVol)",
    display: {kind: 'switchable', group: 'volume', base: 'cm3'},
    limits: {min: 0, max: 1},
    floor: "positive",
    precision: 2,
    description: "Driver Displacement Volume\nVolume the motor and basket occupy inside the enclosure.",
  });
  static readonly ZNOM_OHM = new NumberField({
    value: "Znom_ohm",
    label: "Znom",
    display: {kind: 'fixed', symbol: 'ohm'},
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
    description: "Reference Speed of Sound (c)\nSpeed of sound at this driver record's reference conditions. Display only — no calculation reads this field; the project's own air is used everywhere. Purpose unconfirmed: may just record the condition the driver was measured at, or may be meant to adapt the driver's readings to the project's air. Speculation, 2026-09-26.",
  });
  static readonly ROO_KG_PER_M3 = new NumberField({
    value: "roo_kg_per_m3",
    label: "roo",
    display: {kind: 'switchable', group: 'density', base: 'kgPerM3'},
    limits: {min: 0, max: 10},
    floor: "positive",
    precision: 5,
    description: "Reference Air Density (roo)\nAir density at this driver record's reference conditions. Display only — no calculation reads this field; the project's own air is used everywhere. Purpose unconfirmed: may just record the condition the driver was measured at, or may be meant to adapt the driver's readings to the project's air. Speculation, 2026-09-26.",
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
    precision: 2,
    description: "Rear Chamber Tuning Frequency (Frc)\nTarget Helmholtz tuning for the vented rear chamber in a 6th-order bandpass or ABC box.",
  });

  // ── Driver ────────────────────────────────────────────────────────────────────────────────
  static readonly DRIVER_NDRIVERS = new NumberField({
    value: "driver_nDrivers",
    label: "Num. of drivers",
    display: {kind: 'fixed', symbol: ''},
    limits: {min: 1, max: 64},
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
  });
  static readonly FILTER_Q = new NumberField({
    value: "filter_Q",
    label: "Q",
    display: {kind: 'fixed', symbol: ''},
    limits: FILTER_Q_LIMITS,
    precision: 3,
    description: "Filter Quality Factor (Q)\nHow sharp the filter's resonance peak or its damping is.",
  });
  static readonly FILTER_GAIN_DB = new NumberField({
    value: "filter_Gain_dB",
    label: "Gain",
    display: {kind: 'fixed', symbol: 'dB'},
    limits: FILTER_GAIN_LIMITS,
    precision: 3,
    description: "Filter Gain\nBoost or cut applied by the filter or equalizer, in dB.",
  });
  static readonly FILTER_ORDER = new NumberField({
    value: "filter_Order",
    label: "Order",
    display: {kind: 'fixed', symbol: ''},
    limits: FILTER_ORDER_LIMITS,
    precision: 3,
    description: "Filter Order\nFilter steepness: 1st order = 6 dB/oct, 2nd = 12 dB/oct, 4th = 24 dB/oct. Up to 20.\nWinISD stops at order 10 (above that it hits a floating-point overflow error); a project with a higher order shows that error in WinISD.",
  });
  static readonly FILTER_T_S = new NumberField({
    value: "filter_T_s",
    label: "t",
    display: {kind: 'fixed', symbol: 's'},
    limits: FILTER_T_LIMITS,
    precision: 4,
    description: "Allpass Delay Time\nGroup-delay time constant of an allpass filter section.",
  });
  static readonly FILTER_BW_OCT = new NumberField({
    value: "filter_BW_oct",
    label: "BW",
    display: {kind: 'fixed', symbol: 'oct'},
    limits: FILTER_BW_LIMITS,
    precision: 3,
    description: "DLP Raised-Cosine Bandwidth\nWidth of the raised-cosine transition band, in octaves.",
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
    label: "Connection",
    options: VC_CONNECTION_OPTIONS,
    description: "Voice Coil Wiring\nSeries or parallel — sets the driver's total terminal Re and BL for a multi-coil driver.",
  });
  static readonly DRIVER_ARRAYWIRING = new EnumField({
    value: "driver_ArrayWiring",
    label: "Voice coil connection",
    options: ARRAY_WIRING_OPTIONS,
    description: "Driver Array Wiring\nParallel or series — sets the total load impedance seen by the amplifier.",
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

  private constructor(spec: FieldSpec, seenIn: string | null = null) {
    super(seenIn === null ? spec : {...spec, description: `${spec.description}\nSeen in: ${seenIn}`});
    this.seenIn = seenIn;
  }

  // ── Advanced ──────────────────────────────────────────────────────────────────────────────
  static readonly ADV_SIMVCINDUCTANCE = new ToggleField({
    value: "adv_SimVcInductance",
    label: "Simulate voice coil inductance",
    description: "Simulate Voice Coil Inductance\nApplies Le to the acoustic output too, not just the impedance plot.",
  });
  static readonly ADV_FORCEFLATRESPONSE = new ToggleField({
    value: "adv_ForceFlatResponse",
    label: "Force flat response",
    description: "Force Flat Response\nApplies auto-equalization, revealing the excursion and port velocity a flat passband would demand.",
  });
  static readonly ADV_TLPORTMODEL = new ToggleField({
    value: "adv_TlPortModel",
    label: "Use \"transmission line\"-model for port simulation",
    description: "Transmission Line Port Model\nModels the vent as a distributed transmission line, adding its internal organ-pipe resonances to the response curves.",
  });
  static readonly ADV_RGATDRIVERSIDE = new ToggleField({
    value: "adv_RgAtDriverSide",
    label: "Rg is at driver side",
    description: "Rg Placement\nApplies the series resistance Rg to each driver individually, rather than once at the amplifier output.",
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
    description: "Two-BL driver: WinISD mixes the entered BL with the BL implied by Fs, Qes and Vas.\nTicked (as WinISD): the simulation uses two BLs. The damping comes from the driver WinISD acts on: Cms from Vas, then Mms, Rms and BL from Fs, Qms and Qes. The entered BL sets the loudness and, with voice coil inductance on, the inductance roll-off. We judge the two-BL mix a WinISD bug.\nUnticked (the default, bug fixed): the simulation uses the entered datasheet values, one BL throughout.",
  }, "every chart, only when the entered driver values disagree with Fs, Vas, Qes and Qms. W5-1138SMF (entered BL 7.17, implied 7.384): SPL chart 0.26 dB in the passband; Impedance chart peak about 1.2 Ω (8 %) high; Transfer function magnitude chart 0.51 dB.");
  static readonly ADV_WINISDVAMODEL = new ToggleField({
    value: "adv_WinisdVaModel",
    label: "Re without Rg",
    description: "Re without Rg: WinISD uses Re where the amplifier sees Re + Rg. Both give the same result when Rg is 0.\nTicked (as WinISD): VA = P·Re/|Z + Rg|, low by Re/(Re + Rg); with 'Rg is at driver side' on, Z already includes Rg and WinISD adds it again. Power and voltage: P = N·V²/Re, while the SPL chart drives that power into Re + Rg.\nUnticked (the default, bug fixed): Re + Rg throughout. VA = P·(Re + Rg)/|Z seen by the amplifier|, Rg counted once; P = N·V²/(Re + Rg).\nP: input power. V: driver input voltage (each). N: number of drivers. Z: the impedance chart. Rg: the series resistance.",
  }, "Amplifier apparent load power (VA) chart, about 23 % low at Re 3.4 Ω, Rg 1 Ω; Signal tab System input power readout, 4.0 W against 3.91 W at 1.85 V each × 4 drivers, Re 3.4 Ω, Rg 0.1 Ω; with the voltage typed, the SPL chart about 0.1 dB louder there.");
  static readonly ADV_WINISDPRNPRRESONANCE = new ToggleField({
    value: "adv_WinisdPrNprResonance",
    label: "PR Npr resonance",
    description: "PR Npr resonance: WinISD takes the passive radiator box's losses at a frequency Npr times too low.\nTicked (as WinISD): the box's leak and absorption are taken at WinISD's frequency 1/√(Npr·Map·(Cab ∥ Npr·Cap)). The radiator mass is multiplied by Npr where the tuning divides by it.\nUnticked (the default, bug fixed): the same losses taken at the physical tuning 1/√((Map/Npr)·(Cab ∥ Npr·Cap)).",
  }, "passive radiator box with more than one radiator (Npr > 1), WinISD lossy model; none at Npr = 1. Npr 2, W5 in 10 L, radiator Fs 30 Hz and Vas 4.8 L (WinISD 21 Hz, tuning 42 Hz): Impedance chart up to 1 Ω, Transfer function magnitude chart up to 2 dB.");
  static readonly ADV_WINISDBESSELHIGHPASS = new ToggleField({
    value: "adv_WinisdBesselHighpass",
    label: "Bessel high-pass",
    description: "Bessel high-pass: WinISD's Bessel high-pass is not the mirror of its low-pass.\nTicked (as WinISD): the high-pass keeps the low-pass's own denominator with the numerator swapped to (k·s)^n.\nUnticked (the default, bug fixed): the mirror of the low-pass, s → 1/s.",
  }, "Bessel high-pass filters of order 2 or more in the EQ/Filter chain: the three (EQ/Filter) charts and every chart the filter feeds (SPL, Cone excursion, port velocities), up to 6 % in complex response at order 4, fc 25 Hz. Butterworth, Linkwitz-Riley, SOS, every low-pass and a first-order Bessel are unchanged.");
  static readonly ADV_WINISDABCGROUPDELAY = new ToggleField({
    value: "adv_WinisdAbcGroupDelay",
    label: "ABC group delay",
    description: "ABC group delay: WinISD's ABC group delay leaves the driver out.\nTicked (as WinISD): the group delay steps the box to f ± 1e-10 Hz but keeps the driver at the chart frequency f, so the driver's own phase slope is left out. It disagrees with WinISD's own phase chart.\nUnticked (the default, bug fixed): the group delay is −dφ/dω of the plotted phase.",
  }, "Group Delay chart of an ABC box only. W5-1138SMF ABC: −41.0 ms against −33.9 ms at 1 Hz, −3.3 ms against +3.6 ms at 10.75 Hz.");

  static readonly ADV_WINISDDRIVERCOUNTMODEL = new ToggleField({
    value: "adv_WinisdDriverCountModel",
    label: "Per-driver impedance",
    description: "Per-driver impedance: with more than one driver, WinISD's impedance chart shows one driver's impedance.\nTicked (as WinISD): the impedance chart shows one driver's impedance.\nUnticked (the default, bug fixed): the impedance chart shows the array the amplifier drives, per the project's wiring: one driver's divided by N in parallel, times N in series.",
  }, "Impedance chart, designs with more than one driver. W5-1138SMF sealed, 4 drivers in parallel: WinISD peaks at 18.6 Ω, the array at 4.65 Ω. SPL, Cone excursion, Amplifier apparent load power (VA) and Maximum Power are WinISD's either way.");

  // ── WinISD Compatibility: options (under "Enable WinISD-style", named by the calculation; ticked is WinISD's way) ──────
  static readonly ADV_WINISDWRAPPHASE = new ToggleField({
    value: "adv_WinisdWrapPhase",
    label: "Phase wrapping",
    description: "Phase wrapping: affects every phase chart.\nTicked (the default, as WinISD): phase curves wrap at ±180°.\nUnticked: phase curves stay continuous and unwrapped.",
  });
  static readonly ADV_WINISDFLATMODEL = new ToggleField({
    value: "adv_WinisdFlatModel",
    label: "Uncapped flat response",
    description: "Uncapped flat response: affects 'Force flat response' only.\nTicked (the default, as WinISD): every frequency is set to the transfer function's 0 dB, cut as well as boosted, uncapped; excursion shows what that costs.\nUnticked: boost only, up to the passband level, capped at 20 dB.",
  });
  static readonly ADV_WINISDABCINTRAPORTVELOCITY = new ToggleField({
    value: "adv_WinisdAbcIntraPortVelocity",
    label: "Simplified ABC intra-port velocity",
    description: "Simplified ABC intra-port velocity: affects the ABC box's Intra port velocity chart only.\nTicked (the default, as WinISD): the intra-port velocity leaves out the leak term Zf·jωMai/Ricl.\nUnticked: the exact port-mass current. Differs by up to 1.35 dB and 4.6° near 110 Hz, under 0.1 dB elsewhere (W5-1138SMF, abc-w5-1).\nOnly on an ABC box.",
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
