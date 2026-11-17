/** A TelemetryUi whose usage events land in `events`, for hook tests that check what is counted. */
import {createMemoryStorage} from '@openisd/persistence';
import type {TelemetryUi} from '../../src/hooks/telemetryContext.js';
import {CrashReports} from '../../src/logic/telemetry/crashReports.js';
import {ErrorContext, RecentActions} from '../../src/logic/telemetry/errorContext.js';
import type {TelemetryEvent} from '../../src/logic/telemetry/events.js';
import {FeatureUse} from '../../src/logic/telemetry/featureUse.js';
import {InstallMarker} from '../../src/logic/telemetry/install.js';
import {LaunchReporter, type LaunchEnvironment} from '../../src/logic/telemetry/launch.js';
import {NoTelemetry, type Telemetry} from '../../src/logic/telemetry/telemetry.js';

const LAUNCH_ENV: LaunchEnvironment = {
  standalone: false, platformHint: undefined, userAgent: 'test',
  screenW: 1440, screenH: 900, lang: 'en-GB', referrer: '', keysLost: [],
};

export interface RecordingTelemetryUi {
  readonly telemetryUi: TelemetryUi;
  readonly events: TelemetryEvent[];
}

export function recordingTelemetryUi(): RecordingTelemetryUi {
  const events: TelemetryEvent[] = [];
  const telemetry: Telemetry = {record: e => events.push(e), flush: () => {}};
  const actions = new RecentActions();
  const errorContext = new ErrorContext({screen: () => 'test', dialog: () => 'none', projects: () => 1, box: () => 'sealed', actions, device: () => 'test'});
  return {
    events,
    telemetryUi: {
      featureUse: new FeatureUse(telemetry, actions),
      crashReports: new CrashReports(telemetry, errorContext, async () => ''),
      launch: new LaunchReporter(telemetry, () => LAUNCH_ENV, work => work(), new InstallMarker(new NoTelemetry(), createMemoryStorage())),
      actions,
      // A radiator pick lands in `events` too; the bundled name lookup is radiatorPick.test.ts's job.
      radiatorPicks: {
        bundled: id => telemetry.record({kind: 'radiator_pick', source: 'bundled', id, name: ''}),
        saved: () => telemetry.record({kind: 'radiator_pick', source: 'mine', id: '', name: ''}),
      },
    },
  };
}
