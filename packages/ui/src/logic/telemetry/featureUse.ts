import type {ChartId} from '@openisd/design/engine';
import type {FeatureName} from './events.js';
import type {Telemetry} from './telemetry.js';
import type {ActionName, RecentActions} from './errorContext.js';

const FEATURE_ACTIONS: Record<FeatureName, ActionName> = {
  whatif: 'dialog:whatif',
  tune: 'tune:open',
  filters: 'tab:filters',
  vents: 'tab:enclosure',
  options: 'dialog:options',
  driver_db: 'dialog:driver-browser',
  diagnostics: 'dialog:diagnostics',
  export: 'feature:export',
  import: 'feature:import',
  save_file: 'feature:save_file',
  share_link: 'feature:share_link',
};

/** Records each chart viewed and each feature used once per page session. Records only; the
 *  visibility/pagehide flush sends them. */
export class FeatureUse {
  private readonly charts = new Set<ChartId>();
  private readonly features = new Set<FeatureName>();

  constructor(
    private readonly telemetry: Telemetry,
    private readonly actions?: RecentActions,
  ) {}

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
    this.actions?.record(FEATURE_ACTIONS[name]);
    if (this.features.has(name)) return;
    this.features.add(name);
    this.telemetry.record({kind: 'feature', name});
  }
}
