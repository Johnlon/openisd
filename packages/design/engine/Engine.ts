/**
 * The engine: the package's calculations, aggregated as cohesive areas — one member per area,
 * each an interface with one implementation, built once here and sharing the app's settings.
 * A consumer holds the one area it uses (`engine.filters`, `engine.vent`, …), never the
 * aggregate; the composition root is the one place that holds this whole.
 */
import {defaultAppSettings} from './appSettings.js';
import type {AppSettings} from './appSettings.js';
import type {EnvironmentEngine} from './environment/EnvironmentEngine.js';
import {EnvironmentEngineImpl} from './environment/EnvironmentEngine.js';
import type {DriverEngine} from './driver/DriverEngine.js';
import {DriverEngineImpl} from './driver/DriverEngine.js';
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

export class Engine {
  /** The air a design runs in, and the app's environment defaults. */
  readonly environment: EnvironmentEngine;
  /** The T/S consistency solve and the driver's derived indicators. */
  readonly driver: DriverEngine = new DriverEngineImpl();
  /** Drive voltage and power. */
  readonly signal: SignalEngine = new SignalEngineImpl();
  /** The `DqIssue` constructors a caller outside the engine may need. */
  readonly issues: IssueEngine = new IssueEngineImpl();
  /** Sealed-box resonance, volume↔Qtc, alignment options, the handle solve. */
  readonly sealed: SealedEngine = new SealedEngineImpl();
  /** The wizard's vented alignments and the plausibility of what they design. */
  readonly vented: VentedEngine;
  /** Port length↔tuning, acoustic length, the handle solve. */
  readonly vent: VentEngine = new VentEngineImpl();
  /** The passive radiator's own quantities, system tuning, the handle solve. */
  readonly pr: PrEngine = new PrEngineImpl();
  /** Filter defaults, captions, `.wpr` in and out, the typed edits. */
  readonly filters: FilterEngine = new FilterEngineImpl();
  /** The sweep, the limit curves, the enclosure precondition, the chart readouts and classifiers. */
  readonly simulation: SimulationEngine = new SimulationEngineImpl();
  /** Which topologies simulate, which charts a box shows, the display defaults. */
  readonly box: BoxEngine = new BoxEngineImpl();

  /** `settings` is read at CALL time by the areas that judge against it (`vented`,
   *  `environment`). Defaulted, so a test's `new Engine()` answers with the factory values; the
   *  composition root hands the running app the stored settings instead. */
  constructor(settings: AppSettings = defaultAppSettings) {
    this.environment = new EnvironmentEngineImpl(settings);
    this.vented = new VentedEngineImpl(settings);
  }
}
