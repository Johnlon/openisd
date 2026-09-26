import {expect, openAProject, test} from '../fixtures.js';
import type {Page} from '@playwright/test';

// Every tab of the app shows the same open projects. A change made in one tab — open, close,
// edit — appears in every other tab, and a fresh tab opens on that same session.
// bugs/BUG_20260926_tabs-overwrite-each-others-open-projects.md

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
