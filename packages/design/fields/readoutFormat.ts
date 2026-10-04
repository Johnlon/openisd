import {formatFixed} from './format.js';

/** The decimals of a readout that has no registered field: Qtc, EBP, an alignment's volume and
 *  tuning, the new-project volume, the chart cursor's two figures. A registered field carries its
 *  own `precision` (`NumberField.fixed`). */
export class ReadoutFormat {
  static readonly QTC = new ReadoutFormat(3);
  static readonly EBP = new ReadoutFormat(1);
  static readonly ALIGNMENT_VOLUME_L = new ReadoutFormat(2);
  static readonly TUNING_HZ = new ReadoutFormat(1);
  static readonly PROJECT_VOLUME_L = new ReadoutFormat(1);
  static readonly CURSOR_FREQUENCY_HZ = new ReadoutFormat(2);
  static readonly CURSOR_LEVEL = new ReadoutFormat(3);

  private constructor(readonly decimals: number) {}

  /** `v` to this readout's decimals; `absent` when `v` is missing. */
  text(v: number | null | undefined, absent: string): string {
    return v === null || v === undefined ? absent : formatFixed(v, this.decimals);
  }
}
