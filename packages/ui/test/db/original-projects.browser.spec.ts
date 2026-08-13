/**
 * The Original skin's Projects list. Open projects are INDEPENDENT documents: one never
 * carries, rebuilds or hides another (ARCHITECTURE.md AD-7 / docs/design/STATE_MODEL.md). These tests
 * pin the three ways that independence used to break —
 *   1. a row's show/hide checkbox being re-derived from a second copy of the same fact,
 *   2. the other open projects being written into the active design's state.compare
 *      (which is what gets saved to its file and share link),
 *   3. a project you cannot close, and unsaved work discarded without being asked.
 * The auto console/network guardrail (fixtures) covers errors raised along the way.
 */
import { test, expect } from '../fixtures.js';
import type { Page } from '@playwright/test';

// The store's debug handle, typed to just the parts these tests read. Avoids `any` casts
// while keeping the test honest about what it is reaching into.
interface StoreHandle { state: { P: { Vb: number } } }
declare global {
  interface Window { __store_context: StoreHandle }
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
  await page.locator('.skin-picker select').selectOption('original');
  await page.locator('.original-root').waitFor({ state: 'visible' });
});

const rowStates = (page: Page) =>
  page.locator('.project-row').evaluateAll(els => els.map(e => ({
    name: e.querySelector('span')?.textContent?.trim() ?? '',
    checked: (e.querySelector('input') as HTMLInputElement | null)?.checked ?? false,
  })));

async function addCopies(page: Page, n: number) {
  for (let i = 0; i < n; i++) {
    await page.locator('.proj-actions button:has-text("Copy")').click();
    await expect(page.locator('.project-row')).toHaveCount(i + 2);
  }
}

test('every project row keeps its own show/hide state, including the active one', async ({ page }) => {
  await addCopies(page, 2);

  // Untick all three — the active row included.
  for (let i = 0; i < 3; i++) await page.locator('.project-row input').nth(i).click();
  expect((await rowStates(page)).map(r => r.checked)).toEqual([false, false, false]);

  // An unrelated design edit must not resurrect any of them. The active row's checkbox
  // used to spring back here, because a second copy of "visible" was re-applied on every
  // store change.
  await page.evaluate(() => { window.__store_context.state.P.Vb = 0.042; });
  await expect.poll(async () => (await rowStates(page)).map(r => r.checked)).toEqual([false, false, false]);
});

test('hiding a project removes its trace from the chart, and showing it brings it back', async ({ page }) => {
  await addCopies(page, 1);

  // Count distinct opaque colours drawn on the canvas: a second trace is a second colour.
  const inkColours = () => page.evaluate(() => {
    const c = document.querySelector('.graph-wrap canvas') as HTMLCanvasElement;
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    const seen = new Set<string>();
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) seen.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
    return seen.size;
  });

  const shown = await inkColours();
  await page.locator('.project-row input').nth(1).click();
  await expect.poll(inkColours).toBeLessThan(shown);
  await page.locator('.project-row input').nth(1).click();
  await expect.poll(inkColours).toBe(shown);
});

test('open projects are never written into the active design (nothing to leak into its file)', async ({ page }) => {
  await addCopies(page, 2);
  await page.locator('.project-row').nth(1).click();          // work in the copy for a moment
  await page.locator('.project-row').nth(0).click();          // and back

  // What gets persisted IS what gets saved and shared. It must describe one project: no
  // list of other designs, and no trace of the other open projects' names.
  const persisted = await page.evaluate(() => localStorage.getItem('openisd.state') ?? '');
  expect(persisted).not.toBe('');
  expect(Object.keys(JSON.parse(persisted))).not.toContain('compare');
  expect(persisted).not.toContain('Copy of');
});

test('closing an unsaved project asks first, and offers all three outcomes by name', async ({ page }) => {
  await addCopies(page, 1);
  await page.evaluate(() => { window.__store_context.state.P.Vb = 0.037; });  // make it unsaved

  await page.locator('.proj-actions button:has-text("Close")').click();
  await expect(page.locator('.close-actions')).toBeVisible();
  expect(await page.locator('.close-actions button').evaluateAll(els => els.map(e => e.textContent!.trim())))
    .toEqual(['Save and close', 'Close without saving', 'Keep it open']);

  // "Keep it open" is a true no-op.
  await page.locator('.close-actions button:has-text("Keep it open")').click();
  await expect(page.locator('.close-actions')).toBeHidden();
  await expect(page.locator('.project-row')).toHaveCount(2);

  await page.locator('.proj-actions button:has-text("Close")').click();
  await page.locator('.close-actions button:has-text("Close without saving")').click();
  await expect(page.locator('.project-row')).toHaveCount(1);
});

test('the last project can be closed too — the app lands on a fresh one, still drawing', async ({ page }) => {
  await page.locator('.proj-actions button:has-text("Close")').click();
  const challenge = page.locator('.close-actions');
  if (await challenge.isVisible()) await page.locator('.close-actions button:has-text("Close without saving")').click();

  await expect(page.locator('.project-row')).toHaveCount(1);
  await expect(page.locator('.graph-wrap canvas')).toBeVisible();
});
