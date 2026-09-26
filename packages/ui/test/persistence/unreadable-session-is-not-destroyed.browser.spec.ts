/**
 * A stored open-project session that cannot be restored must survive the boot that failed to
 * read it.
 *
 * It did not: the boot flashed a message, carried on with no project, and then saved the
 * session it had ended up with — `{"entries":[],"focusedId":null}`, 31 bytes — over the record
 * holding the user's open projects. One refusal by the record validator therefore destroyed
 * every open project instead of failing one boot. Reported from https://openisd.app/ on
 * 2026-09-25 with exactly those 31 bytes in storage.
 *
 * The boot copies such a record to `openisd_quarantine_session` before anything can write over
 * it — the same move the driver doors make with a record they refuse. The app then carries on
 * with a working session key instead of failing the same way on every future load, and the
 * bytes stay recoverable.
 */
import {expect, openAProject, test} from '../fixtures.js';

/** A session record of the right shape whose entries are not loadable projects — every entry
 *  is refused, so the boot restores nothing and quarantines the record. */
const UNREADABLE = '{"entries":[{"id":"a","text":"{}","modified":""},{"id":"b","text":"{}","modified":""}],"focusedId":"b"}';

async function bootWithUnreadableSession(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(record => {
    localStorage.setItem('openisd_open_sessions', record);
    localStorage.setItem('openisd_view', JSON.stringify({ui: {splashSeen: true}}));
  }, UNREADABLE);
  await page.goto('/');
  await expect(page.locator('.original-root')).toBeVisible();
}

const storedSession = (page: import('@playwright/test').Page) =>
  page.evaluate(() => localStorage.getItem('openisd_open_sessions'));

const quarantined = (page: import('@playwright/test').Page) =>
  page.evaluate(() => localStorage.getItem('openisd_quarantine_session'));

test('the unreadable record is kept, byte for byte, where the next save cannot reach it', async ({page, browserLog}) => {
  await bootWithUnreadableSession(page);
  // The boot reports the refusal to the user, which is how we know it has run far enough to
  // have written the record had it been going to.
  await expect(page.locator('.flash')).toContainText('of your open projects');
  browserLog.reset();   // that message is expected; this test is about the record

  expect(await quarantined(page)).toBe(UNREADABLE);
  expect(await storedSession(page)).not.toBe(UNREADABLE);   // the live key is usable again
});

test('saving resumes once a project is open again', async ({page, browserLog}) => {
  await bootWithUnreadableSession(page);
  browserLog.reset();

  await openAProject(page);

  await expect.poll(() => storedSession(page), {timeout: 5000}).not.toBe(UNREADABLE);
  expect(await storedSession(page)).toContain('entries');
});
