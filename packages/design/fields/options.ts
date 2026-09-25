import type {BoxType, FilterType, VentedAlignment, Wiring} from '../engine/index.js';
import type {VoiceCoilWiring} from '../domain/openisdSchema.js';
import type {VentShape} from '../domain/vent.js';

/**
 * SelectorOption — Symmetrical option contract for UI dropdown selectors.
 * Domain-defined and exported for use throughout the application.
 */
export interface SelectorOption<T = string | number> {
  readonly value: T;
  readonly label: string;
}

/** Port end-correction presets (WinISD parity). */
export const END_CORRECTION_OPTIONS: readonly SelectorOption<number>[] = Object.freeze([
  Object.freeze({ value: 0.613, label: 'Two free ends' }),
  Object.freeze({ value: 0.732, label: 'One flanged end' }),
  Object.freeze({ value: 0.849, label: 'Two flanged ends' }),
]);

/** Vent geometry / shape options — values are the domain's own `VentShape` members. */
export const VENT_SHAPE_OPTIONS: readonly SelectorOption<VentShape>[] = Object.freeze([
  Object.freeze({ value: 'round', label: 'Round Tube' }),
  Object.freeze({ value: 'slotted', label: 'Slotted Duct' }),
]);

/** Voice coil wiring connection options. The VALUES are the domain's own wiring members, so a
 *  chosen option is written to the driver as-is — the compiler checks each literal against
 *  `VoiceCoilWiring`. */
export const VC_CONNECTION_OPTIONS: readonly SelectorOption<VoiceCoilWiring>[] = Object.freeze([
  Object.freeze({ value: 'parallel', label: 'Parallel' }),
  Object.freeze({ value: 'series', label: 'Series' }),
]);

/** How a multi-driver array is wired to the amplifier. */
export const ARRAY_WIRING_OPTIONS: readonly SelectorOption<Wiring>[] = Object.freeze([
  Object.freeze({ value: 'parallel', label: 'Parallel' }),
  Object.freeze({ value: 'series', label: 'Series' }),
]);

/** WinISD's nine sealed-box target-Q (Qtc) choices from the New Project wizard, exact labels.
 *  THE list — `engine/boxDesign.ts` hands this same object out, never a copy. */
export const SEALED_ALIGNMENT_OPTIONS: readonly SelectorOption<number>[] = Object.freeze([
  Object.freeze({ value: 0.5, label: '0.500 Critically damped' }),
  Object.freeze({ value: 0.577, label: '0.577 Max flat delay response' }),
  Object.freeze({ value: 0.707, label: '0.707 Max flat amplitude response' }),
  Object.freeze({ value: 0.8, label: '0.800 Equal ripple response' }),
  Object.freeze({ value: 0.9, label: '0.900 Equal ripple response' }),
  Object.freeze({ value: 1, label: '1.000 Equal ripple response' }),
  Object.freeze({ value: 1.1, label: '1.100 Equal ripple response' }),
  Object.freeze({ value: 1.2, label: '1.200 Equal ripple response' }),
  Object.freeze({ value: 1.5, label: '1.500 Equal ripple response' }),
]);

/** WinISD's five vented-box alignment choices from the New Project wizard, exact labels, in
 *  its dropdown order. WinISD's default is C4/SC4. Formulas: `engine/boxDesign.ts`'s
 *  `ventedAlignment()`. */
export const VENTED_ALIGNMENT_OPTIONS: readonly SelectorOption<VentedAlignment>[] = Object.freeze([
  Object.freeze({ value: 'qb3', label: 'QB3 Quasi-butterworth' }),
  Object.freeze({ value: 'bb4', label: 'BB4/SBB4 (Super-)boom-box' }),
  Object.freeze({ value: 'c4', label: 'C4/SC4 (Sub-)Chebyshev' }),
  Object.freeze({ value: 'ebs3', label: 'EBS3 extended bass shelf -3 dB' }),
  Object.freeze({ value: 'ebs6', label: 'EBS6 extended bass shelf -6 dB' }),
]);

/** The wizard's initial vented alignment — WinISD opens on C4/SC4. */
export const DEFAULT_VENTED_ALIGNMENT: VentedAlignment = 'c4';

/** Enclosure type selector options — every type the Box tab lists, in WinISD's order and with
 *  its labels. Whether the solver models a type is `boxTypeIsSimulatable`'s answer, not this
 *  list's: a picker that offers only the simulatable ones filters this. */
export const BOX_TYPE_OPTIONS: readonly SelectorOption<BoxType>[] = Object.freeze([
  Object.freeze({ value: 'sealed', label: 'Closed' }),
  Object.freeze({ value: 'vented', label: 'Vented' }),
  Object.freeze({ value: 'box-passive-radiator', label: 'Passive Radiator' }),
  Object.freeze({ value: 'bandpass4', label: '4th Order Bandpass' }),
  Object.freeze({ value: 'bandpass6', label: '6th Order Bandpass' }),
  Object.freeze({ value: 'abc', label: 'ABC' }),
]);

/** The filter types the engine models, in the Filters tab's quick-add order. */
export const FILTER_TYPE_OPTIONS: readonly SelectorOption<FilterType>[] = Object.freeze([
  Object.freeze({ value: 'lowpass', label: 'Lowpass' }),
  Object.freeze({ value: 'highpass', label: 'Highpass' }),
  Object.freeze({ value: 'linkwitz', label: 'Linkwitz-Transform' }),
  Object.freeze({ value: 'peaking', label: 'Peaking EQ' }),
  Object.freeze({ value: 'lowshelf', label: 'Low Shelf' }),
  Object.freeze({ value: 'highshelf', label: 'High Shelf' }),
]);
