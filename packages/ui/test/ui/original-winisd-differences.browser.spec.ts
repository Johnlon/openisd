/**
 * The help page "OpenISD and WinISD differences" in the desktop skin: the Info menu opens it, a
 * WinISD Compatibility group heading's help link opens it at that group's section, and a ≠W cue
 * opens it at the cue's entry. What the page lists is proven in the design package
 * (`winisd-differences.test.ts`); these specs prove the entry points reach it.
 */
import {expect, openAProject, test} from '../fixtures.js';

const PAGE = {name: 'OpenISD and WinISD differences'};

test.beforeEach(async ({page}) => {
  await page.goto('/');
  await openAProject(page);
});

test('the Info menu opens the page, with its three sections; Close shuts it', async ({page}) => {
  await page.locator('.tb-btn[title="Info"]').click();
  await page.locator('.menu-item', {hasText: 'OpenISD and WinISD differences'}).click();
  const help = page.getByRole('dialog', PAGE);
  await expect(help).toBeVisible();
  await expect(help.locator('.wd-section h3')).toHaveText([
    'WinISD bugs you can switch back on',
    'Options: WinISD\'s way or another',
    'WinISD bugs OpenISD fixes (no switch)',
  ]);
  await help.locator('.wd-footer button', {hasText: 'Close'}).click();
  await expect(help).toHaveCount(0);
});

test('the "Enable WinISD-style" group heading\'s help link opens the page at the Options section', async ({page}) => {
  await page.locator('.project-nav li', {hasText: 'Advanced'}).click();
  await page.locator('.option-switch-group .compat-help-link').click();
  const help = page.getByRole('dialog', PAGE);
  const section = help.locator('#winisd-diff-options');
  await expect(section).toHaveClass(/current/);
  await expect(section).toBeInViewport();
});

// John, 2026-10-05: a popup beside the cue made the page scroll. The cue opens the help page
// itself, centred in the window at the cue's entry, and opening it never changes the page's scroll size.
test('a ≠W cue opens the page centred in the window at that cue\'s entry, without scrolling the page', async ({page}) => {
  await page.locator('.project-nav li', {hasText: 'Filters'}).click();
  const panel = page.locator('.content-panel');
  await panel.locator('.action-btn', {hasText: '+ LP'}).click();
  await panel.locator('.filter-edit-body label').filter({hasText: /^Subtype\b/}).locator('select').selectOption({label: 'Linkwitz-Riley'});
  const cue = panel.locator('button.winisd-deviation-cue');
  await expect(cue).toHaveAttribute('title', 'Differs from WinISD: WinISD ignores the Linkwitz-Riley order');
  const scrollSize = () => page.evaluate(() => ({w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight}));
  const scrollBefore = await scrollSize();
  await cue.click();
  const help = page.getByRole('dialog', PAGE);
  await expect(help).toBeVisible();
  const box = (await help.boundingBox())!;
  const view = page.viewportSize()!;
  expect(Math.abs(box.x + box.width / 2 - view.width / 2)).toBeLessThan(2);
  expect(Math.abs(box.y + box.height / 2 - view.height / 2)).toBeLessThan(2);
  expect(await scrollSize()).toEqual(scrollBefore);
  const entry = help.locator('.wd-entry.current');
  await expect(entry).toHaveCount(1);
  await expect(entry.locator('h4')).toHaveText('WinISD ignores the Linkwitz-Riley order');
  await expect(entry).toBeInViewport();
});
