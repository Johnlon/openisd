import type {ErrorSwitchState, ErrorSwitchStates} from '../domain/project/errorSwitches.js';
import type {ChartId, Filter} from '../engine/index.js';
import {ToggleField} from './field.js';

/** A WinISD calculation bug: the yellow bug switch in "WinISD bugs" brings it back. */
export interface ErrorSwitchFix {
  readonly kind: 'errorSwitch';
  /** The bug switch's label in "WinISD bugs". */
  readonly switchLabel: string;
  /** The bug switch's state in the project's `errorSwitches`. */
  readonly switchOf: (s: ErrorSwitchStates) => ErrorSwitchState;
}

/** An input WinISD ignores: a plain bug, no switch (John, 2026-10-04). Always in effect where it applies. */
export interface IgnoredInputFix {
  readonly kind: 'ignoredInput';
}

export type WinisdDeviationFix = ErrorSwitchFix | IgnoredInputFix;

/** What a WinISD deviation cue shows, and how OpenISD's fix relates to WinISD. */
export interface WinisdDeviationSpec {
  /** One line naming the WinISD bug. */
  readonly title: string;
  /** The WinISD bug and what OpenISD does instead, in plain words. */
  readonly explanation: string;
  /** How large the difference is, for a realistic case. */
  readonly size: string;
  readonly fix: WinisdDeviationFix;
  /** The charts whose curves differ from WinISD's while the deviation is in effect; its cue sits by
   *  the chart picker while one is open. Empty: the cue sits by a control instead. */
  readonly charts: readonly ChartId[];
}

/** A filter deviation's spec: also which filters in the chain it changes. */
export interface WinisdFilterDeviationSpec extends WinisdDeviationSpec {
  /** The filter's own result differs from WinISD's while the deviation is in effect. */
  readonly affects: (f: Filter) => boolean;
}

/**
 * A place OpenISD's result differs from WinISD's because OpenISD fixed a WinISD bug. A calculation
 * bug is in effect while its error switch applies and is not reproducing the error; an ignored
 * input is always in effect.
 */
export class WinisdDeviation {
  readonly title: string;
  readonly explanation: string;
  readonly size: string;
  /** What brings WinISD's behaviour back, in plain words. */
  readonly remedy: string;
  readonly #fix: WinisdDeviationFix;
  readonly #charts: readonly ChartId[];

  protected constructor(spec: WinisdDeviationSpec) {
    this.title = spec.title;
    this.explanation = spec.explanation;
    this.size = spec.size;
    this.#fix = spec.fix;
    this.#charts = spec.charts;
    this.remedy = remedyOf(spec.fix);
  }

  /** OpenISD differs from WinISD now. */
  inEffect(s: ErrorSwitchStates): boolean {
    switch (this.#fix.kind) {
      case 'errorSwitch': {
        const state = this.#fix.switchOf(s);
        return state.applicable && !state.reproducesError;
      }
      case 'ignoredInput': return true;
    }
  }

  /** In effect now and `id`'s curves differ from WinISD's. */
  inEffectOnChart(s: ErrorSwitchStates, id: ChartId): boolean {
    return this.#charts.includes(id) && this.inEffect(s);
  }

  static readonly DRIVER_MODEL = new WinisdDeviation({
    title: 'WinISD mixes two BL values',
    explanation: 'WinISD drives the cone with the entered BL but damps it with the BL implied by Fs, Qes and Vas. OpenISD uses one BL throughout, from the entered datasheet values.',
    size: 'W5-1138SMF (entered BL 7.17, implied 7.384): passband SPL 0.26 dB, impedance peak about 8 % apart.',
    fix: {kind: 'errorSwitch', switchLabel: ToggleField.ADV_WINISDDRIVERMODEL.label, switchOf: s => s.driverModel},
    charts: [],
  });

  static readonly VA_MODEL = new WinisdDeviation({
    title: 'WinISD VA uses Re, not Re + Rg',
    explanation: 'WinISD\'s amplifier load (VA) chart uses Re where the amplifier sees Re + Rg, and with "Rg is at driver side" on it counts Rg twice. OpenISD counts Rg once.',
    size: 'Re 3.4 Ω, Rg 1 Ω: WinISD reads 23 % (1.1 dB) low.',
    fix: {kind: 'errorSwitch', switchLabel: ToggleField.ADV_WINISDVAMODEL.label, switchOf: s => s.vaModel},
    charts: ['VA'],
  });

  static readonly PR_NPR_RESONANCE = new WinisdDeviation({
    title: 'WinISD takes passive radiator losses at the wrong frequency',
    explanation: 'With more than one passive radiator, WinISD multiplies the radiator mass by Npr where the tuning divides by it, so it takes the box losses at a frequency Npr times too low. OpenISD takes them at the physical tuning.',
    size: 'Npr 2, W5 in 10 L, radiator Fs 30 Hz: WinISD 21 Hz, tuning 42 Hz; impedance up to 1 Ω and transfer function up to 2 dB apart.',
    fix: {kind: 'errorSwitch', switchLabel: ToggleField.ADV_WINISDPRNPRRESONANCE.label, switchOf: s => s.prNprResonance},
    charts: [],
  });

