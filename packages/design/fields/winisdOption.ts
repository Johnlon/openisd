import {ToggleField} from './field.js';

/** A WinISD option's help text: WinISD's way of a calculation and the other valid form. */
export interface WinisdOptionSpec {
  readonly title: string;
  /** What WinISD does (the switch ticked, the default). */
  readonly winisd: string;
  /** What OpenISD does with the switch unticked. */
  readonly openisd: string;
  /** The charts and readouts the choice shows in. */
  readonly seenIn: string;
  /** How large the difference is, for a realistic case. */
  readonly size: string;
  /** The "Enable WinISD-style" switch that picks between the two. */
  readonly switchField: ToggleField;
}

/** A switch under "Enable WinISD-style": WinISD's way of a calculation (ticked, the default) or another valid form. */
export class WinisdOption {
  readonly title: string;
  readonly winisd: string;
  readonly openisd: string;
  readonly seenIn: string;
  readonly size: string;
  readonly switchField: ToggleField;

  private constructor(spec: WinisdOptionSpec) {
    this.title = spec.title;
    this.winisd = spec.winisd;
    this.openisd = spec.openisd;
    this.seenIn = spec.seenIn;
    this.size = spec.size;
    this.switchField = spec.switchField;
  }

  static readonly WRAP_PHASE = new WinisdOption({
    title: 'Phase wrapping',
    winisd: 'WinISD keeps every phase curve between −180° and +180°, so the curve jumps by 360° where it reaches that limit.',
    openisd: 'Unticked, OpenISD draws the phase as one smooth curve with no jumps.',
    seenIn: 'every phase chart.',
    size: 'Display only: the curve moves by whole steps of 360°. No value changes.',
    switchField: ToggleField.ADV_WINISDWRAPPHASE,
  });

  static readonly FLAT_MODEL = new WinisdOption({
    title: 'Uncapped flat response',
    winisd: 'With "Force flat response" ticked, WinISD cuts or boosts every frequency to the 0 dB line of the transfer function, with no limit.',
    openisd: 'Unticked, OpenISD only boosts, up to the passband level, and never by more than 20 dB.',
    seenIn: 'every chart, only with "Force flat response" ticked. The Cone excursion and port velocity charts show what the boost costs.',
    size: 'Below the box roll-off, WinISD\'s boost keeps rising as the frequency falls. Unticked, OpenISD stops at 20 dB.',
    switchField: ToggleField.ADV_WINISDFLATMODEL,
  });

  static readonly ABC_INTRA_PORT_VELOCITY = new WinisdOption({
    title: 'Simplified ABC intra-port velocity',
    winisd: 'WinISD\'s intra-port velocity chart for an ABC box leaves out a small leak term in the air flow through the port.',
    openisd: 'Unticked, OpenISD draws the exact air flow through the port.',
    seenIn: 'the Intra port velocity chart, ABC boxes only.',
    size: 'W5-1138SMF ABC box: up to 1.35 dB and 4.6° near 110 Hz, under 0.1 dB elsewhere.',
    switchField: ToggleField.ADV_WINISDABCINTRAPORTVELOCITY,
  });

  /** The first option that is OFF by default (QO946.c131): ticked, WinISD's way. */
  static readonly ONE_DRIVER_IMPEDANCE = new WinisdOption({
    title: 'Impedance of one driver',
    winisd: 'WinISD works out the sound as if the drivers were wired in parallel, but its impedance chart shows only ONE driver, not the load the amplifier sees (4 × 8 Ω is 2 Ω).',
    openisd: 'Unticked (the default), OpenISD shows the load for the wiring you chose under Driver wiring.',
    seenIn: 'the Impedance chart, with 2 or more drivers. The sound and every other chart stay the same.',
    size: 'Four DA215-8 drivers in parallel: 1.7 Ω at high frequency in OpenISD, 6.8 Ω in WinISD. In series: 27.2 Ω against 6.8 Ω.',
    switchField: ToggleField.ADV_WINISDONEDRIVERIMPEDANCE,
  });

  /** Every option, by reflection; declared last. */
  static readonly ALL: readonly WinisdOption[] =
    Object.freeze(Object.values(WinisdOption).filter((v): v is WinisdOption => v instanceof WinisdOption));
}
