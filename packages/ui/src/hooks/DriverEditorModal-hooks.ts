import type {Calculated, Entered, OpenISDDriver, Readable} from '@openisd/design';
import type {MyDriverRepo} from '@openisd/persistence';
import type {NumSpecField} from '../logic/appState.js';

/**
 * Data-quality reads for the driver editor (DriverEditorModal.vue), parameterised on `cellOf`/
 * the draft driver rather than closing over component state, so the modal's own reactive
 * `cellOf`/`draftDriver` can be passed in without this file knowing Vue exists. The chart-
 * blocking and inconsistent-input lists are the driver's own (`OpenISDDriver.chartBlockingReasons()`).
 */

/** The one DQ mark per field: its reason, or '' when there is nothing to say. A bad value (≤ 0,
 *  non-finite) is marked by the DOMAIN, on the field's own `.dq` (`Engine.positiveValueIssue`,
 *  BUG_20260927_driver-bad-value-decided-in-ui.md) — this reads that mark, never judges the
 *  value itself. */
export function dqNoteFor(cellOf: (field: NumSpecField) => Readable<number | null> & Entered & Calculated, field: NumSpecField): string {
  return cellOf(field).dq.map(issue => issue.text).join('\n');
}

export function ebpVal(driver: OpenISDDriver): number | null {
  return driver.specs.EBP_hz.value;
}

/** Save `driver` to My Drivers: over the row `replacesUuid` names, or as a new row when it is
 *  ''. False = My Drivers refused (read-only). */
export function commitMyDriver(myDrivers: MyDriverRepo, driver: OpenISDDriver, replacesUuid: string): boolean {
  return myDrivers.upsert(driver, replacesUuid === '' ? undefined : replacesUuid) !== null;
}
