import {PhoneRowColumns, PhoneRowSizes} from '@openisd/design/fields';

/** The classes a skin gives the driver editor's shared controls. The desktop passes none. */
export interface DriverEditorSkin {
  /** A field row (`UIField`, `UIFixedField`, `UIPickField`): label, then the box with its unit chip inside and the ▲▼ at the edge. */
  readonly field: string;
  /** A field row that needs the width (the Comment box): the label above a full-width box. */
  readonly fieldStacked: string;
  /** A footer or panel button. */
  readonly button: string;
  /** The button that applies the editor (OK, Rename): the one filled blue button of its screen. */
  readonly buttonPrimary: string;
  /** Every other button: the plain grey one. */
  readonly buttonSecondary: string;
  /** The row-size and column custom properties the shared classic phone row reads (`--mob-row-min`, `--mob-col-label`, ...). */
  readonly rowVars: Readonly<Record<string, string>>;
  /** The wider label column of the General tab, whose labels are longer. */
  readonly generalColumnVars: Readonly<Record<string, string>>;
}

/** The phone's: the classic phone row (`PhoneRowSizes.CLASSIC`, `PhoneRowColumns`) and the one 44 px
 *  phone button (style.css). The editor has no row size of its own. */
export const PHONE_DRIVER_EDITOR_SKIN: DriverEditorSkin = {
  field: 'mob-ui-field',
  fieldStacked: 'mob-ui-field mob-ui-field-stacked',
  button: 'mob-btn',
  buttonPrimary: 'mob-btn-primary',
  buttonSecondary: 'mob-btn-plain',
  rowVars: Object.fromEntries([...PhoneRowSizes.CLASSIC.cssVars(), ...PhoneRowColumns.STANDARD.cssVars()]),
  generalColumnVars: Object.fromEntries(PhoneRowColumns.WIDE_LABEL.cssVars()),
};
