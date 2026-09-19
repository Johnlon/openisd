/** The ONE dispatch from a runtime spec-field name to the driver's typed accessor.
 *
 *  `SpecField` never appears as a public parameter on `OpenISDDriver` itself (human ruling
 *  2026-08-24, ENCAPSULATION_AND_LAYERING.md), so the driver editor's data-driven field table
 *  needs exactly one place that maps a name to a handle.
 *
 *  The name IS the vocabulary key, which is also the `DriverSpecsSection` field name — so there
 *  is no switch: `driver.spec[section][field]` is the handle. A field renamed in the vocabulary
 *  or the schema is a compile error at this one line. `VCCon` is the non-numeric wiring select,
 *  handled by its own dropdown, never here.
 *
 *  Returns null for `VCCon` rather than asserting a type — which keeps the compiler proving the
 *  numeric reads. */
import type {Field, OpenISDDriver} from '@openisd/design';
import type {SpecField} from './appState.js';

export function specFieldHandle(driver: OpenISDDriver, field: SpecField): Field<number> | null {
  if (field === 'VCCon') return null;
  return driver.spec[driver.section][field];
}