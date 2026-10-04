import type {Page} from '@playwright/test';

type AppState = typeof import('../../src/logic/appState.js');
type BoxType = ReturnType<AppState['requireFocusedProject']>['box']['boxType']['value'];

const APP_STATE = '/src/logic/appState.ts';

/** Sets the focused project's box type through the domain (not the Box tab's select), the way a
 *  file load would. */
export async function setFocusedBoxType(page: Page, boxType: BoxType): Promise<void> {
  await page.evaluate(async ({path, boxType}) => {
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = await import(/* @vite-ignore */ path);
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    m.requireFocusedProject().box.boxType.set(boxType);
  }, {path: APP_STATE, boxType});
}

/** Renames the focused project through the domain. */
export async function renameFocusedProject(page: Page, name: string): Promise<void> {
  await page.evaluate(async ({path, name}) => {
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = await import(/* @vite-ignore */ path);
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    m.requireFocusedProject().name.set(name);
  }, {path: APP_STATE, name});
}
