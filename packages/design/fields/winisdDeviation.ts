import type {ErrorSwitchState, ErrorSwitchStates} from '../domain/project/errorSwitches.js';
import type {ChartId, Filter} from '../engine/index.js';
import {ToggleField} from './field.js';

/** A WinISD calculation bug: the yellow bug switch under "Enable WinISD bugs" brings it back. */
export interface ErrorSwitchFix {
  readonly kind: 'errorSwitch';
  /** The bug switch under "Enable WinISD bugs": its label and its "Seen in" line. */
  readonly switchField: ToggleField;
  /** The bug switch's state in the project's `errorSwitches`. */
  readonly switchOf: (s: ErrorSwitchStates) => ErrorSwitchState;
}

/** An input WinISD ignores: a plain bug, no switch (John, 2026-10-04). Always in effect where it applies. */
export interface IgnoredInputFix {
  readonly kind: 'ignoredInput';
  /** The charts and readouts the ignored input shows in. */
  readonly seenIn: string;
}

export type WinisdDeviationFix = ErrorSwitchFix | IgnoredInputFix;

/** What a WinISD deviation cue shows, and how OpenISD's fix relates to WinISD. */
export interface WinisdDeviationSpec {
  /** One line naming the WinISD bug. */
  readonly title: string;
  /** What WinISD does, in plain words. */
  readonly winisd: string;
  /** What OpenISD does instead, in plain words. */
  readonly openisd: string;
  /** How large the difference is, for a realistic case. */
  readonly size: string;
  readonly fix: WinisdDeviationFix;
  /** The charts whose curves the bug concerns; its cue sits by the chart picker while one is open.
   *  Empty: the cue sits by a control instead. */
  readonly charts: readonly ChartId[];
}

/** A filter deviation's spec: also which filters in the chain it concerns. */
export interface WinisdFilterDeviationSpec extends WinisdDeviationSpec {
  /** The filter is of the kind the bug concerns (type and family), whatever its order or enabled
   *  state: its editor carries the cue. */
  readonly concerns: (f: Filter) => boolean;
}

/**
 * A place OpenISD's result differs from WinISD's because OpenISD fixed a WinISD bug.
 *
 * Cue rule (John, 2026-10-05): the ≠W cue shows while the bug is fixed — its error switch is
 * unticked; an ignored input has no switch and is always fixed — on a project of the kind the bug
 * concerns: the box type for a box bug, the filter type and family for a filter bug. Counts,
 * orders and enabled state never hide it, so a cue teaches before the setting that triggers the
 * bug is reached (Npr 1, one driver, an order-4 Linkwitz-Riley). The switch's own `applicable`
 * still greys it where it does nothing. The app's Options setting can hide every cue.
 */
export class WinisdDeviation {
  readonly title: string;
  readonly winisd: string;
  readonly openisd: string;
  readonly size: string;
  /** What brings WinISD's behaviour back, in plain words. */
  readonly remedy: string;
  /** The charts and readouts the deviation shows in: a bug switch's "Seen in" line, or the
   *  ignored input's own. */
  readonly seenIn: string;
  /** The bug switch that brings WinISD's behaviour back; null for an ignored input. */
  readonly control: ToggleField | null;
  readonly #fix: WinisdDeviationFix;
  readonly #charts: readonly ChartId[];

  protected constructor(spec: WinisdDeviationSpec) {
    this.title = spec.title;
    this.winisd = spec.winisd;
    this.openisd = spec.openisd;
    this.size = spec.size;
    this.#fix = spec.fix;
    this.#charts = spec.charts;
    this.remedy = remedyOf(spec.fix);
    this.seenIn = seenInOf(spec.fix);
    this.control = spec.fix.kind === 'errorSwitch' ? spec.fix.switchField : null;
  }

  /** The WinISD bug and what OpenISD does instead, in plain words. */
  get explanation(): string {
    return `${this.winisd} ${this.openisd}`;
  }

  /** The cue shows now: the bug is in scope for the open box and its switch is not reproducing it. */
  cueShown(s: ErrorSwitchStates): boolean {
    switch (this.#fix.kind) {
      case 'errorSwitch': {
        const state = this.#fix.switchOf(s);
        return state.inScope && !state.reproducesError;
      }
      case 'ignoredInput': return true;
    }
  }

  /** The cue shows now and belongs to chart `id`. */
  cueShownOnChart(s: ErrorSwitchStates, id: ChartId): boolean {
    return this.#charts.includes(id) && this.cueShown(s);
  }

