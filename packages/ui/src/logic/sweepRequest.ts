/**
 * What the sweep worker computes for one request: the project's sweep and, when asked, its max
 * curves, from a `SweepJob` (plain data, structured-cloned across the Worker boundary).
 */
import type {MaxCurvesSolveResult, SimulationEngine, SweepSolveResult} from '@openisd/design/engine';
import {runMaxCurvesJob, runSweepJob} from '@openisd/design';
import type {SweepJob} from '@openisd/design';

export interface SweepRequest {
  readonly id: number;
  readonly job: SweepJob;
  readonly withMax: boolean;
}

export interface SweepReply {
  readonly id: number;
  readonly sweep: SweepSolveResult;
  /** null when the request did not ask for max curves. */
  readonly max: MaxCurvesSolveResult | null;
}

export class SweepComputer {
  constructor(private readonly simulation: SimulationEngine) {}

  run(req: SweepRequest): SweepReply {
    return {
      id: req.id,
      sweep: runSweepJob(this.simulation, req.job),
      max: req.withMax ? runMaxCurvesJob(this.simulation, req.job) : null,
    };
  }
}
