import type {BoxType} from '../engine/index.js';

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

/** Vent geometry / shape options. */
export const VENT_SHAPE_OPTIONS: readonly SelectorOption<string>[] = Object.freeze([
  Object.freeze({ value: 'round', label: 'Round Tube' }),
  Object.freeze({ value: 'slotted', label: 'Slotted Duct' }),
]);

/** Voice coil wiring connection options. */
export const VC_CONNECTION_OPTIONS: readonly SelectorOption<string>[] = Object.freeze([
  Object.freeze({ value: 'Parallel', label: 'Parallel' }),
  Object.freeze({ value: 'Series', label: 'Series' }),
]);

/** Sealed alignment Q_tc preset target options. */
export const SEALED_ALIGNMENT_OPTIONS: readonly SelectorOption<number>[] = Object.freeze([
  Object.freeze({ value: 0.5, label: '0.500 Critically damped' }),
  Object.freeze({ value: 0.577, label: '0.577 Max flat delay response' }),
  Object.freeze({ value: 0.707, label: '0.707 Max flat amplitude response' }),
  Object.freeze({ value: 0.8, label: '0.800 Equal ripple response' }),
  Object.freeze({ value: 0.9, label: '0.900 Equal ripple response' }),
  Object.freeze({ value: 1.0, label: '1.000 Equal ripple response' }),
]);

/** Enclosure type selector options. */
export const BOX_TYPE_OPTIONS: readonly SelectorOption<BoxType>[] = Object.freeze([
  Object.freeze({ value: 'sealed', label: 'Sealed' }),
  Object.freeze({ value: 'vented', label: 'Vented' }),
  Object.freeze({ value: 'bandpass4', label: '4th-Order Bandpass' }),
  Object.freeze({ value: 'box-passive-radiator', label: 'Passive Radiator' }),
]);
