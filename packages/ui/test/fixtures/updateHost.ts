import type {Page} from '@playwright/test';

/** A new build has downloaded and waits, and the app comes back into view. The suite's build has no service
 *  worker, so this drives the scripted host the composition root publishes (scriptedUpdateHost.ts). */
export async function deliverWaitingBuild(page: Page): Promise<void> {
  await page.evaluate(() => {
    const host: unknown = ((h: unknown): unknown => typeof h === 'object' && h !== null ? Reflect.get(h, 'updateHost') : undefined)(Reflect.get(globalThis, 'openisdTestHooks'));
    if (typeof host !== 'object' || host === null) throw new Error('no scripted update host');
    const deliver: unknown = Reflect.get(host, 'deliverWaiting');
    if (typeof deliver !== 'function') throw new Error('the scripted update host has no deliverWaiting');
    Reflect.apply(deliver, host, []);
  });
  // Bubbles to the document, where the app listens for the page coming back into view.
  await page.locator('html').dispatchEvent('visibilitychange');
}

/** The browser's storage stops taking the open-project session from now on, as it does when it is full:
 *  `setItem` throws and the app, which guards every write, carries on. A stand-in for an outside system the
 *  test cannot control (the browser's quota). Later edits stay on screen and are not stored. */
export async function refuseSessionWrites(page: Page): Promise<void> {
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string): void {
      if (key === 'openisd_open_sessions') throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      original.call(this, key, value);
    };
  });
}
