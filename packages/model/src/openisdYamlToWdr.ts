/**
 * `openisd.yml` text -> `.wdr` text, direct — the seam `winisd_tools` calls in-process
 * (embedded V8) to generate the `.wdr` it stores in `winisd_drivers`.
 *
 * Composes the three pieces the V8 bridge needs strung together: YAML parse, record shape
 * check, `OpenISDDriver.fromJsonRecord`, `OpenISDDriver.toWdrText()` (itself
 * `toWinISDDriver().toWdr()`). `errors` names what is missing when the projection cannot
 * complete, the YAML does not parse to an OpenISD record, or the record's interior does not
 * match the shape `OpenISDDriver`'s getters assume (bugs/BUG_20260822_openisddriver_getters_throw_on_a_record_that_has_specs_but_not_the_spec_entry_shape.md,
 * OPEN — `fromJsonRecord` does not itself validate; this function catches around the whole
 * composition as the interim so this seam still honours `value` null / never-throws); `value`
 * is null then.
 *
 * Returns a STRING. The V8 boundary carries strings, not bytes — a caller that needs to write
 * `.wdr` file bytes (the `0xA4` `Comment=` newline sentinel, CP1252/UTF-8 discrimination) must
 * go through `wdrTextToBytes`/`wdrBytesToText` in `@openisd/winisd`'s `wdrBytes.ts`; this
 * function does not touch that boundary at all.
 */
import { parse } from 'yaml';
import type { DriverError, Result } from '@openisd/engine';
import { OpenISDDriver } from './openisdDriver.js';

export function openisdYamlToWdr(yamlText: string): Result<string> {
  const err = (field: string, message: string): DriverError => ({ level: 'error', field, message });
  let record: unknown;
  try {
    record = parse(yamlText);
  } catch (e) {
    return { value: null, errors: [err('yaml', `could not parse openisd.yml: ${String(e)}`)] };
  }
  if (record == null || typeof record !== 'object' || !('specs' in record)) {
    return { value: null, errors: [err('yaml', 'openisd.yml did not parse to a record')] };
  }
  // Interim per BUG_20260822 (see docstring): `fromJsonRecord`/its getters throw on a record
  // whose `specs` interior is not the `_SpecEntry` shape (`specs: {woofer: {fs: 12}}` — a
  // plausible V8-bridge input). The right fix is `fromJsonRecord` refusing that shape itself
  // (`Result<OpenISDDriver>`); that touches callers in `@openisd/model` and `packages/ui/src/logic`
  // (managedProject.ts, useDesignIO.ts) outside this task's scope, so this catch is the
  // acknowledged interim — the bug stays OPEN.
  try {
    return OpenISDDriver.fromJsonRecord(record as never).toWdrText();
  } catch (e) {
    return { value: null, errors: [err('specs', `openisd.yml record shape rejected: ${String(e)}`)] };
  }
}
