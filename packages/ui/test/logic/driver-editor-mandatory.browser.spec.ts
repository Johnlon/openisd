import { test, expect, openAProject, editorTab } from '../fixtures.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
});
// ── Incomplete drivers are SAVEABLE; only Brand+Model gate ────────────────────────────
// Human ruling 2026-08-05: "all the buttons on driver editor need to work regardless of
// driver — only brand and model are 100% required as they are the index key. So gate the
// save or copy to my drivers or OK buttons on those two fields and if clicked then popup a
// message saying Brand and Model are both required."
//
// So: nothing is ever DISABLED. OK/Save/Copy answer the click — either they act, or they
// say why not. Missing T/S is a data-quality state that only stops the CHARTS.

async function openParameters(page: import('@playwright/test').Page) {
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('.driver-id-row').getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('.de-modal')).toBeVisible();
  await editorTab(page, 'Parameters');
}
function field(page: import('@playwright/test').Page, label: string) {
  return page.locator('.de-fld', { has: page.locator('label', { hasText: new RegExp(`^${label}\\b`) }) })
             .locator('input').first();
}
const okBtn   = (page: import('@playwright/test').Page) => page.locator('.de-modal .de-footer button:has-text("OK")');
const saveBtn = (page: import('@playwright/test').Page) => page.locator('.de-modal .de-footer button:has-text("Save")');
const copyBtn = (page: import('@playwright/test').Page) => page.locator('.de-modal .de-footer button:has-text("Copy to My Drivers")');

test('OK, Save and Copy stay live on an incomplete driver, and it commits', async ({ page }) => {
  await openParameters(page);
  for (const f of ['Fs', 'Vas', 'Re', 'Sd', 'Qts', 'Qes', 'Qms']) await field(page, f).fill('');
  await field(page, 'Qms').blur();

  await expect(okBtn(page)).toBeEnabled();
  await expect(saveBtn(page)).toBeEnabled();
  await expect(copyBtn(page)).toBeEnabled();

  await okBtn(page).click();
  await expect(page.locator('.de-modal')).toHaveCount(0);   // it really did commit and close
});

// Brand + Model is the index key — the pair My Drivers, the project and the saved filename
// all look the driver up by — so it is the ONE thing the filing actions insist on.
const brandInputOf = (page: import('@playwright/test').Page) => page.locator('.de-modal .de-brand');

test('a missing Brand pops a message instead of a dead button, and lands the caret on it', async ({ page }) => {
  await openParameters(page);
  await editorTab(page, 'General');          // Brand only exists on this pane
  await brandInputOf(page).fill('');

  await expect(okBtn(page)).toBeEnabled();          // never disabled — it answers the click
  await okBtn(page).click();
  await expect(page.getByText('Brand and Model are both required')).toBeVisible();
  await expect(page.locator('.de-modal')).toBeVisible();   // nothing was committed

  await page.getByRole('button', { name: 'Fill them in' }).click();
  await expect(brandInputOf(page)).toBeFocused();

  await brandInputOf(page).fill('Acme');
  await okBtn(page).click();
  await expect(page.locator('.de-modal')).toHaveCount(0);  // now it commits
});

test('Copy to My Drivers and Save are gated the same way', async ({ page }) => {
  await openParameters(page);
  await editorTab(page, 'General');
  await brandInputOf(page).fill('');

  await copyBtn(page).click();
  await expect(page.getByText('Brand and Model are both required')).toBeVisible();
  await page.getByRole('button', { name: 'Fill them in' }).click();

  await saveBtn(page).click();
  await expect(page.getByText('Brand and Model are both required')).toBeVisible();
});
test('a missing Fs raises the CHART strip only, and the driver can still be filed', async ({ page }) => {
  await openParameters(page);
  await field(page, 'Fs').fill('');
  await field(page, 'Fs').blur();

  const charts = page.locator('.de-incomplete', { hasText: 'charts stay blank' });
  await expect(charts).toBeVisible();
  await expect(charts).toContainText('Fs');

  // Brand and Model are untouched, so the driver still has a name to be filed under.
  await expect(page.locator('.de-incomplete', { hasText: 'filed under a name' })).toHaveCount(0);
});
test('every Parameters input reports its E/C/N state', async ({ page }) => {
  await openParameters(page);
  const unstyled = await page.evaluate(() => {
    const out: string[] = [];
    document.querySelectorAll('.de-params .de-fld').forEach(f => {
      const i = f.querySelector('input');
      // The provenance classes are value-e / value-c / value-n (DriverEditorModal.vue's styles);
      // st-[ecn] was their old name and matched nothing, so every input read as unstyled.
      if (i && !/\bvalue-[ecn]\b/.test(i.className)) out.push(f.querySelector('label')?.textContent?.trim() ?? '?');
    });
    return out;
  });
  expect(unstyled).toEqual([]);
});
