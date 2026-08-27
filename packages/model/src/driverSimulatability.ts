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
import type { OpenISDDriver } from './openisdDriver.js';
import { Engine } from '@openisd/design/engine';

function isPositive(v: number | null): boolean {
  return typeof v === 'number' && v > 0;
}

/** The Q-group's three members, by name, for `qGroupIsIncomplete`'s generic callback — the
 *  ONE place this file dispatches a field name to a flat driver accessor; `SpecField` never
 *  crosses this file's own boundary (human ruling 2026-08-24, ENCAPSULATION_AND_LAYERING.md). */
function qFieldPositive(driver: OpenISDDriver, field: string): boolean {
  switch (field) {
    case 'Qts': return isPositive(driver.Qts());
    case 'Qes': return isPositive(driver.Qes());
    case 'Qms': return isPositive(driver.Qms());
    default: return false;
  }
}

export function driverIsSimulatable(driver: OpenISDDriver): boolean {
  const hasFsOk = isPositive(driver.Fs());
  const hasReOk = isPositive(driver.Re());
  const hasSdOk = isPositive(driver.Sd()) || isPositive(driver.Vas());   // Sd or Vas is enough for area
  return hasFsOk && hasReOk && hasSdOk
    && !new Engine().qGroupIsIncomplete(field => qFieldPositive(driver, field));
}
