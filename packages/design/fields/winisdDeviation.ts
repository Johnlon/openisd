import type {ErrorSwitchState, ErrorSwitchStates} from '../domain/project/errorSwitches.js';
import type {Filter} from '../engine/index.js';
import {ToggleField} from './field.js';

/** What a WinISD deviation cue shows, and the error switch it belongs to. */
export interface WinisdDeviationSpec {
  /** One line naming the WinISD bug. */
  readonly title: string;
  /** The WinISD bug and what OpenISD does instead, in plain words. */
  readonly explanation: string;
  /** How large the difference is, for a realistic case. */
  readonly size: string;
  /** The error switch's label in "WinISD errors". */
  readonly switchLabel: string;
  /** The error switch's state in the project's `errorSwitches`. */
  readonly switchOf: (s: ErrorSwitchStates) => ErrorSwitchState;
}

/** A filter deviation's spec: also which filters in the chain it changes. */
export interface WinisdFilterDeviationSpec extends WinisdDeviationSpec {
  /** The filter's own result differs from WinISD's while the deviation is in effect. */
  readonly affects: (f: Filter) => boolean;
}

/**
 * A place OpenISD's result differs from WinISD's because OpenISD fixed a WinISD calculation bug.
 * In effect while its error switch applies and is not reproducing the error; ticking that switch
 * brings WinISD's result back.
 */
export class WinisdDeviation {
  readonly title: string;
  readonly explanation: string;
  readonly size: string;
  readonly switchLabel: string;
  readonly #switchOf: (s: ErrorSwitchStates) => ErrorSwitchState;

  protected constructor(spec: WinisdDeviationSpec) {
    this.title = spec.title;
    this.explanation = spec.explanation;
    this.size = spec.size;
    this.switchLabel = spec.switchLabel;
    this.#switchOf = spec.switchOf;
  }

  /** OpenISD differs from WinISD now: the switch applies and is not reproducing the error. */
  inEffect(s: ErrorSwitchStates): boolean {
    const state = this.#switchOf(s);
    return state.applicable && !state.reproducesError;
  }

  static readonly DRIVER_MODEL = new WinisdDeviation({
    title: 'WinISD mixes two BL values',
    explanation: 'WinISD drives the cone with the entered BL but damps it with the BL implied by Fs, Qes and Vas. OpenISD uses one BL throughout, from the entered datasheet values.',
    size: 'W5-1138SMF (entered BL 7.17, implied 7.384): passband SPL 0.26 dB, impedance peak about 8 % apart.',
    switchLabel: 'WinISD driver model',
    switchOf: s => s.driverModel,
  });

  static readonly VA_MODEL = new WinisdDeviation({
    title: 'WinISD VA uses Re, not Re + Rg',
    explanation: 'WinISD\'s amplifier load (VA) chart uses Re where the amplifier sees Re + Rg, and with "Rg is at driver side" on it counts Rg twice. OpenISD counts Rg once.',
    size: 'Re 3.4 Ω, Rg 1 Ω: WinISD reads 23 % (1.1 dB) low.',
    switchLabel: 'WinISD VA model',
    switchOf: s => s.vaModel,
  });

  static readonly ABC_INTRA_PORT_VELOCITY = new WinisdDeviation({
    title: 'WinISD ABC intra-port velocity leaves out the leak',
    explanation: 'WinISD\'s ABC Intra port velocity chart leaves out the leak term Zf·jωMai/Ricl. OpenISD shows the exact port-mass current.',
    size: 'Up to 1.35 dB and 4.6° near 110 Hz, under 0.1 dB elsewhere (W5-1138SMF, abc-w5-1).',
    switchLabel: ToggleField.ADV_WINISDABCINTRAPORTVELOCITY.label,
    switchOf: s => s.abcIntraPortVelocity,
  });

  static readonly PR_NPR_RESONANCE = new WinisdDeviation({
    title: 'WinISD takes passive radiator losses at the wrong frequency',
    explanation: 'With more than one passive radiator, WinISD multiplies the radiator mass by Npr where the tuning divides by it, so it takes the box losses at a frequency Npr times too low. OpenISD takes them at the physical tuning.',
    size: 'Npr 2, W5 in 10 L, radiator Fs 30 Hz: WinISD 21 Hz, tuning 42 Hz; impedance up to 1 Ω and transfer function up to 2 dB apart.',
    switchLabel: ToggleField.ADV_WINISDPRNPRRESONANCE.label,
    switchOf: s => s.prNprResonance,
  });

  /** The project-wide members, by reflection; declared last. */
  static readonly ALL: readonly WinisdDeviation[] =
    Object.freeze(Object.values(WinisdDeviation).filter((v): v is WinisdDeviation => v instanceof WinisdDeviation));
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
    explanation: 'WinISD draws every allpass of order 2 or more as one 2nd-order section with ω0 = 2/t, so its delay is t/Q, not the t you entered, and orders 3 to 10 draw exactly order 2. OpenISD draws the order-n Bessel (maximally flat delay) allpass: delay t at every order, flat to a higher frequency as the order rises. Q is not used.',
    size: 't 3 ms, Q 0.6: WinISD delays 5.0 ms at every order from 2 up; OpenISD 3.0 ms.',
    switchLabel: ToggleField.ADV_WINISDALLPASSORDER.label,
    switchOf: s => s.allpassOrder,
    affects: f => f.type === 'allpass' && f.order >= 2,
  });

  static readonly BESSEL_HIGHPASS = new WinisdFilterDeviation({
    title: 'WinISD\'s Bessel high-pass is not the mirror of its low-pass',
    explanation: 'WinISD keeps the Bessel low-pass\'s own denominator and swaps the numerator to (k·s)^n. That is not a Bessel high-pass. OpenISD draws the mirror of the low-pass (s → 1/s).',
    size: 'Order 4, fc 25 Hz: up to 6 % apart in complex response. Order 1 is the same.',
    switchLabel: ToggleField.ADV_WINISDBESSELHIGHPASS.label,
    switchOf: s => s.besselHighpass,
    affects: f => f.type === 'highpass' && f.family === 'bessel' && f.order >= 2,
  });

  /** Every member, by reflection; declared last. */
  static override readonly ALL: readonly WinisdFilterDeviation[] =
    Object.freeze(Object.values(WinisdFilterDeviation).filter((v): v is WinisdFilterDeviation => v instanceof WinisdFilterDeviation));
}
