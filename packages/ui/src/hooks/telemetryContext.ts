import {type App, inject, type InjectionKey} from 'vue';
import type {CrashReports} from '../logic/telemetry/crashReports.js';
import type {LaunchReporter} from '../logic/telemetry/launch.js';
import {FeatureUse} from '../logic/telemetry/featureUse.js';
import {NoTelemetry} from '../logic/telemetry/telemetry.js';

/** What the presentation layer is given of telemetry. */
export interface TelemetryUi {
  readonly crashReports: CrashReports;
  readonly launch: LaunchReporter;
  readonly featureUse: FeatureUse;
}

const TELEMETRY_UI: InjectionKey<TelemetryUi> = Symbol('openisd.telemetry');

export function provideTelemetryUi(app: App, ui: TelemetryUi): void {
  app.provide(TELEMETRY_UI, ui);
}

export function useTelemetryUi(): TelemetryUi {
  const ui = inject(TELEMETRY_UI);
  if (!ui) throw new Error('useTelemetryUi(): telemetry was not provided by the composition root');
  return ui;
}

/** The page session's feature-use recorder; records nothing where no composition root provided one (unit tests of a hook). */
export function useFeatureUse(): FeatureUse {
  return inject(TELEMETRY_UI, null)?.featureUse ?? new FeatureUse(new NoTelemetry());
}