  static readonly ABC_GROUP_DELAY = new WinisdDeviation({
    title: 'WinISD\'s ABC group delay leaves the driver out',
    explanation: 'WinISD steps the ABC box to f ± 1e-10 Hz for the group delay but keeps the driver at the chart frequency f, so its group delay is the phase slope of the box alone and disagrees with its own phase chart. OpenISD plots −dφ/dω of the plotted phase.',
    size: 'W5-1138SMF ABC: WinISD −41.0 ms, phase slope −33.9 ms at 1 Hz; −3.3 ms against +3.6 ms at 10.75 Hz; 1.46 ms against 2.39 ms at 116 Hz.',
    fix: {kind: 'errorSwitch', switchLabel: ToggleField.ADV_WINISDABCGROUPDELAY.label, switchOf: s => s.abcGroupDelay},
    charts: ['GD'],
  });

  static readonly DRIVER_COUNT = new WinisdDeviation({
    title: 'WinISD simulates each driver alone',
    explanation: 'With more than one driver, WinISD simulates N copies of one driver, each in Vb/N fed P/N, so its impedance and amplifier VA charts show one driver\'s load, not the array the amplifier drives. OpenISD wires the N voice coils, in parallel or series as the project says, into one load.',
    size: 'Two 4 Ω drivers in parallel: WinISD shows about 4 Ω where the amplifier sees about 2 Ω; in series, about 8 Ω.',
    fix: {kind: 'errorSwitch', switchLabel: ToggleField.ADV_WINISDDRIVERCOUNTMODEL.label, switchOf: s => s.driverCount},
    charts: [],
  });

  /** The project-wide members, by reflection; declared last. */
  static readonly ALL: readonly WinisdDeviation[] =
    Object.freeze(Object.values(WinisdDeviation).filter((v): v is WinisdDeviation => v instanceof WinisdDeviation));
}

function remedyOf(fix: WinisdDeviationFix): string {
  switch (fix.kind) {
    case 'errorSwitch': return `Tick "${fix.switchLabel}" under WinISD bugs (Advanced) to bring WinISD's behaviour back.`;
    case 'ignoredInput': return 'WinISD ignores this input, so OpenISD has no switch to copy it: set the value WinISD draws to see WinISD\'s result.';
  }
}

/** A deviation that changes particular filters in the EQ/Filter chain; its cue sits on the filter. */
export class WinisdFilterDeviation extends WinisdDeviation {
  readonly #affects: (f: Filter) => boolean;

  private constructor(spec: WinisdFilterDeviationSpec) {
    super(spec);
    this.#affects = spec.affects;
  }

  /** OpenISD draws `f` differently from WinISD now: in effect, and `f` is enabled and affected. */
  inEffectFor(s: ErrorSwitchStates, f: Filter): boolean {
    return this.inEffect(s) && f.enabled && this.#affects(f);
  }

  static readonly ALLPASS_ORDER = new WinisdFilterDeviation({
    title: 'WinISD ignores allpass orders above 2',
    explanation: 'WinISD draws an allpass of order 3 or more exactly as order 2: one 2nd-order section with ω0 = 2/t, delay t/Q. OpenISD honours the order: above 2 it draws the order-n Bessel (maximally flat delay) allpass, delay t, flat to a higher frequency as the order rises; Q is not used there. Orders 1 and 2 are WinISD\'s own.',
    size: 't 3 ms, Q 0.6, order 4: WinISD delays 5.0 ms (its order 2); OpenISD 3.0 ms.',
    fix: {kind: 'ignoredInput'},
    charts: [],
    affects: f => f.type === 'allpass' && f.order > 2,
  });

  static readonly LINKWITZ_RILEY_ORDER = new WinisdFilterDeviation({
    title: 'WinISD ignores the Linkwitz-Riley order',
    explanation: 'WinISD always draws a 4th-order Linkwitz-Riley, whatever the Order box says (a typed 2 or 6 reopens as 4). OpenISD honours the order: a Linkwitz-Riley of even order n is Butterworth(n/2) squared.',
    size: 'Low-pass an octave above fc: LR2 −7.0 dB, LR4 (WinISD) −24.6 dB; phase at fc −90° against −180°.',
    fix: {kind: 'ignoredInput'},
    charts: [],
    affects: f => (f.type === 'lowpass' || f.type === 'highpass') && f.family === 'linkwitzRiley' && f.order !== 4,
  });

  static readonly BESSEL_HIGHPASS = new WinisdFilterDeviation({
    title: 'WinISD\'s Bessel high-pass is not the mirror of its low-pass',
    explanation: 'WinISD keeps the Bessel low-pass\'s own denominator and swaps the numerator to (k·s)^n. That is not a Bessel high-pass. OpenISD draws the mirror of the low-pass (s → 1/s).',
    size: 'Order 4, fc 25 Hz: up to 6 % apart in complex response. Order 1 is the same.',
    fix: {kind: 'errorSwitch', switchLabel: ToggleField.ADV_WINISDBESSELHIGHPASS.label, switchOf: s => s.besselHighpass},
    charts: [],
    affects: f => f.type === 'highpass' && f.family === 'bessel' && f.order >= 2,
  });

  /** Every member, by reflection; declared last. */
  static override readonly ALL: readonly WinisdFilterDeviation[] =
    Object.freeze(Object.values(WinisdFilterDeviation).filter((v): v is WinisdFilterDeviation => v instanceof WinisdFilterDeviation));
}
