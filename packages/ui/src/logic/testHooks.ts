/**
 * The browser suite's one thing in the running app: the scripted update host that stands in for a
 * service worker (the suite's build has none), published on `globalThis` under `TEST_HOOKS_KEY` by the
 * composition root, and only in a `vite build --mode test` (the suite's server, playwright.config.js).
 * The deployed app and the dev server install nothing. No app state is published: a spec acts as a
 * user does and reads the screen.
 */
import type {ScriptedUpdateHost} from './scriptedUpdateHost.js';

export interface TestHooks {
  updateHost: ScriptedUpdateHost;
}

export const TEST_HOOKS_KEY = 'openisdTestHooks';

export function installTestHooks(hooks: TestHooks, mode: string): void {
  if (mode !== 'test') return;
  Reflect.set(globalThis, TEST_HOOKS_KEY, hooks);
}
