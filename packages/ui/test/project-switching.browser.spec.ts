/**
 * Multiple open projects: the Projects list is switchable, and a copied project is a
 * fully independent, functional-but-unsaved project.
 *
 * Human directives 2026-07-26:
 *   "I need to switch between loaded projects"
 *   "copied projects become fully independent fully functional project — but it's a not-saved state"
 *
 * This proves the BEHAVIOUR, not just the DOM: after each interaction it reads the live
 * store so a green checkbox/row is never mistaken for a working switch.
 */
import { test, expect } from './fixtures.js';
import type { Page } from '@playwright/test';

const STORE = '/src/store.ts';

async function gotoOriginal(page: Page): Promise<void> {
  await page.goto('/');
  await page.locator('.skin-picker select').selectOption('original');
  await page.waitForFunction(() => (window as unknown as { _selfTestDone?: boolean })._selfTestDone === true);
}

/** Read the live active design out of the store. */
async function active(page: Page): Promise<{ name: string; driver: string; fs: number; box: string }> {
  return await page.evaluate(async (mod) => {
    const s = await import(/* @vite-ignore */ mod);
    return {
      name: s.state.project.name,
      driver: s.driverRaw.value.name ?? '',
      fs: s.driverRaw.value.Fs ?? 0,
      box: s.state.box,
    };
  }, STORE);
}

const rows = (page: Page) => page.locator('.projects-list .project-row');
const rowByText = (page: Page, text: string) => rows(page).filter({ hasText: text });

test('two loaded projects both appear, and clicking a row switches the active editor', async ({ page }) => {
  await gotoOriginal(page);

  // Name the current project "Alpha", then open a distinct project "Beta".
  await page.evaluate(async (mod) => {
    const s = await import(/* @vite-ignore */ mod);
    s.state.project.name = 'Alpha';
    s.openProjectAdditive({
      v: 2,
      driver: { inputs: { name: 'Beta driver', Fs: 55, Qts: 0.32, Qes: 0.34, Qms: 5, Vas: 0.012, Sd: 0.009, Re: 3.2, Xmax: 0.004, Pe: 40 } },
      box: 'sealed', P: { Vb: 0.008, Pin: 2 }, graphs: ['SPL'], compare: [],
      ui: {}, project: { name: 'Beta', creator: '', created: '', modified: '', description: '' }, cursor: null,
    });
  }, STORE);

  // Both projects are listed; Beta is the freshly-opened active one.
  await expect(rows(page)).toHaveCount(2);
  await expect(rowByText(page, 'Alpha')).toBeVisible();
  await expect(rowByText(page, 'Beta')).toBeVisible();
  expect((await active(page)).name).toBe('Beta');

  // Switch to Alpha — the active editor must actually become Alpha.
  await rowByText(page, 'Alpha').click();
  await expect(rowByText(page, 'Alpha')).toHaveClass(/selected/);
  const onAlpha = await active(page);
  expect(onAlpha.name).toBe('Alpha');
  expect(onAlpha.box).toBe('vented');            // Alpha is the demo (vented), Beta is sealed

  // Switch back to Beta — its own driver/box return, proving the swap carries the whole design.
  await rowByText(page, 'Beta').click();
  const onBeta = await active(page);
  expect(onBeta.name).toBe('Beta');
  expect(onBeta.driver).toBe('Beta driver');
  expect(onBeta.fs).toBe(55);
  expect(onBeta.box).toBe('sealed');
});

test('a copied project is fully independent — editing the copy does not touch the original', async ({ page }) => {
  await gotoOriginal(page);
  await page.evaluate(async (mod) => {
    const s = await import(/* @vite-ignore */ mod); s.state.project.name = 'Original';
  }, STORE);

  // Copy the current project.
  await page.locator('.proj-actions .link-btn', { hasText: 'Copy' }).click();
  await expect(rows(page)).toHaveCount(2);
  const copyRow = rows(page).filter({ hasText: 'Copy of Original' });
  await expect(copyRow).toBeVisible();

  // Switch to the copy and change its box volume via the store (a real design edit).
  await copyRow.click();
  const originalVb = await page.evaluate(async (mod) => {
    const s = await import(/* @vite-ignore */ mod); return s.state.P.Vb;
  }, STORE);
  await page.evaluate(async (mod) => {
    const s = await import(/* @vite-ignore */ mod); s.state.P.Vb = s.state.P.Vb * 2 + 0.001;
  }, STORE);

  // Switch back to the original — its Vb must be untouched (the copy is a separate design).
  await rows(page).filter({ hasText: 'Original' }).first().click();
  const backVb = await page.evaluate(async (mod) => {
    const s = await import(/* @vite-ignore */ mod); return s.state.P.Vb;
  }, STORE);
  expect(backVb).toBeCloseTo(originalVb, 9);
});

test('a copied project is unsaved — it is flagged modified in the list', async ({ page }) => {
  await gotoOriginal(page);
  await page.evaluate(async (mod) => {
    const s = await import(/* @vite-ignore */ mod); s.state.project.name = 'Original';
  }, STORE);
  await page.locator('.proj-actions .link-btn', { hasText: 'Copy' }).click();
  // The copy row carries the unsaved marker (is-unsaved class), not the pristine original.
  await expect(rows(page).filter({ hasText: 'Copy of Original' })).toHaveClass(/is-unsaved/);
});
