import type {Clearable, Entered, Precise, ProvenanceLetter, Readable, SimpleField, Writable} from '@openisd/design';
import type {FieldSpin, NumberField, PhoneRowColumns, ReadoutFormat, WinisdDeviation} from '@openisd/design/fields';

/** A number a person can enter, clear and state the precision of: an emptied box clears it. */
export type ClearableUICell = Readable<number | null> & Entered & Precise & Writable<number> & Clearable;

/** A number that is always there and never blank: no provenance, no flags, no `clear`. */
export type FixedUICell = SimpleField<number | null>;

/** A number that is always there but may be cleared, which settles it to a default (a box loss, T211). */
export type SettlingUICell = SimpleField<number | null> & Clearable;

/** What a field row is bound to, told apart by `kind`: `UIField` builds the first, `UIFixedField` the
 *  second, `UISettlingField` the third. */
export type UIBinding =
  | {readonly kind: 'clearable'; readonly cell: ClearableUICell}
  | {readonly kind: 'fixed'; readonly cell: FixedUICell}
  | {readonly kind: 'settling'; readonly cell: SettlingUICell};

/** The props every field row takes, whatever it is bound to. */
export interface UIFieldCommon {
  field: NumberField;
  /** Replaces the registry label where a screen names the field differently. */
  label?: string;
  /** Always drawn as mandatory. Otherwise mandatory only while the cell is needed and empty. */
  required?: boolean;
  /** The input's id, for a view or test that addresses the box directly. */
  inputId?: string;
  /** A lower bound tighter than the registry's, in SI. */
  min?: number;
  /** An upper bound tighter than the registry's, in SI. */
  max?: number;
  /** The widths across a phone row (label, ▲▼ area, chip, text gutter). Default `PhoneRowColumns.STANDARD`. */
  columns?: PhoneRowColumns;
  /** ▲▼ buttons beside the box (the phone layout). */
  stepper?: boolean;
  /** Replaces the field's own spin rule for the ▲▼ buttons (an even-only Order box moves 2). */
  spin?: FieldSpin;
  /** A calculated value: shown in the greyed readout look, never editable. */
  readonly?: boolean;
  /** A readonly value shown to this readout's decimals, not the field's. */
  format?: ReadoutFormat;
  /** A readonly value drawn as plain text, not as a greyed box (the phone). */
  plain?: boolean;
  /** WinISD deviation cue to show next to the field. */
  deviation?: WinisdDeviation;
  /** Custom DQ flags to display for fixed fields or readouts. */
  dq?: readonly string[];
  /** Whether the flagged value was entered ('E', the cause) or calculated ('C', a symptom), for `dq`. */
  dqState?: ProvenanceLetter;
  /** Accepts any finite number: the data-quality flag, not the box, says it is out of range. */
  allowOutOfRange?: boolean;
  /** A value that is a default, not entered (true: blue); false: entered (green). Unset: no provenance. */
  defaulted?: boolean;
}
