/**
 * The environment area of the engine: the air a design runs in — the resolved `{ rho, c }` for
 * stated conditions, with any issue those conditions carry — and the app's configured
 * environment defaults.
 */
import type {AirEnvironment, EnvironmentSolveResult} from '../air.js';
import {solveEnvironment} from '../air.js';
import type {AppSettings, EnvDefaults} from '../appSettings.js';

export interface EnvironmentEngine {
  /** The resolved `{ rho, c }` and any issue the stated conditions carry — one
   *  `{ values, issues }` bundle, so one call describes one environment. */
  solve(env: AirEnvironment): EnvironmentSolveResult;
  /** The app's configured environment defaults (Options → Environment), or the reference
   *  values when nothing has been configured — `AppSettings.envDefaults()`, read at call time. */
  defaults(): EnvDefaults;
}

export class EnvironmentEngineImpl implements EnvironmentEngine {
  /** `air.ts`'s own solve, published as-is: the engine's other areas call it directly for
   *  reference air, so the function stays free and this area is its door. */
  readonly solve = solveEnvironment;
  /** The settings' own `envDefaults`, published as-is — `AppSettings` is a bag of arrows, so it
   *  needs no receiver. */
  readonly defaults: () => EnvDefaults;

  constructor(settings: AppSettings) {
    this.defaults = settings.envDefaults;
  }
}
