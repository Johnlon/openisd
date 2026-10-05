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
    winisd: 'WinISD wraps every phase curve at ±180°, so the curve jumps by 360° where it crosses.',
    openisd: 'Unticked, OpenISD draws the phase continuous, without the jumps.',
    seenIn: 'every phase chart.',
    size: 'Display only: the curve is shifted by whole turns of 360°; no value changes.',
    switchField: ToggleField.ADV_WINISDWRAPPHASE,
  });

  static readonly FLAT_MODEL = new WinisdOption({
    title: 'Uncapped flat response',
    winisd: 'With "Force flat response" on, WinISD equalises every frequency to the transfer function\'s 0 dB, cutting as well as boosting, with no limit.',
    openisd: 'Unticked, OpenISD boosts only, up to the passband level, and stops at 20 dB of boost.',
    seenIn: 'every chart, only with "Force flat response" on; Cone excursion and the port velocities show what the boost costs.',
    size: 'Below the box\'s roll-off WinISD\'s boost keeps rising as the frequency falls; unticked it stops at 20 dB.',
    switchField: ToggleField.ADV_WINISDFLATMODEL,
  });

  static readonly ABC_INTRA_PORT_VELOCITY = new WinisdOption({
    title: 'Simplified ABC intra-port velocity',
    winisd: 'WinISD\'s intra-port velocity of an ABC box leaves out a small leak term of the air flow through the port.',
    openisd: 'Unticked, OpenISD draws the exact air flow through the port.',
    seenIn: 'the Intra port velocity chart of an ABC box only.',
    size: 'W5-1138SMF ABC: up to 1.35 dB and 4.6° near 110 Hz, under 0.1 dB elsewhere.',
    switchField: ToggleField.ADV_WINISDABCINTRAPORTVELOCITY,
  });

  /** Every option, by reflection; declared last. */
  static readonly ALL: readonly WinisdOption[] =
    Object.freeze(Object.values(WinisdOption).filter((v): v is WinisdOption => v instanceof WinisdOption));
}
