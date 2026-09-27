import {cx} from '../complex.js';
import type {Complex, FilterSpec} from '../types.js';
import type {FilterModel} from './FilterModel.js';

type Spec = Extract<FilterSpec, {type: 'staticGain'}>;

/** A flat gain, no frequency dependence. */
export class StaticGainFilter implements FilterModel {
  constructor(private readonly spec: Spec) {}

  response(): Complex {
    return cx(Math.pow(10, this.spec.gain / 20), 0);
  }

  caption(): string {
    return `Static gain (Gain=${this.spec.gain.toFixed(2)} dB)`;
  }
}
