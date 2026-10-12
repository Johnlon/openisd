import type {Page} from '@playwright/test';

type AppState = typeof import('../../src/logic/appState.js');
type BoxType = ReturnType<AppState['requireFocusedProject']>['box']['boxType']['value'];

// The app installs its live state on globalThis.openisdTestHooks in a mode-test build (testHooks.ts).
const HOOKS = 'openisdTestHooks';
const APP_STATE = 'appState';

/** Sets the focused project's box type through the domain (not the Box tab's select), the way a
 *  file load would. */
export async function setFocusedBoxType(page: Page, boxType: BoxType): Promise<void> {
  await page.evaluate(({hooks, path, boxType}) => {
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const h: unknown = Reflect.get(globalThis, hooks);
    const m: unknown = typeof h === 'object' && h !== null ? Reflect.get(h, path) : undefined;
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    m.requireFocusedProject().box.boxType.set(boxType);
  }, {hooks: HOOKS, path: APP_STATE, boxType});
}

/** Renames the focused project through the domain. */
export async function renameFocusedProject(page: Page, name: string): Promise<void> {
  await page.evaluate(({hooks, path, name}) => {
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const h: unknown = Reflect.get(globalThis, hooks);
    const m: unknown = typeof h === 'object' && h !== null ? Reflect.get(h, path) : undefined;
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    m.requireFocusedProject().name.set(name);
  }, {hooks: HOOKS, path: APP_STATE, name});
}
