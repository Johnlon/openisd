/**
 * The engine: the package's calculations, aggregated as cohesive areas — one member per area,
 * each an interface with one implementation, built once by `createEngine` and sharing the app's
 * settings.
 * A consumer holds the one area it uses (`engine.filters`, `engine.vent`, …), never the
 * aggregate; the composition root is the one place that holds this whole.
 */
import {defaultAppSettings} from './appSettings.js';
import type {AppSettings} from './appSettings.js';
import type {EnvironmentEngine} from './environment/EnvironmentEngine.js';
import {EnvironmentEngineImpl} from './environment/EnvironmentEngine.js';
import type {DriverEngine} from './driver/DriverEngine.js';
import {DriverEngineImpl} from './driver/DriverEngine.js';
import {DRIVER_ROUTES, DriverAir, RADIATOR_ROUTES, RouteGroup} from './driver/routes/index.js';
import type {SignalEngine} from './signal/SignalEngine.js';
import {SignalEngineImpl} from './signal/SignalEngine.js';
import type {IssueEngine} from './issues/IssueEngine.js';
import {IssueEngineImpl} from './issues/IssueEngine.js';
import type {SealedEngine} from './sealed/SealedEngine.js';
import {SealedEngineImpl} from './sealed/SealedEngine.js';
import type {VentedEngine} from './vented/VentedEngine.js';
import {VentedEngineImpl} from './vented/VentedEngine.js';
import type {VentEngine} from './vent/VentEngine.js';
import {VentEngineImpl} from './vent/VentEngine.js';
import type {PrEngine} from './pr/PrEngine.js';
import {PrEngineImpl} from './pr/PrEngine.js';
import type {FilterEngine} from './filters/index.js';
import {FilterEngineImpl} from './filters/index.js';
import type {SimulationEngine} from './simulation/SimulationEngine.js';
import {SimulationEngineImpl} from './simulation/SimulationEngine.js';
import type {BoxEngine} from './box/BoxEngine.js';
import {BoxEngineImpl} from './box/BoxEngine.js';

export interface Engine {
  /** The air a design runs in, and the app's environment defaults. */
  readonly environment: EnvironmentEngine;
  /** The T/S consistency solve and the driver's derived indicators. */
  readonly driver: DriverEngine;
  /** Drive voltage and power. */
  readonly signal: SignalEngine;
  /** The `DqIssue` constructors a caller outside the engine may need. */
  readonly issues: IssueEngine;
  /** Sealed-box resonance, volume↔Qtc, alignment options, the handle solve. */
  readonly sealed: SealedEngine;
  /** The wizard's vented alignments and the plausibility of what they design. */
  readonly vented: VentedEngine;
  /** Port length↔tuning, acoustic length, the handle solve. */
  readonly vent: VentEngine;
  /** The passive radiator's own quantities, system tuning, the handle solve. */
  readonly pr: PrEngine;
  /** Filter defaults, captions, `.wpr` in and out, the typed edits. */
  readonly filters: FilterEngine;
  /** The sweep, the limit curves, the enclosure precondition, the chart readouts and classifiers. */
  readonly simulation: SimulationEngine;
  /** Which topologies simulate, which charts a box shows, the display defaults. */
  readonly box: BoxEngine;

}

class EngineImpl implements Engine {
  readonly environment: EnvironmentEngine;
  private readonly driverAir = new DriverAir();
  readonly driver: DriverEngine = new DriverEngineImpl(new RouteGroup(DRIVER_ROUTES, this.driverAir), this.driverAir);
  readonly signal: SignalEngine = new SignalEngineImpl();
  readonly issues: IssueEngine = new IssueEngineImpl();
  readonly sealed: SealedEngine = new SealedEngineImpl();
  readonly vented: VentedEngine;
  readonly vent: VentEngine = new VentEngineImpl();
  readonly pr: PrEngine = new PrEngineImpl(new RouteGroup(RADIATOR_ROUTES, this.driverAir));
  readonly filters: FilterEngine = new FilterEngineImpl();
  readonly simulation: SimulationEngine = new SimulationEngineImpl();
  readonly box: BoxEngine = new BoxEngineImpl();

  constructor(settings: AppSettings) {
    this.environment = new EnvironmentEngineImpl(settings);
    this.vented = new VentedEngineImpl(settings);
  }
}

/** The one way an engine comes into existence. `settings` is read at CALL time by the areas
 *  that judge against it (`vented`, `environment`); defaulted, so a test's `createEngine()`
 *  answers with the factory values, while the composition root hands the running app the
 *  stored settings. Called once per program — `architecture-engine-boundary.test.ts` names the
 *  two roots. */
export function createEngine(settings: AppSettings = defaultAppSettings): Engine {
  return new EngineImpl(settings);
}
