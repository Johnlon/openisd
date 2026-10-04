import {NumberField} from './field.js';
import {formatFixed} from './format.js';
import {decimalsIn} from './dimensions.js';

/** A readout that has no registered field of its own: Qtc, EBP, an alignment's volume and
 *  tuning, the new-project volume, the chart cursor's frequency. It names the registered field
 *  whose unit it shares, and the key that field's rotation is stored under (the `unit-key` its
 *  `UnitToggle` uses), so its number and label follow that rotation. A registered
 *  field carries its own `precision` (`NumberField.fixed`). `decimals` are at the base unit. */
export class ReadoutFormat {
  static readonly QTC = new ReadoutFormat(3, NumberField.QTS, 'Qtc');
  static readonly EBP = new ReadoutFormat(1, NumberField.EBP_HZ, 'EBP_hz');
  static readonly ALIGNMENT_VOLUME_L = new ReadoutFormat(2, NumberField.BOX_VB_L, 'Vb');
  static readonly TUNING_HZ = new ReadoutFormat(1, NumberField.BOX_FB_HZ, 'Fb');
  static readonly PROJECT_VOLUME_L = new ReadoutFormat(1, NumberField.BOX_VB_L, 'Vb');
  static readonly CURSOR_FREQUENCY_HZ = new ReadoutFormat(2, NumberField.PLOT_FMIN_HZ, 'cursorHz');
  static readonly CURSOR_LEVEL = new ReadoutFormat(3, NumberField.QTS, 'Qtc');

  private constructor(readonly decimals: number, private readonly unitField: NumberField, private readonly unitKey: string) {}

  /** The unit label the user has rotated this readout to; `''` for a unitless readout. */
  unitLabel(tokens: Record<string, string>): string {
    return this.unitField.unitLabel(this.unitField.unitTokenFor(tokens, this.unitKey));
  }

  /** `v` (in the field's base unit) in the rotated unit, to this readout's decimals; `absent`
   *  when `v` is missing. */
  text(v: number | null | undefined, absent: string, tokens: Record<string, string> = {}): string {
    if (v === null || v === undefined) return absent;
    const unit = this.unitField.unitFor(this.unitField.unitTokenFor(tokens, this.unitKey));
    if (unit.kind === 'fixed') return formatFixed(v, this.decimals);
    return formatFixed(v * unit.relFactor, decimalsIn(unit, this.decimals));
  }

  /** `text` followed by the unit label; just `absent` when `v` is missing. */
  textWithUnit(v: number | null | undefined, absent: string, tokens: Record<string, string>): string {
    const shown = this.text(v, absent, tokens);
    const label = this.unitLabel(tokens);
    return v === null || v === undefined || label === '' ? shown : `${shown} ${label}`;
  }
}
