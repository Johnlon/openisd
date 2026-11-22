/**
 * The ≠W cue by "Use transmission line model for port simulation" opens the "OpenISD and WinISD
 * differences" entry for it, on the desktop skin and on the phone skin. On a phone the entry is the
 * only explanation: there is no hover tooltip.
 */
import {expect, openAMobileProject, openAProject, setFocusedBoxType, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

const PAGE = {name: 'OpenISD and WinISD differences'};
const ENTRY_TITLE = 'WinISD\'s transmission line port tunes the box higher';

test.describe('desktop width', () => {
  test.beforeEach(async ({appPage: page}) => {
    await page.goto('/');
    await openAProject(page);
    await setFocusedBoxType(page, 'vented');
  });

  test('the cue by the transmission line tickbox opens its entry', async ({appPage: page}) => {
    await page.locator('.project-nav li', {hasText: 'Advanced'}).click();
    const cue = page.locator('label[data-field-key="tlPortModel"] button.winisd-deviation-cue');
    await expect(cue).toBeVisible();
    await cue.click();
    const entry = page.getByRole('dialog', PAGE).locator('.wd-entry.current, .mob-dcard.current');
    await expect(entry.locator('h4, .mob-dcard-title')).toHaveText(ENTRY_TITLE);
    await expect(entry).toContainText('pipe notes');
    await expect(entry).toContainText('TL port without end correction');
    await expect(entry).toBeInViewport();
  });
});

test.describe('phone width', () => {
  test.beforeEach(async ({appPage: page}) => {
    await forceMobileSkin(page);
    await page.goto('/');
    await openAMobileProject(page);
    await setFocusedBoxType(page, 'vented');
  });

  test('the cue by the transmission line tickbox opens its entry', async ({appPage: page}) => {
    await page.locator('.mob-hamburger').click();
    await page.locator('.mob-menu-item', {hasText: 'Advanced'}).click();
    const cue = page.locator('label[data-field-key="tlPortModel"] button.winisd-deviation-cue');
    await expect(cue).toBeVisible();
    await cue.click();
    const entry = page.getByRole('dialog', PAGE).locator('.wd-entry.current, .mob-dcard.current');
    await expect(entry.locator('h4, .mob-dcard-title')).toHaveText(ENTRY_TITLE);
    await expect(entry).toContainText('pipe notes');
    await expect(entry).toContainText('TL port without end correction');
    await expect(entry).toBeInViewport();
  });
});
