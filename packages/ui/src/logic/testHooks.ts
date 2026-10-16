/**
 * The browser suite's one way into the running app: the `appState` and `presentationState`
 * instances, published on `globalThis` under `TEST_HOOKS_KEY` by the composition root, and only
 * in a `vite build --mode test` (the suite's server, playwright.config.js). The deployed app and
 * the dev server install nothing: the fixtures (packages/ui/test/fixtures.ts) used to
 * `import('/src/logic/appState.ts')` from the page, which only a dev server can answer, and
 * every spec then paid a compile-on-demand page load (50–80 s under load, 11 Oct 2026).
 */
import type {AppState} from './appState.js';
import type {PresentationState} from './presentationState.js';
import type {ScriptedUpdateHost} from './scriptedUpdateHost.js';

export interface TestHooks {
  appState: AppState;
  presentationState: PresentationState;
  /** The scripted service worker host: the suite's build has no worker. */
  updateHost: ScriptedUpdateHost;
}

export const TEST_HOOKS_KEY = 'openisdTestHooks';

export function installTestHooks(hooks: TestHooks, mode: string): void {
  if (mode !== 'test') return;
  Reflect.set(globalThis, TEST_HOOKS_KEY, hooks);
}
