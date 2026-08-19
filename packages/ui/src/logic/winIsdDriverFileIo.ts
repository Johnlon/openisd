/**
 * The `.wdr` import/export verbs. `winIsdDriverFileIo.ts` carries its own ruled exemption to
 * name `OpenISDDriver` as a value (architecture.test.ts, "containment is total") — the ONLY
 * other files with that exemption are `managedProject.ts` itself and `DriverEditorModal.vue`.
 * Every other logic module (`store.ts`, `driverSelection.ts`, `useDesignIO.ts`) calls the
 * record-typed `_parseWdr` here rather than naming `OpenISDDriver` directly.
 */
import { OpenISDDriver } from '@openisd/model';
import type { _OpenISDDriverJson } from '@openisd/model';
import type { Result } from '@openisd/engine';

/**
 * Human ruling: the ONLY files, `packages/`-relative, permitted to name `_parseWdr` —
 * enforced by `packages/ui/test/ui/architecture.test.ts` the same way as
 * `_OpenISDDriverJsonPrivateAllow` in openisdDriver.ts. ONLY the human may add, remove, or
 * change an entry here — no agent may edit this list on its own judgement.
 */
export const _parseWdrPrivateAllow: string[] = [];

/** `.wdr` text → the app's one record shape. */
export function _parseWdr(text: string): _OpenISDDriverJson {
  return OpenISDDriver.fromWdrText(text).toRecord();
}

/** A driver → `.wdr` text. `errors` names what is missing when export can't complete. */
export function exportDriver(driver: OpenISDDriver): Result<string> {
  const { value, errors } = driver.toWinISDDriver();
  return { value: value ? value.toWdr() : null, errors };
}
