/**
 * Air properties (sound velocity, density) for an environment a component holds as draft
 * state — e.g. the app-level default temperature/humidity/pressure edited in OptionsModal
 * before it is saved. Wraps engine `air.ts`'s `airFor`, the one place this physics lives.
 */
import { airFor } from '@openisd/engine';
import type { Air, AirEnvironment } from '@openisd/engine';

export function airForEnvironment(env: AirEnvironment): Air {
  return airFor(env);
}
