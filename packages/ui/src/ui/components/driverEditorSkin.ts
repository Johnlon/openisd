import {PhoneRowSizes} from '@openisd/design/fields';

/** The classes a skin gives the driver editor's shared controls. The desktop passes none. */
export interface DriverEditorSkin {
  /** A field row (`UIField`, `UIFixedField`, `UIPickField`): label, box, ⚠ and unit on one line. */
  readonly field: string;
  /** A field row whose control needs the width (the Comment box): the label above it. */
  readonly fieldStacked: string;
  /** A footer or panel button. */
  readonly button: string;
  /** The button that applies the editor (OK, Rename). */
  readonly buttonPrimary: string;
  /** Every other button. */
  readonly buttonSecondary: string;
  /** The row-size custom properties the shared phone row reads (`--mob-input-h`, ...). */
  readonly rowVars: Readonly<Record<string, string>>;
}

/** The phone's: the shared phone field row and the 44 px touch button (style.css). The rows are the
 *  compact set (`PhoneRowSizes.COMPACT`), a half-way house between the tabs' and the sheets'. */
export const PHONE_DRIVER_EDITOR_SKIN: DriverEditorSkin = {
  field: 'mob-ui-field mob-ui-field-inline',
  fieldStacked: 'mob-ui-field',
  button: 'mob-btn',
  buttonPrimary: 'mob-btn-primary',
  buttonSecondary: 'mob-btn-secondary',
  rowVars: Object.fromEntries(PhoneRowSizes.COMPACT.cssVars()),
};
