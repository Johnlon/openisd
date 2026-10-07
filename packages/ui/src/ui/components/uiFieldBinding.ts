import type {Clearable, Entered, Precise, Readable, SimpleField, Writable} from '@openisd/design';
import type {NumberField} from '@openisd/design/fields';

/** A number a person can enter, clear and state the precision of: an emptied box clears it. */
export type ClearableUICell = Readable<number | null> & Entered & Precise & Writable<number> & Clearable;

/** A number that is always there (a box loss): no provenance, no flags, no `clear`. */
export type FixedUICell = SimpleField<number>;

/** What a field row is bound to, told apart by `kind`: `UIField` builds the first, `UIFixedField` the second. */
export type UIBinding =
  | {readonly kind: 'clearable'; readonly cell: ClearableUICell}
  | {readonly kind: 'fixed'; readonly cell: FixedUICell};

/** The props every field row takes, whatever it is bound to. */
export interface UIFieldCommon {
  field: NumberField;
  /** Always drawn as mandatory. Otherwise mandatory only while the cell is needed and empty. */
  required?: boolean;
  /** The input's id, for a view or test that addresses the box directly. */
  inputId?: string;
  /** An upper bound tighter than the registry's, in SI. */
  max?: number;
  /** ▲▼ buttons beside the box (the phone layout). */
  stepper?: boolean;
  /** Shown but not editable, e.g. a value another field is deriving. */
  readonly?: boolean;
}
