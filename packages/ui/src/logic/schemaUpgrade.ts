/** The app's ONE upgrade seam for a versioned browser-storage payload (2026-08-17 policy):
 *  every payload that outlives the session states its `schema` number, and reading it is a
 *  repair — walk forward from the stored version to `current`, one step per version. A
 *  payload newer than `current`, or older than the oldest registered step, has no route and
 *  reads as unreadable; the caller (`MyDriverRepo`) turns that into "stop and ask the human"
 *  via its Export/Delete surface.
 *
 *  `current` is 1 and no steps are registered yet, so `repair` only ever accepts schema 1
 *  as-is — there is nothing to upgrade FROM until an older format actually ships. */
import type { MyDriversSchema } from '@openisd/persistence';

const CURRENT_SCHEMA = 1;

/** One step's shape: turns a payload at `from` into one at `from + 1`. Registered here, in
 *  version order, as older shapes are retired. */
type UpgradeStep = (drivers: unknown[]) => unknown[];

const STEPS: readonly UpgradeStep[] = [];

export function createMyDriversSchema(): MyDriversSchema {
  return {
    current: CURRENT_SCHEMA,
    repair(blob) {
      let schema = typeof blob.schema === 'number' ? blob.schema : NaN;
      let drivers = Array.isArray(blob.drivers) ? blob.drivers : null;
      if (!Number.isInteger(schema) || schema < 1 || drivers === null) return null;
      if (schema > CURRENT_SCHEMA) return null; // newer build's payload — no route back

      let upgraded = false;
      while (schema < CURRENT_SCHEMA) {
        const step = STEPS[schema - 1];
        if (!step) return null; // no route past this version
        drivers = step(drivers);
        schema += 1;
        upgraded = true;
      }
      return { envelope: { schema, drivers: drivers as never[] }, upgraded };
    },
  };
}
