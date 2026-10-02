import {editorTab, expect, openAProject, test} from '../fixtures.js';
import type {Page} from '@playwright/test';

// Every tab of the app shows the same open projects. A change made in one tab — open, close,
// edit — appears in every other tab, and a fresh tab opens on that same session.
// bugs/archive/BUG_20260926_tabs-overwrite-each-others-open-projects.md

interface StoreHandle { state: { P: { Vb: number } } }
declare global {
  interface Window { __store_context: StoreHandle }
}

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
  await expect.poll(() => rowNames(page)).toEqual(await rowNames(other));
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

  await other.evaluate(() => { window.__store_context.state.P.Vb = 0.0111111; });

  await expect.poll(() => page.evaluate(() => window.__store_context.state.P.Vb)).toBeCloseTo(0.0111111, 9);
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
  await page.evaluate(() => { window.__store_context.state.P.Vb = 0.0222222; });

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
  const volumeUnit = (p: Page) => p.locator('.tab-section.active .field', { hasText: 'Volume' }).first().locator('.unit-cyc');
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

  await page.evaluate(() => { window.__store_context.state.P.Vb = 0.0111111; });
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

  await page.evaluate(() => { window.__store_context.state.P.Vb = 0.0111111; });
  await expect.poll(() => other.evaluate(() => window.__store_context.state.P.Vb)).toBeCloseTo(0.0111111, 9);

  await editorTab(other, 'General');
  await other.locator('.de-fld', { has: other.locator('label', { hasText: 'Model' }) }).locator('input').fill('Model 111111');
  await other.locator('.de-modal .de-footer button:has-text("OK")').click();
  await expect(other.locator('.de-modal')).toBeHidden();

  const model = (p: Page) => p.locator('.driver-id-row input').nth(1);
  await expect(model(other)).toHaveValue('Model 111111');
  expect(await other.evaluate(() => window.__store_context.state.P.Vb)).toBeCloseTo(0.0111111, 9);
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await expect(model(page)).toHaveValue('Model 111111');
});
