/**
 * Runs a hook the way the browser does — client-side, so its computeds CACHE. `renderToString`
 * cannot show a value going stale: server-side computeds recompute on every read.
 */
import {type ComputedRef, createApp} from 'vue';
import type {OpenISDProject} from '@openisd/design';
import {APP_LOGIC} from '../../src/logic/app.js';
import {FOCUSED_PROJECT} from '../../src/logic/focusedProjectContext.js';
import {testAppLogic} from './testAppLogic.js';

export function runHook<T>(project: ComputedRef<OpenISDProject>, hook: () => T): T {
  const app = createApp({ render: () => null });
  app.provide(APP_LOGIC, testAppLogic());
  app.provide(FOCUSED_PROJECT, project);
  return app.runWithContext(hook);
}
