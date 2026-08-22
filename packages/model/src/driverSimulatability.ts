/**
 * Whether a driver record carries what the app's own simulation needs — DISPLAY INFORMATION
 * ONLY, never a bundling gate. QO79/QO81, John, final ruling: no driver is ever excluded for
 * missing spec params — every structurally readable record bundles, full stop. A driver with
 * no Fs ships, appears in the browser, opens in the editor, and degrades in a design exactly
 * like a user-created driver with that field left blank.
 *
 * This function's ONE consumer is `packages/ui/src/db/driverRepo.ts::driverHasDqIssues`, which
 * turns it into the ⚠ health-warning badge the picker and My Drivers show on a row — it never
 * decides whether a record is bundled or listed.
 *
 * Core fields the badge checks: `Fs`, `Re`, `Sd` or `Vas`, and at least 2 of
 * `{Qts, Qes, Qms}` — the same threshold `@openisd/engine`'s `qGroupIsIncomplete` enforces for
 * the consistency-group solve.
 */
import type { OpenISDDriver, SpecField } from './openisdDriver.js';
import { qGroupIsIncomplete } from '@openisd/engine';

export function driverIsSimulatable(driver: OpenISDDriver): boolean {
  const pos = (field: SpecField) => {
    const v = driver.cell(field).value;
    return typeof v === 'number' && v > 0;
  };
  const hasFsOk = pos('Fs');
  const hasReOk = pos('Re');
  const hasSdOk = pos('Sd') || pos('Vas');   // Sd or Vas is enough for area
  return hasFsOk && hasReOk && hasSdOk && !qGroupIsIncomplete(field => pos(field as SpecField));
}
