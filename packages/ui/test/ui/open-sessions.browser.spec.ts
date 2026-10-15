import {editorTab, expect, focusedBoxVolume, openAProject, setFocusedBoxVolume, test} from '../fixtures.js';
import type {Page} from '@playwright/test';
import {z} from 'zod';

test.describe('Open sessions', () => {
  test.describe('tabs share one session', () => {
    // Every tab of the app shows the same open projects. A change made in one tab — open, close,
    // edit — appears in every other tab, and a fresh tab opens on that same session.
    // bugs/archive/BUG_20260926_tabs-overwrite-each-others-open-projects.md

    const rowNames = (page: Page) =>
      page.locator('.project-row span').evaluateAll(els => els.map(e => e.textContent?.trim() ?? ''));

    async function copyFocused(page: Page): Promise<void> {
      const before = await page.locator('.project-row').count();
      await page.locator('.proj-actions button:has-text("Copy")').click();
      await expect(page.locator('.project-row')).toHaveCount(before + 1);
    }

    test('a project opened in one tab appears in the other', async ({ page, context }) => {
      await page.goto('/');
      await openAProject(page);
      const other = await context.newPage();
      await other.goto('/');
      await expect(other.locator('.project-row')).toHaveCount(1);

      await copyFocused(other);

      await expect(page.locator('.project-row')).toHaveCount(2);
      // Both tabs are read on every poll: the other tab's names may still be settling too.
      await expect.poll(async () => {
        const [here, there] = [await rowNames(page), await rowNames(other)];
        return here.length === 2 && JSON.stringify(here) === JSON.stringify(there);
      }).toBe(true);
    });

    test('a project closed in one tab disappears from the other', async ({ page, context }) => {
      await page.goto('/');
      await openAProject(page);
      await copyFocused(page);
      const other = await context.newPage();
      await other.goto('/');
      await expect(other.locator('.project-row')).toHaveCount(2);

      await page.locator('.proj-actions button:has-text("Close")').click();
      const discard = page.locator('.close-actions button:has-text("Close without saving")');
      // eslint-disable-next-line playwright/no-conditional-in-test
      if (await discard.isVisible()) await discard.click();
      await expect(page.locator('.project-row')).toHaveCount(1);

      await expect(other.locator('.project-row')).toHaveCount(1);
    });

    test('an edit made in one tab shows in the other', async ({ page, context }) => {
      await page.goto('/');
      await openAProject(page);
      const other = await context.newPage();
      await other.goto('/');
      await expect(other.locator('.project-row')).toHaveCount(1);

      await setFocusedBoxVolume(other, 0.0111111);

      await expect.poll(() => focusedBoxVolume(page)).toBeCloseTo(0.0111111, 9);
    });

    test('a fresh tab opens on the session every tab shares', async ({ page, context }) => {
      await page.goto('/');
      await openAProject(page);
      const second = await context.newPage();
      await second.goto('/');
      await copyFocused(second);
      await expect(page.locator('.project-row')).toHaveCount(2);

      // The FIRST tab edits last. Before the fix its write carried only its own one project, so a
      // fresh tab opened on one project instead of two.
      await setFocusedBoxVolume(page, 0.0222222);

      const third = await context.newPage();
      await third.goto('/');
      await expect(third.locator('.project-row')).toHaveCount(2);
    });

    test('a display unit chosen in one tab shows in the other', async ({ page, context }) => {
      await page.goto('/');
      await openAProject(page);
      const other = await context.newPage();
      await other.goto('/');
      await expect(other.locator('.project-row')).toHaveCount(1);
      const volumeUnit = (p: Page) => p.locator('.tab-section.active .ui-field', { hasText: 'Volume' }).first().locator('.ui-field-unit');
      await page.locator('.project-nav li', { hasText: 'Box' }).click();
      await other.locator('.project-nav li', { hasText: 'Box' }).click();
      await expect(volumeUnit(other)).toHaveText('L');

      await volumeUnit(page).click();
      await expect(volumeUnit(page)).toHaveText('cu ft');

      await expect(volumeUnit(other)).toHaveText('cu ft');
    });

    test('the unsaved mark shows in the other tab when one tab edits a project', async ({ page, context }) => {
      await page.goto('/');
      await openAProject(page);
      const other = await context.newPage();
      await other.goto('/');
      await expect(other.locator('.project-row')).toHaveCount(1);
      await expect(other.locator('.project-row')).not.toHaveClass(/is-unsaved/);

      await setFocusedBoxVolume(page, 0.0111111);
      await expect(page.locator('.project-row')).toHaveClass(/is-unsaved/);

      await expect(other.locator('.project-row')).toHaveClass(/is-unsaved/);
    });

    test('a Driver Editor left open in one tab still edits the project after the other tab edits it', async ({ page, context }) => {
      await page.goto('/');
      await openAProject(page);
      const other = await context.newPage();
      await other.goto('/');
      await expect(other.locator('.project-row')).toHaveCount(1);
      await other.locator('.project-nav li', { hasText: 'Driver' }).click();
      await other.locator('.edit-btn', { hasText: 'Edit' }).click();
      await expect(other.locator('.de-modal')).toBeVisible();

      await setFocusedBoxVolume(page, 0.0111111);
      await expect.poll(() => focusedBoxVolume(other)).toBeCloseTo(0.0111111, 9);

      await editorTab(other, 'General');
      await other.locator('.de-fld', { has: other.locator('label', { hasText: 'Model' }) }).locator('input').fill('Model 111111');
      await other.locator('.de-modal .de-footer button:has-text("OK")').click();
      await expect(other.locator('.de-modal')).toBeHidden();

      const model = (p: Page) => p.locator('.driver-id-row input').nth(1);
      await expect(model(other)).toHaveValue('Model 111111');
      expect(await focusedBoxVolume(other)).toBeCloseTo(0.0111111, 9);
      await page.locator('.project-nav li', { hasText: 'Driver' }).click();
      await expect(model(page)).toHaveValue('Model 111111');
    });
  });

  test.describe('an unreadable stored session', () => {
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
     * The boot keeps each refused entry whole as a refused copy (`openisd_refused_*`, T169) before
     * anything can write over the record. The app then carries on
     * with a working session key instead of failing the same way on every future load, and the
     * bytes stay recoverable.
     */

    /** A session record of the right shape whose entries are not loadable projects — every entry
     *  is refused, so the boot restores nothing and keeps each as a refused copy. */
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

    /** The text of every refused copy held, as stored. */
    const refusedTexts = (page: import('@playwright/test').Page) =>
      page.evaluate(() => Object.keys(localStorage)
        .filter(key => key.startsWith('openisd_refused_'))
        .map((key): unknown => JSON.parse(localStorage.getItem(key) ?? 'null'))
        .map(record => (typeof record === 'object' && record !== null && 'text' in record ? record.text : null)));

    test('each unreadable entry is kept whole as a refused copy, where the next save cannot reach it', async ({page, browserLog}) => {
      await bootWithUnreadableSession(page);
      // The boot reports the refusal to the user, which is how we know it has run far enough to
      // have written the record had it been going to.
      await expect(page.locator('.flash')).toContainText('of your open projects');
      browserLog.reset();   // that message is expected; this test is about the record

      // Both entries hold the same text, which is kept once.
      expect(await refusedTexts(page)).toEqual(['{}']);
      expect(await storedSession(page)).not.toBe(UNREADABLE);   // the live key is usable again
    });

    test('saving resumes once a project is open again', async ({page, browserLog}) => {
      await bootWithUnreadableSession(page);
      browserLog.reset();

      await openAProject(page);

      await expect.poll(() => storedSession(page)).not.toBe(UNREADABLE);
      expect(await storedSession(page)).toContain('entries');
    });
  });

  test.describe('a stored project with a bad field', () => {
    /**
     * A stored project with a field the schema refuses loads anyway, with that field reset, and the
     * user is shown which field and offered the original (John, 2026-10-01: repair, never reset).
     * bugs/BUG_20261001_one-bad-field-refuses-a-whole-project.md
     */

    /** The stored open-session record, as far as this test touches it. */
    const OpenSessionRecord = z.looseObject({entries: z.array(z.looseObject({text: z.string()}))});

    test('a reload over an open project with a bad field shows the repair and keeps the project', async ({ page }) => {
      await page.goto('/');
      await openAProject(page);
      const name = await page.locator('.project-nav').first().textContent();

      // Break one field of the stored open project, the way an older or damaged record would be.
      const raw = await page.evaluate(() => localStorage.getItem('openisd_open_sessions'));
      expect(raw).not.toBeNull();
      const record = OpenSessionRecord.parse(JSON.parse(raw ?? ''));
      const text = record.entries[0].text;
      const broken = text.replace('"box":{', '"box":{"portVelocityLimit_m_per_s":"fast",');
      expect(broken).not.toBe(text);
      record.entries[0].text = broken;
      await page.evaluate(next => localStorage.setItem('openisd_open_sessions', next), JSON.stringify(record));
      await page.reload();

      const dialog = page.locator('.dg');
      await expect(dialog).toContainText('Saved projects were repaired');
      await expect(dialog).toContainText('saved.box.portVelocityLimit_m_per_s');
      await expect(dialog.getByRole('button', { name: 'Download the original' })).toBeVisible();
      await dialog.getByRole('button', { name: 'Dismiss' }).click();
      await expect(page.locator('.project-nav').first()).toHaveText(name ?? '');
    });
  });

  test.describe('closing projects', () => {
    // John 2026-10-05: "if I close the last project then I see the init screen, but if I refresh
    // then the last project comes back". Closing empties the open list; the saved copy stays.
    async function closeFocused(page: Page): Promise<void> {
      const before = await page.locator('.project-row').count();
      await page.locator('.proj-actions button:has-text("Close")').click();
      const discard = page.locator('.close-actions button:has-text("Close without saving")');
      if (await discard.isVisible()) await discard.click();
      await expect(page.locator('.project-row')).toHaveCount(before - 1);
    }

    test('closing the last project stays closed after a reload, and Open project still lists it', async ({ page }) => {
      await page.goto('/');
      await openAProject(page);
      await page.locator('.tb-btn[title^="Save - "]').click();
      await closeFocused(page);

      await page.reload();

      const emptyState = page.locator('.graph-empty');
      await expect(emptyState.getByRole('button', { name: 'New project' })).toBeVisible();
      await expect(emptyState.getByRole('button', { name: 'Import project' })).toBeVisible();
      await expect(page.locator('.project-row')).toHaveCount(0);
      await emptyState.getByRole('button', { name: 'Open project' }).click();
      await expect(page.locator('.open-project-dialog .stored-project-row')).toHaveCount(1);
    });

    test('closing one of two projects leaves one open after a reload', async ({ page }) => {
      await page.goto('/');
      await openAProject(page);
      await page.locator('.proj-actions button:has-text("Copy")').click();
      await expect(page.locator('.project-row')).toHaveCount(2);
      await closeFocused(page);

      await page.reload();

      await expect(page.locator('.project-row')).toHaveCount(1);
    });
  });
});
