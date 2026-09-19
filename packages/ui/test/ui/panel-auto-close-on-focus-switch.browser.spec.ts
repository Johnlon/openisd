import {expect, openAProject, test} from '../fixtures.js';
import type {Locator, Page} from '@playwright/test';

// QO157 (human ruling 2026-09-18): the editor/library overlays are TRUE full-screen modals
// (position:fixed inset:0), so while one is open the project rows sit UNDER it — a real user
// cannot click another row to switch focus. That is the intended design, not a bug. The
// focus-switch-closes rule applies only to DOCKED panels (the Tune panel); a true modal must
// be dismissed (Escape / its close button) before focus can change.

/** Assert the true-modal contract for one overlay: while it is open a click aimed at a project
 *  row is SWALLOWED by the overlay (the row never receives it, focus cannot change); after the
 *  modal is dismissed the same click lands on the row and focus switches. */
async function assertTrueModal(page: Page, modal: Locator, open: () => Promise<void>, close: () => Promise<void>): Promise<void> {
  await page.locator('button.link-btn', { hasText: '＋ Copy' }).click();
  const rows = page.locator('.project-row');
  await expect(rows).toHaveCount(2);

  await open();
  // Click at the row's coordinates with the MOUSE — Playwright's actionability check would
  // refuse because the overlay intercepts, which is exactly the point: the overlay swallows the
  // pointer event, the row never receives it, focus cannot change, and a true modal stays open.
  const rowBox = (await rows.nth(0).boundingBox())!;
  await page.mouse.click(rowBox.x + rowBox.width / 2, rowBox.y + rowBox.height / 2);
  await expect(modal).toBeVisible();

  await close();
  await rows.nth(0).click();
  await expect(rows.nth(0)).toHaveClass(/selected/);
}

test('switching focus to a different open project closes an open Tune panel', async ({ page }) => {
  await page.goto('/');

  await openAProject(page);
  await page.locator('button.link-btn', { hasText: '＋ Copy' }).click();

  await page.locator('li', { hasText: 'Driver' }).click();
  await page.locator('button.edit-btn', { hasText: 'Tune' }).click();
  const tunePanel = page.locator('.tune-panel');
  await expect(tunePanel).toBeVisible();

  // Tune is a DOCKED panel, not a modal — the rows stay clickable, and switching focus closes it.
  const projectRows = page.locator('.project-row');
  await expect(projectRows).toHaveCount(2);
  await projectRows.nth(0).click();

  await expect(tunePanel).toBeHidden();
});

test('the Driver Editor is a true modal — the project rows are unclickable while it is open', async ({ page }) => {
  await page.goto('/');
  await openAProject(page);

  await assertTrueModal(
    page,
    page.locator('.de-modal'),
    async () => {
      await page.locator('li', { hasText: 'Driver' }).click();
      await page.locator('button.edit-btn', { hasText: 'Edit' }).click();
      await expect(page.locator('.de-modal')).toBeVisible();
    },
    async () => {
      await page.keyboard.press('Escape');
      await expect(page.locator('.de-modal')).toBeHidden();
    },
  );
});

test('the PR editor is a true modal — the project rows are unclickable while it is open', async ({ page }) => {
  await page.goto('/');
  await openAProject(page);

  await assertTrueModal(
    page,
    page.locator('.overlay.on'),
    async () => {
      await page.locator('li', { hasText: 'Box' }).click();
      await page.locator('#og-box-type').selectOption('box-passive-radiator');
      await page.locator('li', { hasText: 'Passive Radiator' }).click();
      await page.locator('button.edit-btn[title*="Edit this passive radiator"]').click();
      await expect(page.locator('.overlay.on')).toContainText('Edit passive radiator');
    },
    async () => {
      await page.keyboard.press('Escape');
      await expect(page.locator('.overlay.on')).toHaveCount(0);
    },
  );
});

test('the driver library is a true modal — the project rows are unclickable while it is open', async ({ page }) => {
  await page.goto('/');
  await openAProject(page);

  await assertTrueModal(
    page,
    page.locator('.wb-modal'),
    async () => {
      await page.locator('li', { hasText: 'Driver' }).click();
      await page.locator('button.edit-btn', { hasText: 'Select Driver' }).click();
      await expect(page.locator('.wb-modal')).toBeVisible();
    },
    async () => {
      await page.keyboard.press('Escape');
      await expect(page.locator('.wb-modal')).toBeHidden();
    },
  );
});