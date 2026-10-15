import type {ChartId} from '@openisd/design/engine';
import type {FeatureName} from './events.js';
import type {Telemetry} from './telemetry.js';

/** Records each chart viewed and each feature used once per page session. Records only; the
 *  visibility/pagehide flush sends them. */
export class FeatureUse {
  private readonly charts = new Set<ChartId>();
  private readonly features = new Set<FeatureName>();

  constructor(private readonly telemetry: Telemetry) {}

  /** How many different charts this page session has viewed. */
  chartsViewed(): number {
    return this.charts.size;
  }

  chart(id: ChartId): void {
    if (this.charts.has(id)) return;
    this.charts.add(id);
    this.telemetry.record({kind: 'chart_view', chart: id});
  }

  feature(name: FeatureName): void {
    if (this.features.has(name)) return;
    this.features.add(name);
    this.telemetry.record({kind: 'feature', name});
  }
}
