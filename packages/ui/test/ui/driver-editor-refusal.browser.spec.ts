/**
 * The Driver Editor shows every refused entry, as every other number box does (John, 17 Nov 2026: nothing the app does happens silently).
 *  - bugs/BUG_20261117_driver-editor-tab-switch-drops-refused-entry.md: a refused entry vanished, unmarked, when another tab was opened.
 * A person types, clicks tabs and presses OK; nothing else is used.
 */
import type {Page} from '@playwright/test';
import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {PIXEL_9} from '../fixtures/phoneSizes.js';
import {COMPLETE_DRIVER_PROJECT_OWPR, ensureSampleProject} from '../fixtures/sampleProject.js';

ensureSampleProject();

type Viewport = 'desktop' | 'phone';

async function openEditor(page: Page, viewport: Viewport): Promise<void> {
  if (viewport === 'phone') {
    await page.setViewportSize(PIXEL_9);
    await forceMobileSkin(page);
    await page.goto('/');
    await openAMobileProject(page);
    await page.locator('.mob-tab', {hasText: 'Driver'}).click();
    await page.getByText('Edit', {exact: true}).click();
  } else {
    await page.goto('/');
    await openAProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
    await page.locator('.project-nav li', {hasText: 'Driver'}).click();
    await page.locator('.driver-id-row').getByRole('button', {name: 'Edit'}).click();
  }
  await expect(page.locator('.de-modal')).toBeVisible();
}

const box = (page: Page, key: string) => page.locator(`.de-modal .ui-field[data-field-key="${key}"]`).locator('input').first();
const tabButton = (page: Page, name: string) => page.locator('.de-tab', {hasText: name});

async function typeInto(page: Page, key: string, text: string): Promise<void> {
  const input = box(page, key);
  await input.click();
  await input.press('Control+a');
  await input.pressSequentially(text);
}

for (const viewport of ['desktop', 'phone'] as const) {
  test.describe(`${viewport} Driver Editor refusals`, () => {
    test.beforeEach(async ({page}) => { await openEditor(page, viewport); });

    test('a refused entry keeps its text and red mark when another tab is opened and the Parameters tab is shown again', async ({page}) => {
      await typeInto(page, 'Qts', '0');
      await expect(box(page, 'Qts')).toHaveClass(/inp-bad/);

      await tabButton(page, 'Advanced').click();
      await expect(box(page, 'Qts'), 'the other tab is really hidden, not drawn over this one').toBeHidden();
      await expect(box(page, 'Gloss')).toBeVisible();
      await expect(tabButton(page, 'Parameters'), 'the tab holding the refused entry says so while it is out of sight').toHaveClass(/de-tab-refused/);
      await expect(page.getByRole('button', {name: 'Parameters', exact: true}), 'the warning sign does not change the tab name').toBeVisible();
      await expect(tabButton(page, 'Parameters')).toHaveAccessibleDescription('holds an entry that was not applied');
      await tabButton(page, 'Parameters').click();

      await expect(box(page, 'Qts')).toHaveValue('0');
      await expect(box(page, 'Qts')).toHaveClass(/inp-bad/);
      await expect(page.locator('.de-modal .ui-field[data-field-key="Qts"] .ui-field-dq-btn')).toHaveAttribute('title', /Qts must be greater than 0/);
    });

    test('OK with a refused entry still standing says which entry was not applied', async ({page}) => {
      await typeInto(page, 'Qts', '0');
      await tabButton(page, 'Advanced').click();
      await page.locator('.de-footer, .de-btns').getByRole('button', {name: 'OK', exact: true}).click();
      await expect(page.locator('.flash, [data-testid="flash-strip"]').first()).toContainText(/Not applied: Qts must be greater than 0/);
    });
  });
}
