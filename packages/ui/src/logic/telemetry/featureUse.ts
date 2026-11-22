import type {ChartId} from '@openisd/design/engine';
import type {AnnouncementEvent, DriverSearchEmptyEvent, FeedbackPromptEvent, FeatureName, ValuesProblemSeenEvent} from './events.js';
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
  backup: 'feature:backup',
  restore: 'feature:restore',
  chart_data: 'feature:chart_data',
  driver_editor: 'dialog:driver-editor',
  skin_switch: 'feature:skin_switch',
  winisd_differences: 'dialog:winisd-differences',
  bin_restore: 'feature:bin_restore',
  history_restore: 'feature:history_restore',
  cloud_connect: 'dialog:cloud-sync',
  cloud_sync: 'feature:cloud_sync',
  box_type: 'feature:box_type',
  alignment: 'feature:alignment',
  help: 'feature:help',
  compat_switch: 'feature:compat_switch',
  losses: 'feature:losses',
  signal_generator: 'feature:signal_generator',
  save_my_driver: 'feature:save_my_driver',
  driver_clone: 'feature:driver_clone',
  multi_driver_wiring_changed: 'feature:multi_driver_wiring_changed',
  coil_wiring_changed: 'feature:coil_wiring_changed',
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

  private readonly emptySearches = new Set<string>();
  private readonly problems = new Set<string>();

  /** The driver list's filters gave no driver: once per distinct filter set (the search text counts as on or off, not as typed). */
  driverSearchEmpty(event: DriverSearchEmptyEvent): void {
    const key = JSON.stringify({...event, textLength: event.textLength > 0});
    if (this.emptySearches.has(key)) return;
    this.emptySearches.add(key);
    this.telemetry.record(event);
  }

  /** A driver's disagreeing values, or a refused entry, were shown: once per field per driver per page session. */
  valuesProblemSeen(event: ValuesProblemSeenEvent): void {
    const key = `${event.problem}|${event.field}|${event.driver}`;
    if (this.problems.has(key)) return;
    this.problems.add(key);
    this.telemetry.record(event);
  }

  private readonly announcements = new Set<string>();

  /** The update popup was seen, dismissed or closed: once per stage per announcement per page session. */
  announcement(event: AnnouncementEvent): void {
    const key = `${event.stage}|${event.id}|${event.view}`;
    if (this.announcements.has(key)) return;
    this.announcements.add(key);
    this.telemetry.record(event);
  }

  private readonly feedbackPrompts = new Set<string>();

  /** The feedback question was shown, put off with "Not now" or closed unanswered: once per outcome per page session. */
  feedbackPrompt(event: FeedbackPromptEvent): void {
    if (this.feedbackPrompts.has(event.outcome)) return;
    this.feedbackPrompts.add(event.outcome);
    this.telemetry.record(event);
  }

  feature(name: FeatureName): void {
    this.actions?.record(FEATURE_ACTIONS[name]);
    if (this.features.has(name)) return;
    this.features.add(name);
    this.telemetry.record({kind: 'feature', name});
  }
}
