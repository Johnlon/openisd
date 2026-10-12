import type {Page} from '@playwright/test';

type AppState = import('../../src/logic/appState.js').AppState;
type BoxType = ReturnType<AppState['requireFocusedProject']>['box']['boxType']['value'];

/** Sets the focused project's box type through the domain (not the Box tab's select), the way a
 *  file load would. */
export async function setFocusedBoxType(page: Page, boxType: BoxType): Promise<void> {
  await page.evaluate(async ({boxType}) => {
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = ((h: unknown): unknown => typeof h === 'object' && h !== null ? Reflect.get(h, 'appState') : undefined)(Reflect.get(globalThis, 'openisdTestHooks'));
    if (!isAppState(m)) throw new Error('appState shape mismatch');
    m.requireFocusedProject().box.boxType.set(boxType);
  }, {boxType});
}

/** Renames the focused project through the domain. */
export async function renameFocusedProject(page: Page, name: string): Promise<void> {
  await page.evaluate(async ({name}) => {
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = ((h: unknown): unknown => typeof h === 'object' && h !== null ? Reflect.get(h, 'appState') : undefined)(Reflect.get(globalThis, 'openisdTestHooks'));
    if (!isAppState(m)) throw new Error('appState shape mismatch');
    m.requireFocusedProject().name.set(name);
  }, {name});
}
