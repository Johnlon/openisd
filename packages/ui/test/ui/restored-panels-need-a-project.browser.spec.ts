/**
 * A stored view can say the Tune panel or the Driver Editor was open. Reloading with no
 * project open must not reopen them: both read the focused project, and there is none, so
 * they threw `no project is focused` through the top-level gate's computed and left the
 * fault dialog up. Reported from https://openisd.app/ on 2026-09-25.
 *
 * The fixture's own console assertion is what catches the throw — these tests also state the
 * visible consequence, so a failure says which panel came back.
 */
import {expect, test} from '../fixtures.js';

/** Boot with no project and a stored view that claims `key` was open. */
async function bootWith(page: import('@playwright/test').Page, key: string): Promise<void> {
  await page.addInitScript(k => {
    localStorage.setItem('openisd_view', JSON.stringify({ui: {splashSeen: true, [k]: true}}));
  }, key);
  await page.goto('/');
  await expect(page.locator('.original-root')).toBeVisible();
}

test('a stored open Tune panel does not reopen when no project is open', async ({page}) => {
  await bootWith(page, 'originalTuneOpen');
  await expect(page.locator('.tune-panel')).toHaveCount(0);
});

test('a stored open Driver Editor does not reopen when no project is open', async ({page}) => {
  await bootWith(page, 'originalEditorOpen');
  await expect(page.locator('.de-modal')).toHaveCount(0);
});
