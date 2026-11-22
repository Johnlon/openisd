/**
 * Runs a hook the way the browser does — client-side, so its computeds CACHE. `renderToString`
 * cannot show a value going stale: server-side computeds recompute on every read.
 */
import {type ComputedRef, createApp} from 'vue';
import type {OpenISDProject} from '@openisd/design';
import {APP_LOGIC, type AppLogic} from '../../src/logic/app.js';
import {FOCUSED_PROJECT} from '../../src/logic/focusedProjectContext.js';
import {provideTelemetryUi, type TelemetryUi} from '../../src/hooks/telemetryContext.js';
import {testAppLogic} from './testAppLogic.js';

/** `logic` defaults to a fresh one; pass the test's own when it also reads or writes its `appState`. */
export function runHook<T>(project: ComputedRef<OpenISDProject>, hook: () => T, logic: AppLogic = testAppLogic(), telemetryUi?: TelemetryUi): T {
  const app = createApp({ render: () => null });
  app.provide(APP_LOGIC, logic);
  app.provide(FOCUSED_PROJECT, project);
  if (telemetryUi !== undefined) provideTelemetryUi(app, telemetryUi);
  return app.runWithContext(hook);
}

