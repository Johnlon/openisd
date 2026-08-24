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
 * go through `winisdTextToBytes`/`winisdBytesToText` in `@openisd/winisd`'s `winisdBytes.ts`; this
 * function does not touch that boundary at all.
 */
import { parse } from 'yaml';
import type { DriverError, Result } from '@openisd/engine';
import { OpenISDDriver } from './openisdDriver.js';

export function openisdYamlToWdr(yamlText: string): Result<string> {
  const err = (field: string, message: string): DriverError => ({ level: 'error', field, message });
  let record: unknown;
  try {
    // `logLevel: 'error'` because this function is the V8-bridge boundary: the `yaml`
    // package's default `'warn'` calls `console.warn` on parser warnings, and the bridge runs
    // inside a host (py-mini-racer) whose console it knows nothing about and whose output no
    // caller can read. Diagnostics leave through the returned `errors` instead — the only
    // channel that reaches the caller.
    // NOT `'silent'`: that level also stops the parser THROWING on malformed input, so a
    // broken document would return a partial record and convert to a hollow `.wdr` instead of
    // being reported. Warnings off, errors still raised.
    record = parse(yamlText, { logLevel: 'error' });
  } catch (e) {
    return { value: null, errors: [err('yaml', `could not parse openisd.yml: ${String(e)}`)] };
  }
  if (record == null || typeof record !== 'object' || !('specs' in record)) {
    return { value: null, errors: [err('yaml', 'openisd.yml did not parse to a record')] };
  }
  // Interim per BUG_20260822 (see docstring): `fromJsonRecord`/its getters throw on a record
  // whose `specs` interior is not the `SpecEntry` shape (`specs: {woofer: {fs: 12}}` — a
  // plausible V8-bridge input). The right fix is `fromJsonRecord` refusing that shape itself
  // (`Result<OpenISDDriver>`), which reaches its callers in `@openisd/model` and
  // `packages/ui/src/logic` (managedProject.ts, useDesignIO.ts); this catch is the
  // acknowledged interim — the bug stays OPEN.
  try {
    return OpenISDDriver.fromJsonRecord(record as never).toWdrText();
  } catch (e) {
    return { value: null, errors: [err('specs', `openisd.yml record shape rejected: ${String(e)}`)] };
  }
}
