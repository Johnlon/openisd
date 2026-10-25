import type {FeatureUse} from './featureUse.js';
import type {Telemetry} from './telemetry.js';

/** Records, once, how long the page session lasted and how many charts it viewed. */
export class SessionEnd {
  private ended = false;

  constructor(
    private readonly telemetry: Telemetry,
    private readonly featureUse: FeatureUse,
    private readonly now: () => number,
    private readonly startedAt: number,
  ) {}

  end(): void {
    if (this.ended) return;
    this.ended = true;
    this.telemetry.record({kind: 'session_end', seconds: Math.round((this.now() - this.startedAt) / 1000), charts: this.featureUse.chartsViewed()});
  }
}