  static readonly DRIVER_MODEL = new WinisdDeviation({
    title: 'WinISD mixes two BL values',
    winisd: 'WinISD uses two different BL values. It drives the cone with the BL you entered, but works out the damping from the BL implied by Fs, Qes and Vas.',
    openisd: 'OpenISD uses one BL everywhere: the one from the datasheet values you entered.',
    size: 'W5-1138SMF (entered BL 7.17, implied BL 7.384): the passband SPL differs by 0.26 dB and the impedance peak by about 8 %.',
    fix: {kind: 'errorSwitch', switchField: ToggleField.ADV_WINISDDRIVERMODEL, switchOf: s => s.driverModel},
    charts: [],
  });

  static readonly VA_MODEL = new WinisdDeviation({
    title: 'WinISD uses Re, not Re + Rg',
    winisd: 'WinISD\'s amplifier load (VA) chart uses Re, but the amplifier sees Re + Rg. With "Rg is at driver side" ticked, WinISD counts Rg twice. On the Signal tab, WinISD works out power from voltage with Re alone, but its SPL chart drives that power into Re + Rg.',
    openisd: 'OpenISD uses Re + Rg everywhere.',
    size: 'VA chart: with Re 3.4 Ω and Rg 1 Ω, WinISD reads 23 % (1.1 dB) low. Power: at 1.85 V per driver, 4 drivers and Rg 0.1 Ω, WinISD shows 4.0 W and OpenISD 3.91 W. A typed voltage plays about 0.1 dB louder in WinISD.',
    fix: {kind: 'errorSwitch', switchField: ToggleField.ADV_WINISDVAMODEL, switchOf: s => s.vaModel},
    charts: ['VA'],
  });

  static readonly PR_NPR_RESONANCE = new WinisdDeviation({
    title: 'WinISD takes passive radiator losses at the wrong frequency',
    winisd: 'With more than one passive radiator, WinISD multiplies the radiator mass by the number of radiators (Npr) where it should divide by it. So it works out the box losses at a frequency Npr times too low.',
    openisd: 'OpenISD works out the box losses at the true tuning frequency.',
    size: 'Npr 2, W5 in 10 L, radiator Fs 30 Hz: WinISD uses 21 Hz, but the tuning is 42 Hz. The impedance differs by up to 1 Ω and the transfer function by up to 2 dB.',
    fix: {kind: 'errorSwitch', switchField: ToggleField.ADV_WINISDPRNPRRESONANCE, switchOf: s => s.prNprResonance},
    charts: [],
  });

  static readonly ABC_GROUP_DELAY = new WinisdDeviation({
    title: 'WinISD\'s ABC group delay leaves the driver out',
    winisd: 'For the group delay of an ABC box, WinISD moves the box to f ± 1e-10 Hz but leaves the driver at the chart frequency f. So its group delay shows the box alone, and it does not match WinISD\'s own phase chart.',
    openisd: 'OpenISD works out the group delay from the slope of the phase it plots.',
    size: 'W5-1138SMF ABC box: at 1 Hz WinISD shows −41.0 ms where the phase slope gives −33.9 ms. At 10.75 Hz: −3.3 ms against +3.6 ms. At 116 Hz: 1.46 ms against 2.39 ms.',
    fix: {kind: 'errorSwitch', switchField: ToggleField.ADV_WINISDABCGROUPDELAY, switchOf: s => s.abcGroupDelay},
    charts: ['GD'],
  });

  static readonly DRIVER_COUNT = new WinisdDeviation({
    title: 'WinISD shows one driver\'s impedance',
    winisd: 'With more than one driver, WinISD\'s impedance chart shows the impedance of one driver, not of all the drivers the amplifier drives. Its SPL, VA and maximum power charts do show all the drivers.',
    openisd: 'OpenISD shows the impedance of all the drivers, wired in series or parallel as the project says.',
    size: 'W5-1138SMF, sealed, 4 drivers: WinISD peaks at 18.6 Ω, the same as one driver. Wired in parallel, the amplifier sees 4.65 Ω.',
    fix: {kind: 'errorSwitch', switchField: ToggleField.ADV_WINISDDRIVERCOUNTMODEL, switchOf: s => s.driverCount},
    charts: [],
  });

  /** The project-wide members, by reflection; declared last. */
  static readonly ALL: readonly WinisdDeviation[] =
    Object.freeze(Object.values(WinisdDeviation).filter((v): v is WinisdDeviation => v instanceof WinisdDeviation));
}

