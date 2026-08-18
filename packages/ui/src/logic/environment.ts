/**
 * Air properties (sound velocity, density) for an environment a component holds as draft
 * state — e.g. the app-level default temperature/humidity/pressure edited in OptionsModal
 * before it is saved. Wraps engine `air.ts`'s `airFor`, the one place this physics lives.
 */
import { airFor, RHO, C } from '@openisd/engine';
import type { Air, AirEnvironment } from '@openisd/engine';

export function airForEnvironment(env: AirEnvironment): Air {
  return airFor(env);
}

/** OpenISD's fixed engine constants (20°C air density, speed of sound) — re-exported so the
 *  driver editor's read-only Environment readout does not import `@openisd/engine` itself. */
export { RHO, C };
