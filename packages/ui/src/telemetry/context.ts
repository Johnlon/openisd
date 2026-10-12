import {type App, inject, type InjectionKey} from 'vue';
import type {CrashReports} from './crashReports.js';
import type {LaunchReporter} from './launch.js';

/** What the presentation layer is given of telemetry. */
export interface TelemetryUi {
  readonly crashReports: CrashReports;
  readonly launch: LaunchReporter;
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
