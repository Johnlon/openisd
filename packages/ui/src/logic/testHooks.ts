/**
 * The browser suite's one way into the running app: the `appState` and `presentationState`
 * modules, published on `globalThis` under `TEST_HOOKS_KEY` by the composition root, and only
 * in a `vite build --mode test` (the suite's server, playwright.config.js). The deployed app and
 * the dev server install nothing: the fixtures (packages/ui/test/fixtures.ts) used to
 * `import('/src/logic/appState.ts')` from the page, which only a dev server can answer, and
 * every spec then paid a compile-on-demand page load (50–80 s under load, 11 Oct 2026).
 */
export interface TestHooks {
  appState: typeof import('./appState.js');
  presentationState: typeof import('./presentationState.js');
}

export const TEST_HOOKS_KEY = 'openisdTestHooks';

export function installTestHooks(hooks: TestHooks, mode: string): void {
  if (mode !== 'test') return;
  Reflect.set(globalThis, TEST_HOOKS_KEY, hooks);
}
