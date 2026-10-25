/**
 * The environment area of the engine: the air a design runs in — the resolved `{ rho, c }` for
 * stated conditions, with any issue those conditions carry — and the app's configured
 * environment defaults.
 */
import type {AirEnvironment, AppAir, EnvironmentIssue, EnvironmentSolveResult} from '../air.js';
import {appAirOf, solveEnvironment, temperatureIssues} from '../air.js';
import {solveAir} from './airSolver.js';
import type {AirInputs, AirSolution} from './airSolver.js';
import type {AppSettings, EnvDefaults} from '../appSettings.js';

export interface EnvironmentEngine {
  /** The resolved `{ rho, c }` and any issue the stated conditions carry — one
   *  `{ values, issues }` bundle, so one call describes one environment. */
  solve(env: AirEnvironment): EnvironmentSolveResult;
  /** The five air quantities, each entered or open: the open ones calculated from the two air
   *  relations, with the issues (conflict, missing, out of range) naming the relation's fields. */
  solveAir(inputs: AirInputs): AirSolution;
  /** What is wrong with a temperature the air model does not support; empty when it is in range. */
  temperatureIssues(tempK: number): readonly EnvironmentIssue[];
  /** The app's air: the Options constants, which a quantity no calculation gives falls back to
   *  (as calculated), and which a new project copies in as its T, RH and p (as entered). */
  readonly appAir: AppAir;
  /** The app's configured environment defaults (Options → Environment), or the reference
   *  values when nothing has been configured — `AppSettings.envDefaults()`, read at call time. */
  defaults(): EnvDefaults;
}

export class EnvironmentEngineImpl implements EnvironmentEngine {
  /** `air.ts`'s own solve, published as-is: the engine's other areas call it directly for
   *  reference air, so the function stays free and this area is its door. */
  readonly solve = solveEnvironment;
  /** `air.ts`'s temperature check, published as-is. */
  readonly temperatureIssues = temperatureIssues;
  readonly appAir: AppAir;
  /** The settings' own `envDefaults`, published as-is — `AppSettings` is a bag of arrows, so it
   *  needs no receiver. */
  readonly defaults: () => EnvDefaults;

  constructor(settings: AppSettings) {
    this.defaults = settings.envDefaults;
    this.appAir = appAirOf(settings.envDefaults);
  }

  /** The air solver over the app's air. */
  solveAir(inputs: AirInputs): AirSolution {
    return solveAir(inputs, this.appAir);
  }
}
