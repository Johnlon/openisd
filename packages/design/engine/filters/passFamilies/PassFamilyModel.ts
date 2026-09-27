/**
 * One WinISD pass-family's response, at normalised frequency x = f/fc — the strategy
 * `PassFilter` holds, one implementation per WinISD Filter Editor "Subtype".
 */
import type {Complex} from '../../types.js';

export interface PassFamilyModel {
  /** The family's display word inside a Filters-list caption, e.g. "Butterworth". */
  readonly label: string;
  lowpass(x: number): Complex;
  highpass(x: number): Complex;
}
