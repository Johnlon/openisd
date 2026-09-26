/**
 * A stored open-project session that cannot be restored must survive the boot that failed to
 * read it.
 *
 * It did not: the boot flashed a message, carried on with no project, and then saved the
 * session it had ended up with — `{"entries":[],"focusedId":null}`, 31 bytes — over the record
 * holding the user's open projects. One refusal by the record validator therefore destroyed
 * every open project instead of failing one boot. Reported from https://openisd.app/ on
 * 2026-09-25 with exactly those 31 bytes in storage.
 */
import {expect, openAProject, test} from '../fixtures.js';

/** A session record whose entries are well-formed JSON but not loadable projects. */
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

test('the unreadable record is left exactly as it was found', async ({page, browserLog}) => {
  await bootWithUnreadableSession(page);
  // The boot reports the refusal to the user, which is how we know it has run far enough to
  // have written the record had it been going to.
  await expect(page.locator('.flash')).toContainText('Could not restore open projects');
  browserLog.reset();   // that message is expected; this test is about the record
  expect(await storedSession(page)).toBe(UNREADABLE);
});

test('saving resumes once a project is open again', async ({page, browserLog}) => {
  await bootWithUnreadableSession(page);
  browserLog.reset();

  await openAProject(page);

  await expect.poll(() => storedSession(page), {timeout: 5000}).not.toBe(UNREADABLE);
  expect(await storedSession(page)).toContain('entries');
});