function seenInOf(fix: WinisdDeviationFix): string {
  switch (fix.kind) {
    case 'errorSwitch': {
      const seenIn = fix.switchField.seenIn;
      if (seenIn === null) throw new Error(`WinisdDeviation: bug switch "${fix.switchField.label}" has no "Seen in" line`);
      return seenIn;
    }
    case 'ignoredInput': return fix.seenIn;
  }
}

function remedyOf(fix: WinisdDeviationFix): string {
  switch (fix.kind) {
    case 'errorSwitch': return `Tick "${fix.switchField.label}" under Enable WinISD bugs (Advanced) to bring WinISD's behaviour back.`;
    case 'ignoredInput': return 'WinISD ignores this input, so OpenISD has no switch to copy it. Set the value WinISD draws to see WinISD\'s result.';
  }
}

/** A deviation that changes particular filters in the EQ/Filter chain; its cue sits on the filter. */
export class WinisdFilterDeviation extends WinisdDeviation {
  readonly #concerns: (f: Filter) => boolean;

  private constructor(spec: WinisdFilterDeviationSpec) {
    super(spec);
    this.#concerns = spec.concerns;
  }

  /** `f`'s editor carries the cue now: the cue shows and `f` is of the kind the bug concerns. */
  cueShownFor(s: ErrorSwitchStates, f: Filter): boolean {
    return this.cueShown(s) && this.#concerns(f);
  }

  static readonly ALLPASS_ORDER = new WinisdFilterDeviation({
    title: 'WinISD ignores allpass orders above 2',
    winisd: 'WinISD draws an allpass filter of order 3 or more exactly as order 2: one 2nd-order section with ω0 = 2/t and a delay of t/Q.',
    openisd: 'OpenISD uses the order you set. Above order 2 it draws a Bessel allpass of that order with a delay of t. The delay stays flat to a higher frequency as the order rises. Q is not used there. Orders 1 and 2 are the same as in WinISD.',
    size: 't 3 ms, Q 0.6, order 4: WinISD delays 5.0 ms (as order 2), OpenISD 3.0 ms.',
    fix: {kind: 'ignoredInput', seenIn: 'allpass filters of order 3 or more in the EQ/Filter chain. The EQ/Filter phase and group delay charts change, and so do the phase and group delay of every chart the filter feeds. The magnitude is flat either way.'},
    charts: [],
    concerns: f => f.type === 'allpass',
  });

  static readonly LINKWITZ_RILEY_ORDER = new WinisdFilterDeviation({
    title: 'WinISD ignores the Linkwitz-Riley order',
    winisd: 'WinISD always draws a 4th-order Linkwitz-Riley filter, whatever the Order box says. A typed 2 or 6 reopens as 4.',
    openisd: 'OpenISD uses the order you set. A Linkwitz-Riley filter of even order n is two Butterworth filters of order n/2 in a row.',
    size: 'Low-pass, one octave above fc: LR2 −7.0 dB, LR4 (WinISD) −24.6 dB. Phase at fc: −90° against −180°.',
    fix: {kind: 'ignoredInput', seenIn: 'Linkwitz-Riley low-pass and high-pass filters whose order is not 4. The three EQ/Filter charts change, and so does every chart the filter feeds (SPL, Cone excursion, port velocities).'},
    charts: [],
    concerns: f => (f.type === 'lowpass' || f.type === 'highpass') && f.family === 'linkwitzRiley',
  });

  static readonly BESSEL_HIGHPASS = new WinisdFilterDeviation({
    title: 'WinISD\'s Bessel high-pass is not the mirror of its low-pass',
    winisd: 'WinISD makes its Bessel high-pass by keeping the low-pass denominator and changing only the numerator to (k·s)^n. That is not a Bessel high-pass.',
    openisd: 'OpenISD draws the mirror image of the low-pass (s → 1/s).',
    size: 'Order 4, fc 25 Hz: magnitude and phase together differ by up to 6 %. Order 1 is the same in both.',
    fix: {kind: 'errorSwitch', switchField: ToggleField.ADV_WINISDBESSELHIGHPASS, switchOf: s => s.besselHighpass},
    charts: [],
    concerns: f => f.type === 'highpass' && f.family === 'bessel',
  });

  /** Every member, by reflection; declared last. */
  static override readonly ALL: readonly WinisdFilterDeviation[] =
    Object.freeze(Object.values(WinisdFilterDeviation).filter((v): v is WinisdFilterDeviation => v instanceof WinisdFilterDeviation));
}
