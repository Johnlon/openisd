/** The ONE dispatch from a runtime spec-field name to the driver's typed accessor.
 *
 *  `SpecField` never appears as a public parameter on `OpenISDDriver` itself (human ruling
 *  2026-08-24, ENCAPSULATION_AND_LAYERING.md), so the driver editor's data-driven field table
 *  needs exactly one place that maps a name to a handle.
 *
 *  The name IS the field-table key, which is also the `DriverSpecsSection` field name — so there
 *  is no switch: `driver.specs[field]` is the handle. A field renamed in the vocabulary
 *  or the schema is a compile error at this one line. `VCCon` is the non-numeric wiring select,
 *  handled by its own dropdown, never here — excluded by the PARAMETER TYPE (`NumSpecField`),
 *  not a runtime check, so the accessor is TOTAL: every caller gets a real handle, never null
 *  (BUG_20260927_ui-fakes-driver-cells.md — no fake cell for the UI to fall back to). */
import type {Calculated, Clearable, Entered, OpenISDDriver, Readable, Writable} from '@openisd/design';
import type {NumSpecField} from './appState.js';

export function specFieldHandle(
  driver: OpenISDDriver,
  field: NumSpecField,
): Readable<number | null> & Entered & Calculated & Writable<number> & Clearable {
  return driver.specs[field];
}